
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
  Process,
  Execution,
  resumeRoute,
  ExtendedChain
} from '@lifi/sdk';
import { M3SLiFiViemProvider, ICrossChain, OperationIntent, OperationQuote, OperationResult, ExecutionStatusEnum, ChainAsset, AdapterArguments, AdapterError, CrossChainErrorCode  } from '@m3s/crosschain';

export interface ILiFiAdapterOptionsV1 {
  provider?: M3SLiFiViemProvider;
  apiKey?: string;
}

interface args extends AdapterArguments<ILiFiAdapterOptionsV1> { 
  name:string,
  version:string,
  options: ILiFiAdapterOptionsV1
}

/**
 * Minimal Adapter for LI.FI cross-chain operations.
 * Focuses on core functionality: quote, execute, status check.
 * Removes internal tracking, advanced confirmation, timeouts, caching.
 */
export class MinimalLiFiAdapter implements ICrossChain {
  public readonly name: string;
  public readonly version: string;

  private initialized: boolean = false;
  private m3sViemProvider?: M3SLiFiViemProvider;
  private args: args;

  /**
   * Private constructor - use static create method
   */
  private constructor(initialArgs: args) {
    this.name = initialArgs.name
    this.version = initialArgs.version

    // Store a deep copy of initialArgs.
    this.args = JSON.parse(JSON.stringify(initialArgs));
    // Ensure options is an object, even if initialArgs didn't have it or it was null/undefined.
    // This makes subsequent accesses like this.args.options.provider safer.
    this.args.options = this.args.options || {};
    // DO NOT set this.m3sViemProvider here. Defer to initialize.
  }

  private _updateLifiSdkConfig(): void {
    const sdkConfig: any = {
      integrator: 'm3s-minimal',
      apiKey: this.args.options?.apiKey,
    };

    if (this.m3sViemProvider) {
      sdkConfig.providers = [
        EVM({
          getWalletClient: async () => {
            if (!this.m3sViemProvider) throw new AdapterError("M3S Viem Provider not set for getWalletClient.");
            return this.m3sViemProvider.getWalletClient();
          },
          switchChain: async (chainId: number) => {
            if (!this.m3sViemProvider) throw new AdapterError("M3S Viem Provider not set for switchChain.");
            return this.m3sViemProvider.switchChain(chainId);
          }
        }),
      ];
      console.log(`[MinimalLiFiAdapter._updateLifiSdkConfig] Li.Fi SDK to be configured with provider. API Key: ${this.args.options?.apiKey ? 'Set' : 'Not Set'}`);
    } else {
      console.log(`[MinimalLiFiAdapter._updateLifiSdkConfig] Li.Fi SDK to be configured with API key only (No provider). API Key: ${this.args.options?.apiKey ? 'Set' : 'Not Set'}`);
    }
    createConfig(sdkConfig);
    console.log("[MinimalLiFiAdapter._updateLifiSdkConfig] LiFi createConfig called.");
  }

  static async create(initialCreationArgs: args): Promise<MinimalLiFiAdapter> {
    const adapter = new MinimalLiFiAdapter(initialCreationArgs);
    // Call initialize with the full initial arguments to process them and configure the SDK.
    await adapter.initialize(initialCreationArgs);
    if (!initialCreationArgs.options?.provider && !initialCreationArgs.options?.apiKey) {
      console.log('[MinimalLiFiAdapter.create] Adapter instance created and initialized with no initial API key or execution provider. SDK may use defaults.');
    }
    return adapter;
  }

