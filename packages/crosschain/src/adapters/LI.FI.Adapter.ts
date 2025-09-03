import { AdapterArguments, AdapterError, CrossChainErrorCode, NetworkHelper } from '@m3s/shared';
import { M3SLiFiViemProvider, sanitizeBigInts } from '../helpers/ProviderHelper.js';
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
  stopRouteExecution,
  LiFiStep,
  Execution,
  resumeRoute,
  ExtendedChain
} from '@lifi/sdk';
import { IEVMWallet } from '@m3s/wallet';
import { WalletClient } from 'viem';
import { EventEmitter } from 'eventemitter3';
import { ethers } from 'ethers';

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
  private activeOperations: Map<string, Promise<OperationResult>> = new Map();
  private operationStatusMap: Map<string, OperationResult> = new Map();


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

  private async createTemporaryViemProvider(wallet: IEVMWallet): Promise<{
    getWalletClient: () => Promise<WalletClient>;
    switchChain: (chainId: number) => Promise<WalletClient>;
  }> {
    const current = await wallet.getNetwork();
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();

    const allWalletRpcs = wallet.getAllChainRpcs();
    const preferredRpcs = allWalletRpcs[current.chainId] || allWalletRpcs[String(current.chainId)] || [];

    const networkConfig = await networkHelper.getNetworkConfig(
      current.chainId,
      preferredRpcs
    );

    if (!networkConfig) {
      throw new AdapterError(
        `No RPC available for chain ${current.chainId}`,
        { code: CrossChainErrorCode.UnsupportedChain, methodName: 'createTemporaryViemProvider' }
      );
    }

    const viemProv = await M3SLiFiViemProvider.create(
      wallet,
      networkConfig,
    );

    return {
      getWalletClient: () => viemProv.getWalletClient(),
      switchChain: (chainId: number) => viemProv.switchChain(chainId),
    };
  }

  private translateRouteToStatus(route: RouteExtended): OperationResult {

    const overallStatus = this.deriveOverallStatus(route);
    let error: string | undefined;
    let statusMessage: string = `Status: ${overallStatus}`;
    let receivedAmount: string | undefined;

    let sourceTxHash: string | undefined;
    let sourceTxExplorerUrl: string | undefined;
    let destTxHash: string | undefined;
    let destTxExplorerUrl: string | undefined;
    let safeRoute: RouteExtended;

    try {
      safeRoute = JSON.parse(
        JSON.stringify(route, (_key, val) =>
          typeof val === 'bigint' ? val.toString() : val
        )
      );
    } catch {
      safeRoute = route;
    }
    if (safeRoute.steps[0]?.execution?.process) {
      for (const process of safeRoute.steps[0].execution.process) {
        if (process.txHash) {
          sourceTxHash = process.txHash;
          sourceTxExplorerUrl = process.txLink;
          break;
        }
      }
    }

    const lastStep = safeRoute.steps[safeRoute.steps.length - 1];
    if (lastStep?.execution?.process) {
      for (const process of lastStep.execution.process.reverse()) {
        if (process.txHash && process.chainId === safeRoute.toChainId) {
          destTxHash = process.txHash;
          destTxExplorerUrl = process.txLink;
          break;
        }
      }
      receivedAmount = (lastStep.execution as Execution)?.toAmount || safeRoute.toAmount;
    }

    if (sourceTxHash && receivedAmount && parseFloat(receivedAmount) > 0) {
      if (safeRoute.fromChainId === safeRoute.toChainId) {
        return {
          operationId: safeRoute.id,
          status: ExecutionStatusEnum.COMPLETED,
          sourceTx: {
            hash: sourceTxHash,
            chainId: safeRoute.fromChainId,
            explorerUrl: sourceTxExplorerUrl
          },
          destinationTx: {
            hash: sourceTxHash,
            chainId: safeRoute.toChainId,
            explorerUrl: sourceTxExplorerUrl
          },
          receivedAmount,
          statusMessage: 'Operation completed successfully.',
          adapter: {
            name: this.name,
            version: this.version
          },
        };
      }
    }

    const hasCompletionMarkers = safeRoute.steps.every(step => {
      if (!step.execution) return false;
      return step.execution.status === 'DONE' ||
        (step.execution.process && step.execution.process.some(p => p.status === 'DONE'));
    });

    if (hasCompletionMarkers && receivedAmount) {
      return {
        operationId: safeRoute.id,
        status: ExecutionStatusEnum.COMPLETED,
        sourceTx: {
          hash: sourceTxHash,
          chainId: safeRoute.fromChainId,
          explorerUrl: sourceTxExplorerUrl
        },
        destinationTx: {
          hash: destTxHash || sourceTxHash,
          chainId: safeRoute.toChainId,
          explorerUrl: destTxExplorerUrl || sourceTxExplorerUrl
        },
        receivedAmount,
        statusMessage: 'Operation completed successfully.',
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    }

    if (overallStatus === 'FAILED') {
      const failedStep = safeRoute.steps.find(step =>
        this.mapLifiStatus(step.execution?.status) === 'FAILED'
      );
      error = failedStep?.execution?.process?.find(p => p.status === 'FAILED')?.error?.message || 'Unknown error in failed step';
      statusMessage = `Operation failed: ${error}`;
    } else if (overallStatus === 'COMPLETED') {
      statusMessage = 'Operation completed successfully.';
    } else if (overallStatus === 'ACTION_REQUIRED') {
      statusMessage = 'Action required by user (using m3s wallet...)';
    } else if (overallStatus === 'PENDING') {
      const executingSteps = safeRoute.steps.filter(s =>
        s.execution && ['PENDING', 'STARTED'].includes(s.execution.status || '')
      );
      if (executingSteps.length > 0) {
        statusMessage = `Processing step ${executingSteps.length}/${safeRoute.steps.length}...`;
      } else {
        statusMessage = 'Operation in progress...';
      }
    }

    return {
      operationId: safeRoute.id,
      status: overallStatus,
      sourceTx: {
        hash: sourceTxHash,
        chainId: safeRoute.fromChainId,
        explorerUrl: sourceTxExplorerUrl
      },
      destinationTx: {
        hash: destTxHash || sourceTxHash,
        chainId: safeRoute.toChainId,
        explorerUrl: destTxExplorerUrl || sourceTxExplorerUrl
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

  private async validateRpcReliability(
    rpcUrls: string[],
    chainId: number,
    operationType: 'quote' | 'execution'
  ): Promise<{ isReliable: boolean; recommendedAction?: string; details: any }> {
    const results = await Promise.allSettled(
      rpcUrls.map(async (url) => {
        const start = Date.now();
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_chainId',
              params: [],
              id: 1
            }),
            signal: AbortSignal.timeout(5000)
          });

          const latency = Date.now() - start;
          const data = await response.json();

          if (data.error) {
            return { url, status: 'error', error: data.error, latency };
          }

          const returnedChainId = parseInt(data.result, 16);
          if (returnedChainId !== chainId) {
            return { url, status: 'chain_mismatch', expected: chainId, got: returnedChainId, latency };
          }

          if (operationType === 'execution') {
            const gasTest = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_estimateGas',
                params: [{ to: "0x0000000000000000000000000000000000000000", value: "0x0" }],
                id: 2
              })
            });

            const gasData = await gasTest.json();
            if (gasData.error && gasData.error.code !== -32000) { 
              return { url, status: 'gas_estimation_failed', error: gasData.error, latency };
            }
          }

          return {
            url,
            status: 'healthy',
            latency,
            isPrivate: this.isPrivateRpc(url),
            score: this.calculateRpcScore(latency, url)
          };

        } catch (error: any) {
          return { url, status: 'network_error', error: error.message, latency: Date.now() - start };
        }
      })
    );

    const healthyRpcs = results
      .filter(r => r.status === 'fulfilled' && r.value.status === 'healthy')
      .map((r: any) => r.value);

    const hasPrivateRpc = healthyRpcs.some(rpc => rpc.isPrivate);
    const bestRpc = healthyRpcs.sort((a, b) => b.score - a.score)[0];

    if (healthyRpcs.length === 0) {
      return {
        isReliable: false,
        recommendedAction: "All RPCs failed validation. Please check network connectivity or use alternative RPC endpoints.",
        details: { results, healthyCount: 0 }
      };
    }

    if (operationType === 'execution' && !hasPrivateRpc && bestRpc?.latency > 2000) {
      return {
        isReliable: false,
        recommendedAction: "High-value bridge operation detected with slow public RPC. Consider using a private RPC service (Infura, Alchemy, etc.) for better reliability.",
        details: { results, healthyCount: healthyRpcs.length, bestLatency: bestRpc?.latency }
      };
    }

    if (healthyRpcs.length === 1 && operationType === 'execution') {
      return {
        isReliable: true,
        recommendedAction: "Only one RPC available for execution. Consider adding backup RPCs for redundancy.",
        details: { results, healthyCount: healthyRpcs.length }
      };
    }

    return {
      isReliable: true,
      details: { results, healthyCount: healthyRpcs.length, bestRpc }
    };
  }

  private isPrivateRpc(url: string): boolean {
    return /infura\.io|alchemy\.com|quicknode\.com|moralis\.io|getblock\.io/.test(url);
  }

  private calculateRpcScore(latency: number, url: string): number {
    let score = 100 - (latency / 50);
    if (this.isPrivateRpc(url)) score += 20;
    return Math.max(0, score);
  }

  async initialize(): Promise<void> {
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

    if (configUpdate.options !== undefined) {
      this.args.options = { ...this.args.options, ...configUpdate.options };
    }

    this._updateLifiSdkConfig();
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

    this.validateAmountFormat(intent.amount, intent.sourceAsset.symbol);
    try {
      const fromAmountInWei = ethers.parseUnits(
        intent.amount,
        intent.sourceAsset.decimals || 18
      ).toString();

      const quoteRequest: QuoteRequest = {
        fromChain: Number(intent.sourceAsset.chainId),
        fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000',
        fromAddress: intent.userAddress,
        fromAmount: fromAmountInWei,
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

      const feeUSD = quoteStep.estimate.feeCosts
        ? quoteStep.estimate.feeCosts.reduce((sum, fee) => sum + parseFloat(fee.amountUSD || '0'), 0).toString()
        : '0';

      const firstGasCost = quoteStep.estimate.gasCosts?.[0];
      const gasCosts = firstGasCost ? {
        limit: firstGasCost.limit || '',
        amount: firstGasCost.amount || '',
        amountUSD: firstGasCost.amountUSD || '0'
      } : undefined;

      const operationQuote: OperationQuote = {
        id: quoteStep.id,
        intent: intent,
        gasCosts,
        feeUSD,
        adapter: {
          name: this.name,
          version: this.version
        },
        adapterQuote: quoteStep,
      };

      return [operationQuote];

    } catch (error: any) {
      if (error instanceof AdapterError) throw error;

      const originalErrorMessage = error instanceof Error ? error.message : String(error);

      const isNoQuotesError = originalErrorMessage.includes('No available quotes for the requested transfer') ||
        (error.status === 404 && originalErrorMessage.includes('Not Found')) || 
        (error.cause as any)?.response?.status === 404 && (error.cause as any)?.responseBody?.message?.includes('No available quotes');

      if (isNoQuotesError) {
        console.warn(`[getOperationQuote] LiFi SDK found no available quotes for the request. Returning empty array. Details: ${originalErrorMessage}`);
        return [];
      }

      throw new AdapterError(`Failed to get operation quote from LiFi SDK: ${originalErrorMessage}`, {
        cause: error,
        code: CrossChainErrorCode.QuoteFailed,
        methodName: 'getOperationQuote',
        details: { intent, originalError: originalErrorMessage }
      });
    }
  }

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

    const sourceChainId = Number(quote.intent.sourceAsset.chainId);
    const destChainId = Number(quote.intent.destinationAsset.chainId);

    const chainIds = sourceChainId === destChainId ? [sourceChainId] : [sourceChainId, destChainId];

    const walletRpcs = options.wallet.getAllChainRpcs();
    const networkHelper = NetworkHelper.getInstance();

    const rpcValidation = networkHelper.validatePrivateRpcsForChains(chainIds, walletRpcs);

    if (!rpcValidation.hasAllPrivateRpcs) {
      throw new AdapterError(
        `Private RPCs required for reliable bridge operations. Missing chains: ${rpcValidation.missingChains.join(', ')}. Please use wallet.updateAllChainRpcs() to configure private RPC endpoints.`,
        {
          code: CrossChainErrorCode.RpcValidationFailed,
          methodName: 'executeOperation',
          details: { missingChains: rpcValidation.missingChains }
        }
      );
    }

    await networkHelper.ensureInitialized();

    const sourceConfig = await networkHelper.getNetworkConfig(sourceChainId);
    if (!sourceConfig) {
      throw new AdapterError(
        `No network configuration found for source chain ${sourceChainId}`,
        {
          code: CrossChainErrorCode.UnsupportedChain,
          methodName: 'executeOperation',
          details: { chainId: sourceChainId }
        }
      );
    }

    const sourceRpcValidation = await this.validateRpcReliability(
      sourceConfig.rpcUrls,
      sourceChainId,
      'execution'
    );

    if (!sourceRpcValidation.isReliable) {
      throw new AdapterError(
        `Source chain RPC validation failed: ${sourceRpcValidation.recommendedAction}`,
        {
          code: CrossChainErrorCode.RpcValidationFailed,
          methodName: 'executeOperation',
          details: {
            chainId: sourceChainId,
            validation: sourceRpcValidation.details
          }
        }
      );
    }

    if (destChainId !== sourceChainId) {
      const destConfig = await networkHelper.getNetworkConfig(destChainId);
      if (!destConfig) {
        throw new AdapterError(
          `No network configuration found for destination chain ${destChainId}`,
          {
            code: CrossChainErrorCode.UnsupportedChain,
            methodName: 'executeOperation',
            details: { chainId: destChainId }
          }
        );
      }

      const destRpcValidation = await this.validateRpcReliability(
        destConfig.rpcUrls,
        destChainId,
        'execution'
      );

      if (!destRpcValidation.isReliable) {
        throw new AdapterError(
          `Destination chain RPC validation failed: ${destRpcValidation.recommendedAction}`,
          {
            code: CrossChainErrorCode.RpcValidationFailed,
            methodName: 'executeOperation',
            details: {
              chainId: destChainId,
              validation: destRpcValidation.details
            }
          }
        );
      }
    }

    if (sourceRpcValidation.recommendedAction) {
      console.warn(`[RPC Advisory] ${sourceRpcValidation.recommendedAction}`);
    }

    const step = quote.adapterQuote as LiFiStep | undefined;
    if (!step?.id || !step.action || !step.estimate) {
      throw new AdapterError("Invalid or incomplete quote provided for execution.", {
        code: CrossChainErrorCode.InvalidInput,
        methodName: 'executeOperation'
      });
    }

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

    this.operationStatusMap.set(quote.id, pending);


    try {
      const rawRoute = await convertQuoteToRoute(quote.adapterQuote as LiFiStep);
      const route = sanitizeBigInts(rawRoute);

      console.log('🎯 [LI.FI ADAPTER] Route created:', route.id);

      this.emit('status', pending);

      let finalStatusPromise: Promise<OperationResult>;

      const completionPromise = new Promise<OperationResult>((resolve, reject) => {
        let lastStatus: OperationResult = pending;

        const executeWithHook = async () => {
          try {
            await executeRoute(route, {
              updateRouteHook: (r: RouteExtended) => {
                console.log(`🔥 [LI.FI HOOK] Hook called for route ${r.id}`);

                const cleanRoute = sanitizeBigInts(r);
                const statusUpdate = this.translateRouteToStatus(cleanRoute);

                console.log(`🔥 [LI.FI HOOK] Status: ${statusUpdate.status}`);

                lastStatus = statusUpdate;
                this.operationStatusMap.set(quote.id, statusUpdate);
                this.emit('status', statusUpdate);

                if (statusUpdate.status === 'COMPLETED' || statusUpdate.status === 'FAILED') {
                  console.log(`🎉 [LI.FI HOOK] Terminal status: ${statusUpdate.status} - resolving!`);
                  resolve(statusUpdate);
                }
              }
            });

            console.log('🎯 [LI.FI ADAPTER] executeRoute completed');

            if (!['COMPLETED', 'FAILED'].includes(lastStatus.status)) {
              console.warn('🚨 [LI.FI ADAPTER] executeRoute completed but no terminal status received');
              const finalCheck = getActiveRoute(route.id);
              if (finalCheck) {
                const finalStatus = this.translateRouteToStatus(sanitizeBigInts(finalCheck));
                this.operationStatusMap.set(quote.id, finalStatus);
                this.emit('status', finalStatus);
                resolve(finalStatus);
              } else {
                const completedStatus: OperationResult = {
                  ...lastStatus,
                  status: ExecutionStatusEnum.COMPLETED,
                  statusMessage: 'Operation completed (inferred from successful execution)'
                };
                this.operationStatusMap.set(quote.id, completedStatus);
                this.emit('status', completedStatus);
                resolve(completedStatus);
              }
            }
          } catch (error: any) {
            const failedStatus: OperationResult = {
              ...lastStatus,
              status: ExecutionStatusEnum.FAILED,
              error: error.message,
              statusMessage: `Operation failed: ${error.message}`
            };
            this.operationStatusMap.set(quote.id, failedStatus);
            this.emit('status', failedStatus);
            reject(failedStatus);
          }
        };

        executeWithHook();
      });

      finalStatusPromise = completionPromise;

      this.activeOperations.set(quote.id, finalStatusPromise);

      return pending;

    } catch (err: any) {
      const failed: OperationResult = {
        operationId: quote.id,
        status: ExecutionStatusEnum.FAILED,
        statusMessage: err.message,
        adapter: { name: this.name, version: this.version },
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        error: err.message,
      };
      this.operationStatusMap.set(quote.id, failed);
      this.emit('status', failed);
      return failed;
    }
  }

  async getOperationStatus(operationId: string): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'getOperationStatus',
      });
    }

    const latestStatus = this.operationStatusMap.get(operationId);
    if (latestStatus) {
      return latestStatus;
    }

    try {
      const activeRoute = getActiveRoute(operationId);
      if (activeRoute) {
        const status = this.translateRouteToStatus(sanitizeBigInts(activeRoute));
        this.operationStatusMap.set(operationId, status); // <-- STORE STATUS
        return status;
      }
    } catch (error) {
      console.warn(`[MinimalLiFiAdapter] Error checking active route for ${operationId}:`, error);
    }

    return {
      operationId,
      status: ExecutionStatusEnum.UNKNOWN,
      sourceTx: {},
      statusMessage: 'Operation not found in adapter cache or active LI.FI routes.',
      adapter: { name: this.name, version: this.version },
    };
  }
  

  async cancelOperation(
    operationId: string,
    options: { wallet?: IEVMWallet; reason?: string }
  ): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");

    try {
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
      if (options.wallet) {
        const tempProvider = await this.createTemporaryViemProvider(options.wallet);
        this._updateLifiSdkConfig(tempProvider);
      }

      const activeRoute = getActiveRoute(operationId);
      if (!activeRoute) {
        return this.getOperationStatus(operationId);
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

  private validateAmountFormat(amount: string, assetSymbol: string): void {
    const numericAmount = parseFloat(amount);

    if (numericAmount > 1000000) {
      throw new AdapterError(
        `Amount ${amount} for ${assetSymbol} appears to be in wei units. ` +
        `Please use human-readable amounts (e.g., '0.1' for 0.1 ${assetSymbol}).`,
        {
          code: CrossChainErrorCode.InvalidInput,
          methodName: 'validateAmountFormat',
          details: { amount, assetSymbol, suggestion: 'Use ETH units like "0.1" instead of wei' }
        }
      );
    }

    if (numericAmount <= 0) {
      throw new AdapterError(
        `Amount must be positive, got: ${amount}`,
        {
          code: CrossChainErrorCode.InvalidInput,
          methodName: 'validateAmountFormat'
        }
      );
    }
  }
}