import { AdapterArguments, AdapterError, CrossChainErrorCode, NetworkHelper } from '@m3s/common';
import { M3SLiFiViemProvider } from '../helpers/ProviderHelper.js';
import {
  ICrossChain,
  OperationIntent,
  OperationQuote,
  OperationResult,
  ChainAsset,
  ExecutionStatusEnum
} from '../types/index.js';
import {
  getChains,
  getQuote,
  getTokens,
  convertQuoteToRoute,
  executeRoute,
  createConfig,
  QuoteRequest,
  EVM,
  ChainType,
  ChainId,
  getGasRecommendation,
  getActiveRoute,
  RouteExtended,
  stopRouteExecution, // Keep for basic cancel
  LiFiStep,
  FeeCost,
  Execution,
  resumeRoute,
  ExtendedChain
} from '@lifi/sdk';
import { IEVMWallet } from '@m3s/wallet';
import { WalletClient } from 'viem';
import { EventEmitter } from 'eventemitter3';

export interface ILiFiAdapterOptionsV1 {
  wallet?: IEVMWallet;
  apiKey?: string;
}

interface args extends AdapterArguments<ILiFiAdapterOptionsV1> { }

/**
 * Minimal Adapter for LI.FI cross-chain operations.
 * Focuses on core functionality: quote, execute, status check.
 * Removes internal tracking, advanced confirmation, timeouts, caching.
 */
export class MinimalLiFiAdapter extends EventEmitter implements ICrossChain {
  public readonly name: string;
  public readonly version: string;
  private initialized: boolean = false;
  private args: args;


  /**
   * Private constructor - use static create method
   */
  private constructor(initialArgs: args) {
    super()
    this.name = initialArgs.name
    this.version = initialArgs.version
    this.args = JSON.parse(JSON.stringify(initialArgs));
    this.args.options = this.args.options || {};
  }

  static async create(initialCreationArgs: args): Promise<MinimalLiFiAdapter> {
    const adapter = new MinimalLiFiAdapter(initialCreationArgs);
    await adapter.initialize();
    return adapter;
  }

  private _updateLifiSdkConfig(tempProvider?: {
    getWalletClient(): Promise<WalletClient>;
    switchChain(chainId: number): Promise<WalletClient>;
  }): void {
    const sdkConfig: any = {
      integrator: 'm3s-minimal',
      apiKey: this.args.options?.apiKey,
    };

    if (tempProvider) {
      sdkConfig.providers = [
        EVM({
          getWalletClient: async () => tempProvider.getWalletClient(),
          switchChain: async (chainId: number) => tempProvider.switchChain(chainId)
        }),
      ];
    }

    createConfig(sdkConfig);
  }

  async initialize(): Promise<void> {
    // Configure SDK with API key only (no providers)
    this._updateLifiSdkConfig();
    this.initialized = true;
  }