  async initialize(configToApply: Partial<args>): Promise<void> {
    try {
      const oldApiKey = this.args.options?.apiKey;
      const oldProviderInstance = this.m3sViemProvider;

      // Merge configToApply into this.args to reflect the new desired state
      if (configToApply.name && configToApply.name !== this.args.name) {
        this.args.name = configToApply.name;
      }
      if (configToApply.options !== undefined) { // Check if 'options' key itself is present
        // Ensure this.args.options is an object before spreading
        this.args.options = { ...(this.args.options || {}), ...configToApply.options };
      }
      // ... merge other top-level properties from 'args' if they exist and are mutable ...

      // Now, this.args reflects the complete desired configuration.
      // Set the internal provider state based on the (potentially updated) this.args.options
      this.m3sViemProvider = this.args.options?.provider;

      let needsSdkUpdate = false;

      // Check for API key changes
      if (this.args.options?.apiKey !== oldApiKey) {
        console.log(`[MinimalLiFiAdapter.initialize] API key ${this.args.options?.apiKey ? 'set/updated' : 'removed/unchanged'}.`);
        needsSdkUpdate = true;
      }

      // Check for provider changes
      if (this.m3sViemProvider !== oldProviderInstance) {
        console.log(`[MinimalLiFiAdapter.initialize] M3SLiFiViemProvider instance ${this.m3sViemProvider ? 'set/updated' : 'removed/unchanged'}.`);
        needsSdkUpdate = true;
      }

      // Reconfigure SDK if it's the first initialization or if critical settings changed
      if (!this.initialized || needsSdkUpdate) {
        console.log(`[MinimalLiFiAdapter.initialize] Triggering Li.Fi SDK config update. Initialized previously: ${this.initialized}, Needs SDK Update: ${needsSdkUpdate}`);
        this._updateLifiSdkConfig(); // This method already throws AdapterError
      } else {
        console.log("[MinimalLiFiAdapter.initialize] No changes requiring SDK config update.");
      }

      this.initialized = true; // This is where the adapter is marked as initialized
      console.log(`[MinimalLiFiAdapter.initialize] Process complete. Initialized: ${this.initialized}, HasProvider: ${!!this.m3sViemProvider}, APIKeySet: ${!!this.args.options?.apiKey}`);
    } catch (error: any) {
      if (error instanceof AdapterError) throw error; // Re-throw if already an AdapterError
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        cause: error,
        code: CrossChainErrorCode.AdapterNotInitialized, // Or a more specific crosschain error code
        methodName: 'initialize',
        details: { message: error.message }
      });
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  hasExecutionProvider(): boolean {
    return !!this.m3sViemProvider;
  }