  /**
   * Update adapter configuration after initialization
   */
  async updateConfig(configUpdate: Partial<args>): Promise<void> {
    if (!this.initialized) {
      throw new AdapterError("Adapter must be initialized before updating config", {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'updateConfig'
      });
    }

    // Merge new config into existing args
    if (configUpdate.options !== undefined) {
      this.args.options = { ...this.args.options, ...configUpdate.options };
    }

    // Reconfigure SDK with updated settings
    this._updateLifiSdkConfig();

    console.log(`[MinimalLiFiAdapter] Configuration updated. API Key: ${this.args.options?.apiKey ? 'Set' : 'Not Set'}`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'getOperationQuote',
      });
    }
    if (!intent) {
      throw new AdapterError("OperationIntent cannot be null or undefined.", {
        code: CrossChainErrorCode.InvalidInput,
        methodName: 'getOperationQuote',
        details: { intent }
      });
    }

    try {
      const quoteRequest: QuoteRequest = {
        fromChain: Number(intent.sourceAsset.chainId),
        fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000',
        fromAddress: intent.userAddress,
        fromAmount: intent.amount,
        toChain: Number(intent.destinationAsset.chainId),
        toToken: intent.destinationAsset.address || '0x0000000000000000000000000000000000000000',
        toAddress: intent.recipientAddress || intent.userAddress,
        slippage: intent.slippageBps ? intent.slippageBps / 10000 : undefined,
        integrator: 'm3s-minimal',
      };

      const quoteStep: LiFiStep = await getQuote(quoteRequest);

      if (!quoteStep) {
        console.warn(`[getOperationQuote] LiFi SDK's getQuote returned a falsy value. Interpreting as no quotes found.`);
        return [];
      }

      const feeUSD = quoteStep.estimate.feeCosts?.reduce((sum, fee: FeeCost) => sum + parseFloat(fee.amountUSD || '0'), 0).toString() || '0';
      const firstGasCost = quoteStep.estimate.gasCosts?.[0];
      const gasCostsEstimate = firstGasCost ? {
        limit: firstGasCost.limit || '',
        amount: firstGasCost.amount || '',
        amountUSD: firstGasCost.amountUSD || '0'
      } : undefined;

      const operationQuote: OperationQuote = {
        id: quoteStep.id,
        intent: intent,
        estimate: {
          fromAmount: quoteStep.action.fromAmount,
          toAmount: quoteStep.estimate.toAmount,
          toAmountMin: quoteStep.estimate.toAmountMin,
          routeDescription: `${quoteStep.toolDetails.name} via LI.FI`,
          executionDuration: quoteStep.estimate.executionDuration,
          feeUSD: feeUSD,
          gasCosts: gasCostsEstimate,
        },
        adapter: {
          name: this.name,
          version: this.version
        },
        adapterQuote: quoteStep,
      };

      return [operationQuote];

    } catch (error: any) {
      if (error instanceof AdapterError) throw error; // Re-throw if already an AdapterError

      const originalErrorMessage = error instanceof Error ? error.message : String(error);

      // Check if the error from LiFi SDK indicates "No available quotes" or a 404
      // The LiFi SDK might throw an SDKError with a cause that includes response details
      const isNoQuotesError = originalErrorMessage.includes('No available quotes for the requested transfer') ||
        (error.status === 404 && originalErrorMessage.includes('Not Found')) || // Direct check on error if it's an HTTPError-like object
        (error.cause as any)?.response?.status === 404 && (error.cause as any)?.responseBody?.message?.includes('No available quotes');

      if (isNoQuotesError) {
        console.warn(`[getOperationQuote] LiFi SDK found no available quotes for the request. Returning empty array. Details: ${originalErrorMessage}`);
        return []; // Treat "no quotes found" as a valid scenario returning no quotes
      }

      // For other unexpected SDK errors, throw an AdapterError
      throw new AdapterError(`Failed to get operation quote from LiFi SDK: ${originalErrorMessage}`, {
        cause: error,
        code: CrossChainErrorCode.QuoteFailed, // General quote failure for other errors
        methodName: 'getOperationQuote',
        details: { intent, originalError: originalErrorMessage }
      });
    }
  }

  // async executeOperation(
  //   quote: OperationQuote,
  //   options: {
  //     wallet: IEVMWallet;
  //     onStatusUpdate?: (route: RouteExtended) => void;
  //   }
  // ): Promise<OperationResult> {
  //   if (!this.initialized) {
  //     throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
  //       code: CrossChainErrorCode.AdapterNotInitialized,
  //       methodName: 'executeOperation',
  //     });
  //   }

  //   // ✅ Check wallet first
  //   if (!options?.wallet) {
  //     throw new AdapterError("Execution provider not set. Cannot execute operation.", {
  //       code: CrossChainErrorCode.ProviderSetFailed,
  //       methodName: 'executeOperation',
  //     });
  //   }

  //   // Then validate quote...
  //   const step = quote.adapterQuote as LiFiStep | undefined;
  //   if (!step?.id || !step.action || !step.estimate) {
  //     throw new AdapterError("Invalid or incomplete quote provided for execution.", {
  //       code: CrossChainErrorCode.InvalidInput,
  //       methodName: 'performExecution',
  //       details: { quoteId: quote?.id, hasRoute: !!quote?.intent }
  //     });
  //   }

  //   // ✅ Create provider on-demand
  //   const tempProvider = await this.createTemporaryViemProvider(options.wallet);

  //   // Configure SDK with temporary provider
  //   this._updateLifiSdkConfig(tempProvider);

  //   // Execute and return
  //   return this.performExecution(quote, options.onStatusUpdate);
  // }

  // private async performExecution(
  //   quote: OperationQuote,
  //   onStatusUpdate?: (route: RouteExtended) => void
  // ): Promise<OperationResult> {
  //   if (!this.initialized) {
  //     throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
  //       code: CrossChainErrorCode.AdapterNotInitialized,
  //       methodName: 'performExecution',
  //     });
  //   }

  //   const step = quote.adapterQuote as LiFiStep | undefined;
  //   if (!step?.id || !step.action || !step.estimate) {
  //     throw new AdapterError("Invalid or incomplete quote provided for execution.", {
  //       code: CrossChainErrorCode.InvalidInput,
  //       methodName: 'performExecution',
  //       details: { quoteId: quote?.id, hasRoute: !!quote?.intent }
  //     });
  //   }

  //   try {
  //     const route = await convertQuoteToRoute(step);
  //     try {
  //       await executeRoute(route, { updateRouteHook: onStatusUpdate });
  //     } catch (err: any) {
  //       console.error('[MinimalLiFiAdapter] execution failed:', err);
  //       if (onStatusUpdate) {
  //         const now = Date.now();
  //         const failedRoute = route as RouteExtended;

  //         // Mark every step as FAILED
  //         failedRoute.steps = failedRoute.steps.map((s: LiFiStepExtended) => {
  //           const exec: any = s.execution || ({} as LiFiStepExtended['execution']);
  //           const baseProc = Array.isArray(exec.process) && exec.process[0]
  //             ? exec.process[0]
  //             : ({} as Process);

  //           // override only process.status—leave other props intact
  //           const failedProc: Process = {
  //             ...baseProc,
  //             status: 'FAILED',
  //             startedAt: baseProc.startedAt ?? now,
  //             doneAt: now,
  //             error: {
  //               code: baseProc.error?.code ?? 'UNKNOWN',
  //               message: err.message ?? 'Unknown error'
  //             }
  //           };

  //           return {
  //             ...s,
  //             execution: {
  //               ...exec,
  //               status: 'FAILED',
  //               startedAt: exec.startedAt ?? now,
  //               endedAt: now,
  //               process: [failedProc],
  //               fromAmount: exec.fromAmount,
  //               toAmount: exec.toAmount,
  //               feeCosts: exec.feeCosts,
  //               gasCosts: exec.gasCosts
  //             }
  //           };
  //         });

  //         onStatusUpdate(failedRoute);
  //       }
  //     }
  //     return {
  //       operationId: route.id,
  //       status: ExecutionStatusEnum.PENDING,
  //       statusMessage: 'Execution initiated via LI.FI SDK.',
  //       adapter: { name: this.name, version: this.version },
  //       sourceTx: { chainId: quote.intent.sourceAsset.chainId },
  //       destinationTx: { chainId: quote.intent.destinationAsset.chainId }
  //     };
  //   } catch (error: any) {
  //     console.error("[MinimalLiFiAdapter] Error executing operation:", error);
  //     return {
  //       operationId: step.id!,
  //       status: ExecutionStatusEnum.FAILED,
  //       statusMessage: `Execution failed: ${error.message}`,
  //       adapter: { name: this.name, version: this.version },
  //       sourceTx: { chainId: quote.intent.sourceAsset.chainId },
  //       destinationTx: { chainId: quote.intent.destinationAsset.chainId },
  //       error: error.message
  //     };
  //   }
  // }

  async executeOperation(
    quote: OperationQuote,
    options: { wallet: IEVMWallet }
  ): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'executeOperation'
      });
    }

    if (!options?.wallet) {
      throw new AdapterError("Execution provider not set. Cannot execute operation.", {
        code: CrossChainErrorCode.ProviderSetFailed,
        methodName: 'executeOperation'
      });
    }

    // configure SDK with on‐demand wallet provider
    const tempProvider = await this.createTemporaryViemProvider(options.wallet);
    this._updateLifiSdkConfig(tempProvider);

    const pending: OperationResult = {
      operationId: quote.id,
      status: ExecutionStatusEnum.PENDING,
      statusMessage: 'Execution started',
      adapter: { name: this.name, version: this.version },
      sourceTx: { chainId: quote.intent.sourceAsset.chainId },
      destinationTx: { chainId: quote.intent.destinationAsset.chainId },
    };
    this.emit('status', pending);

    try {
      const route = await convertQuoteToRoute(quote.adapterQuote as LiFiStep);
      await executeRoute(route, {
        updateRouteHook: r => {
          // 2) intermediate updates
          const upd = this.translateRouteToStatus(r);
          this.emit('status', upd);
        }
      });
      // 3) final COMPLETED
      // add these two lines:
      console.log("[MinimalLiFiAdapter] executeRoute finished, emitting COMPLETED", route);
      const completed = this.translateRouteToStatus(route);
      this.emit("status", completed);
      console.log("[MinimalLiFiAdapter] COMPLETED emitted", completed);

    } catch (err: any) {
      // 4) final FAILED
      const failed: OperationResult = {
        operationId: quote.id,
        status: ExecutionStatusEnum.FAILED,
        statusMessage: err.message,
        adapter: { name: this.name, version: this.version },
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        error: err.message,
      };
      this.emit('status', failed);
    }

    // always return initial PENDING
    return pending;
  }

  private async createTemporaryViemProvider(wallet: IEVMWallet): Promise<{
    getWalletClient: () => Promise<WalletClient>;
    switchChain: (chainId: number) => Promise<WalletClient>;
  }> {
    // Get the current network from wallet (just for chainId)
    const currentNetwork = await wallet.getNetwork();

    // Use NetworkHelper to get fresh, working network configuration
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();

    const networkConfig = await networkHelper.getNetworkConfig(currentNetwork.chainId);

    if (!networkConfig) {
      throw new AdapterError(`Failed to get network configuration for chain ${currentNetwork.chainId}`, {
        code: CrossChainErrorCode.UnsupportedChain,
        methodName: 'createTemporaryViemProvider'
      });
    }

    // ONLY THE PRIMARY RPC.
    const working = await networkHelper.findFirstWorkingRpc(
      networkConfig.rpcUrls,
      currentNetwork.chainId,
      3000
    );
    if (!working) {
      console.warn(`[MinimalLiFiAdapter] No working RPC found for chain ${currentNetwork.chainId}`);
      // fallback to original list so errors bubble rather than silent no-ops
      networkConfig.rpcUrls = [...networkConfig.rpcUrls];
    } else {
      networkConfig.rpcUrls = [working];
    }

    // Create M3SLiFiViemProvider with fresh network config from NetworkHelper
    const viemProvider = await M3SLiFiViemProvider.create(wallet, networkConfig);

    return {
      getWalletClient: () => viemProvider.getWalletClient(),
      switchChain: (chainId: number) => viemProvider.switchChain(chainId)
    };
  }

  async getOperationStatus(operationId: string): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'executeOperation',
      });
    }

    if (!operationId) { // Assuming route.id is the LiFi route ID
      throw new AdapterError("Valid route object with ID must be provided to get status.", {
        code: CrossChainErrorCode.InvalidInput,
        methodName: 'executeOperation',
      });
    }

    try {
      const activeRoute = getActiveRoute(operationId);
      if (!activeRoute) {
        return {
          operationId,
          status: ExecutionStatusEnum.UNKNOWN,
          sourceTx: {},
          statusMessage: 'Operation not found in active LI.FI routes.',
          adapter: {
            name: this.name,
            version: this.version
          },
        };
      }
      return this.translateRouteToStatus(activeRoute);
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error getting status for ${operationId}:`, error);
      return {
        operationId,
        status: ExecutionStatusEnum.UNKNOWN,
        sourceTx: {},
        error: `Failed to get status: ${error.message}`,
        statusMessage: `Failed to get status: ${error.message}`,
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    }
  }

  async cancelOperation(
    operationId: string,
    options: { wallet?: IEVMWallet; reason?: string }
  ): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");

    try {
      // ✅ Create provider on-demand (same as executeOperation)
      if (options.wallet) {
        const tempProvider = await this.createTemporaryViemProvider(options.wallet);
        this._updateLifiSdkConfig(tempProvider);
      }

      const activeRoute = getActiveRoute(operationId);
      if (activeRoute) {
        stopRouteExecution(activeRoute);
        return {
          operationId,
          status: ExecutionStatusEnum.FAILED,
          sourceTx: { chainId: activeRoute.fromChainId },
          destinationTx: { chainId: activeRoute.toChainId },
          error: options.reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
          statusMessage: options.reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
          adapter: {
            name: this.name,
            version: this.version
          },
        };
      } else {
        return {
          operationId,
          status: ExecutionStatusEnum.UNKNOWN,
          sourceTx: {},
          error: 'Cannot cancel: Operation not found in active routes',
          statusMessage: 'Cannot cancel: Operation not found in active routes',
          adapter: {
            name: this.name,
            version: this.version
          },
        };
      }
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error cancelling operation ${operationId}:`, error);
      return {
        operationId,
        status: ExecutionStatusEnum.UNKNOWN,
        sourceTx: {},
        error: `Cancellation failed: ${error.message}`,
        statusMessage: `Cancellation failed: ${error.message}`,
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    }
  }

  private translateRouteToStatus(route: RouteExtended): OperationResult {
    const overallStatus = this.deriveOverallStatus(route);
    let error: string | undefined;
    let statusMessage: string = `Status: ${overallStatus}`;
    let receivedAmount: string | undefined;

    // **FIX 9: Better transaction hash extraction**
    let sourceTxHash: string | undefined;
    let sourceTxExplorerUrl: string | undefined;
    let destTxHash: string | undefined;
    let destTxExplorerUrl: string | undefined;

    // Extract source transaction (first step)
    if (route.steps[0]?.execution?.process) {
      for (const process of route.steps[0].execution.process) {
        if (process.txHash) {
          sourceTxHash = process.txHash;
          sourceTxExplorerUrl = process.txLink;
          break;
        }
      }
    }

    // Extract destination transaction (last step)
    const lastStep = route.steps[route.steps.length - 1];
    if (lastStep?.execution?.process) {
      // Look for destination transaction (not source)
      for (const process of lastStep.execution.process.reverse()) {
        if (process.txHash && process.chainId === route.toChainId) {
          destTxHash = process.txHash;
          destTxExplorerUrl = process.txLink;
          break;
        }
      }
      receivedAmount = (lastStep.execution as Execution)?.toAmount || route.toAmount;
    }

    // Set appropriate status messages
    if (overallStatus === 'FAILED') {
      const failedStep = route.steps.find(step =>
        this.mapLifiStatus(step.execution?.status) === 'FAILED'
      );
      error = failedStep?.execution?.process?.find(p => p.status === 'FAILED')?.error?.message || 'Unknown error in failed step';
      statusMessage = `Operation failed: ${error}`;
    } else if (overallStatus === 'COMPLETED') {
      statusMessage = 'Operation completed successfully.';
    } else if (overallStatus === 'ACTION_REQUIRED') {
      statusMessage = 'Action required by user (check wallet).';
    } else if (overallStatus === 'PENDING') {
      // More specific pending messages
      const executingSteps = route.steps.filter(s =>
        s.execution && ['PENDING', 'STARTED'].includes(s.execution.status || '')
      );
      if (executingSteps.length > 0) {
        statusMessage = `Processing step ${executingSteps.length}/${route.steps.length}...`;
      } else {
        statusMessage = 'Operation in progress...';
      }
    }

    return {
      operationId: route.id,
      status: overallStatus,
      sourceTx: {
        hash: sourceTxHash,
        chainId: route.fromChainId,
        explorerUrl: sourceTxExplorerUrl
      },
      destinationTx: {
        hash: destTxHash,
        chainId: route.toChainId,
        explorerUrl: destTxExplorerUrl
      },
      receivedAmount,
      error,
      statusMessage,
      adapter: {
        name: this.name,
        version: this.version
      },
    };
  }

  private deriveOverallStatus(route: RouteExtended): OperationResult['status'] {
    if (!route.steps || route.steps.length === 0) return ExecutionStatusEnum.PENDING;
    let hasFailed = false, needsAction = false, allDone = true, hasPending = false;
    for (const step of route.steps) {
      const mappedStepStatus = this.mapLifiStatus(step.execution?.status);
      if (mappedStepStatus === 'FAILED') { hasFailed = true; break; }
      if (mappedStepStatus === 'ACTION_REQUIRED') needsAction = true;
      if (mappedStepStatus !== 'COMPLETED') allDone = false;
      if (mappedStepStatus === 'PENDING') hasPending = true;
    }
    if (hasFailed) return ExecutionStatusEnum.FAILED;
    if (needsAction) return ExecutionStatusEnum.ACTION_REQUIRED;
    const allExecuted = route.steps.every(step => step.execution);
    if (allExecuted && allDone) return ExecutionStatusEnum.COMPLETED;
    if (hasPending) return ExecutionStatusEnum.PENDING;
    return ExecutionStatusEnum.PENDING;
  }

  private mapLifiStatus(lifiStatus?: string): OperationResult['status'] {
    switch (lifiStatus) {
      case 'PENDING': case 'STARTED': return ExecutionStatusEnum.PENDING;
      case 'ACTION_REQUIRED': return ExecutionStatusEnum.ACTION_REQUIRED;
      case 'DONE': return ExecutionStatusEnum.COMPLETED;
      case 'FAILED': return ExecutionStatusEnum.FAILED;
      case undefined: return ExecutionStatusEnum.PENDING;
      default: console.warn(`[MinimalLiFiAdapter] Unknown LI.FI status: ${lifiStatus}`); return ExecutionStatusEnum.UNKNOWN;
    }
  }

  async getSupportedChains(): Promise<{ chainId: number; name: string, symbol: string }[]> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'getSupportedChains',
      });
    }
    try {
      const chains: ExtendedChain[] = await getChains({ chainTypes: [ChainType.EVM] });
      return chains.map(chain => ({ chainId: chain.id, name: chain.name, symbol: chain.nativeToken.symbol }));
    } catch (error: any) {
      throw new AdapterError('Failed to get supported chains from LiFi SDK.', {
        cause: error,
        code: CrossChainErrorCode.UnsupportedChain,
        methodName: 'getSupportedChains',
        details: { originalError: error.message }
      });
    }
  }

  async getSupportedTokens(chainId: string): Promise<ChainAsset[]> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'getSupportedTokens',
      });
    } try {
      const response = await getTokens({ chains: [Number(chainId) as ChainId] });
      const tokens = response.tokens[Number(chainId)] || [];
      return tokens.map(token => ({
        chainId: token.chainId.toString(), address: token.address, symbol: token.symbol,
        decimals: token.decimals, name: token.name, logoURI: token.logoURI
      }));
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error fetching tokens for chain ${chainId}:`, error);
      throw new AdapterError(`Failed to get tokens for chain ${chainId} from LiFi SDK.`, {
        cause: error,
        code: CrossChainErrorCode.UnsupportedToken,
        methodName: 'getSupportedTokens',
        details: { chainId, originalError: error.message }
      });
    }
  }

  async getGasOnDestination(intent: OperationIntent): Promise<{ amount: string, usdValue: string }> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    try {
      const gasRecommendation = await getGasRecommendation({
        chainId: Number(intent.destinationAsset.chainId),
        fromChain: Number(intent.sourceAsset.chainId),
        fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000'
      });
      return {
        amount: gasRecommendation.recommended?.amount || '0',
        usdValue: gasRecommendation.recommended?.amountUsd || '0'
      };
    } catch (error: any) {
      console.error("[MinimalLiFiAdapter] Error getting gas recommendation:", error);
      return { amount: '0', usdValue: '0' };
    }
  }

  async resumeOperation(
    operationId: string,
    options: { wallet?: IEVMWallet }
  ): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'resumeOperation',
      });
    }

    try {
      // ✅ Create provider on-demand (same as executeOperation)
      if (options.wallet) {
        const tempProvider = await this.createTemporaryViemProvider(options.wallet);
        this._updateLifiSdkConfig(tempProvider);
      }

      const activeRoute = getActiveRoute(operationId);
      if (!activeRoute) {
        return this.getOperationStatus(operationId); // Check last known status
      }
      resumeRoute(activeRoute);
      return {
        operationId: activeRoute.id,
        status: ExecutionStatusEnum.PENDING,
        sourceTx: { chainId: activeRoute.fromChainId },
        destinationTx: { chainId: activeRoute.toChainId },
        statusMessage: 'Resumption initiated via LI.FI SDK.',
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error resuming operation ${operationId}:`, error);
      return {
        operationId,
        status: ExecutionStatusEnum.FAILED,
        sourceTx: {},
        destinationTx: {},
        error: `Resume failed: ${error.message}`,
        statusMessage: `Resume failed: ${error.message}`,
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    }
  }

  async checkForTimedOutOperations(): Promise<void> {
    console.log("[MinimalLiFiAdapter] checkForTimedOutOperations called (No-op)");
  }
}