  async setExecutionProvider(provider: M3SLiFiViemProvider): Promise<void> {
    console.log(`[MinimalLiFiAdapter.setExecutionProvider] Attempting to set execution provider.`);
    if (this.m3sViemProvider === provider) {
      console.log(`[MinimalLiFiAdapter.setExecutionProvider] Provider is already set to the given instance.`);
      return;
    }

    this.m3sViemProvider = provider;
    this.args.options = { ...this.args.options, provider }; // Update internal args

    if (this.initialized) {
      // If already initialized, an SDK update might be needed
      console.log(`[MinimalLiFiAdapter.setExecutionProvider] Execution provider updated. Triggering SDK config update.`);
      try {
        this._updateLifiSdkConfig();
      } catch (error: any) {
        if (error instanceof AdapterError) throw error;
        throw new AdapterError('Failed to update LiFi SDK config after setting execution provider.', {
          cause: error,
          code: CrossChainErrorCode.ProviderSetFailed,
          methodName: 'setExecutionProvider',
        });
      }
    } else {
      console.log(`[MinimalLiFiAdapter.setExecutionProvider] Execution provider set. SDK will be configured on initialize.`);
    }
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
        name: this.name,
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

  async executeOperation(
    quote: OperationQuote,
    onStatusUpdate?: (route: RouteExtended) => void
  ): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'executeOperation',
      });
    }
    if (!this.hasExecutionProvider()) {
      throw new AdapterError("Execution provider not set. Cannot execute operation.", {
        code: CrossChainErrorCode.ProviderSetFailed, // Or a specific CrossChainErrorCode.EXECUTION_PROVIDER_MISSING
        methodName: 'executeOperation',
      });
    }

    const step = quote.adapterQuote as LiFiStep | undefined;
    if (!step?.id || !step.action || !step.estimate) {
      throw new AdapterError("Invalid or incomplete quote provided for execution.", {
        code: CrossChainErrorCode.InvalidInput,
        methodName: 'executeOperation',
        details: { quoteId: quote?.id, hasRoute: !!quote?.intent }
      });
    }

    try {
      const route = await convertQuoteToRoute(step);
      executeRoute(route, { updateRouteHook: onStatusUpdate })
        .catch((err) => {
          console.error("[MinimalLiFiAdapter] execution failed:", err);
          // forward a final FAILED update so your client hook sees it
          if (onStatusUpdate) {
            onStatusUpdate({
              ...route,
              id: route.id,
              // LiFi will already mark the last step as FAILED,
              // your monitor.translateRouteToStatus should pick that up.
              steps: route.steps,
            } as RouteExtended);
          }
        });
      return {
        operationId: route.id,
        status: ExecutionStatusEnum.PENDING,
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        statusMessage: 'Execution initiated via LI.FI SDK.',
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    } catch (error: any) {
      console.error("[MinimalLiFiAdapter] Error executing operation:", error);
      return {
        operationId: step.id || `failed-op-${Date.now()}`,
        status: ExecutionStatusEnum.FAILED,
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        error: `Execution failed: ${error.message}`,
        statusMessage: `Execution failed: ${error.message}`,
        adapter: {
          name: this.name,
          version: this.version
        },
      };
    }
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

  async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    try {
      const activeRoute = getActiveRoute(operationId);
      if (activeRoute) {
        stopRouteExecution(activeRoute);
        return {
          operationId,
          status: ExecutionStatusEnum.FAILED,
          sourceTx: { chainId: activeRoute.fromChainId },
          destinationTx: { chainId: activeRoute.toChainId },
          error: reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
          statusMessage: reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
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
    const sourceProcess = route.steps[0]?.execution?.process?.find((p: Process) => !!p.txHash);
    let destTxHash: string | undefined;
    let destTxExplorerUrl: string | undefined;
    const lastStep = route.steps[route.steps.length - 1];
    if (lastStep?.execution) {
      receivedAmount = (lastStep.execution as Execution)?.toAmount || route.toAmount;
      const destProcess = lastStep.execution.process?.slice().reverse().find(p => !!p.txHash && p.chainId === route.toChainId);
      destTxHash = destProcess?.txHash;
      destTxExplorerUrl = destProcess?.txLink;
    }
    if (overallStatus === 'FAILED') {
      const failedStep = route.steps.find(step => this.mapLifiStatus(step.execution?.status) === 'FAILED');
      error = failedStep?.execution?.process?.find(p => p.status === 'FAILED')?.error?.message || 'Unknown error in failed step';
      statusMessage = `Operation failed: ${error}`;
    } else if (overallStatus === 'COMPLETED') {
      statusMessage = 'Operation completed successfully.';
    } else if (overallStatus === 'ACTION_REQUIRED') {
      statusMessage = 'Action required by user (check wallet).';
    } else if (overallStatus === 'PENDING') {
      statusMessage = 'Operation in progress...';
    }
    return {
      operationId: route.id,
      status: overallStatus,
      sourceTx: { hash: sourceProcess?.txHash, chainId: route.fromChainId, explorerUrl: sourceProcess?.txLink },
      destinationTx: { hash: destTxHash, chainId: route.toChainId, explorerUrl: destTxExplorerUrl },
      receivedAmount: receivedAmount, error: error, statusMessage: statusMessage, adapter: {
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
      case 'FAILED':  return ExecutionStatusEnum.FAILED;
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

  async resumeOperation(operationId: string): Promise<OperationResult> {
    if (!this.initialized) {
      throw new AdapterError(`Initialization failed for MinimalLiFiAdapter`, {
        code: CrossChainErrorCode.AdapterNotInitialized,
        methodName: 'resumeOperation',
      });
    }
    if (!this.m3sViemProvider) {
      throw new AdapterError(`Execution provider required for resume`, {
        code: CrossChainErrorCode.ProviderSetFailed,
        methodName: 'resumeOperation',
      });
    }

    try {
      const activeRoute = getActiveRoute(operationId);
      if (!activeRoute) {
        return this.getOperationStatus(operationId); // Check last known status
      }
      resumeRoute(activeRoute);
      return {
        operationId: activeRoute.id, status: ExecutionStatusEnum.PENDING,
        sourceTx: { chainId: activeRoute.fromChainId }, destinationTx: { chainId: activeRoute.toChainId },
        statusMessage: 'Resumption initiated via LI.FI SDK.', adapter: {
          name: this.name,
          version: this.version
        },
      };
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error resuming operation ${operationId}:`, error);
      return {
        operationId, status: ExecutionStatusEnum.FAILED, sourceTx: {}, destinationTx: {},
        error: `Resume failed: ${error.message}`, statusMessage: `Resume failed: ${error.message}`,
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