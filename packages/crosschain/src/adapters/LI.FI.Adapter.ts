import {
  ICrossChain,
  OperationIntent,
  OperationQuote,
  OperationResult,
  ChainAsset,
  TransactionConfirmationHandler // Keep for basic provider config if needed
} from '../types/interfaces/index.js';
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
  resumeRoute
} from '@lifi/sdk';
import { IEVMWallet } from '@m3s/wallet'; // Still needed for type hints potentially

/**
 * Interface for LI.FI execution provider
 * Abstraction over any wallet implementation that can execute transactions
 */
export interface LiFiExecutionProvider {
  address: any;
  walletClient: any;
  signTransaction: (tx: any) => Promise<string>;
  switchChain: (chainId: number) => Promise<any>;
}

/**
 * Base configuration for the LI.FI adapter (read-only operations)
 */
export interface LiFiConfig {
  apiKey?: string;
  apiUrl?: string;
  provider?: LiFiExecutionProvider;
  confirmationHandler?: TransactionConfirmationHandler;
  confirmationTimeout?: number; // Timeout in milliseconds for confirmation
  pendingOperationTimeout?: number; // Auto-cancel pending operations after this time (ms)
}

/**
 * LI.FI adapter configuration arguments
 */
export interface LiFiAdapterArgs {
  adapterName: string;
  config?: LiFiConfig;
  options?: any;
}
/**
 * Minimal Adapter for LI.FI cross-chain operations.
 * Focuses on core functionality: quote, execute, status check.
 * Removes internal tracking, advanced confirmation, timeouts, caching.
 */
export class MinimalLiFiAdapter implements ICrossChain {
  private apiKey?: string;
  private initialized: boolean = false;
  private executionProvider?: LiFiExecutionProvider;

  /**
   * Private constructor - use static create method
   */
  private constructor(args: LiFiAdapterArgs) {
    this.apiKey = args.config?.apiKey;
  }

  /**
   * Factory method to create an instance of MinimalLiFiAdapter
   */
  static async create(args: { adapterName: string, config?: LiFiConfig }): Promise<MinimalLiFiAdapter> {
    const adapter = new MinimalLiFiAdapter(args);
    if (args.config) {
      await adapter.initialize(args.config);
    }
    return adapter;
  }

  /**
   * Initializes the adapter (minimal setup)
   */
  async initialize(config: LiFiConfig): Promise<void> {
    if (this.initialized) return;
    console.log("[MinimalLiFiAdapter] Initializing...");

    this.apiKey = config.apiKey || this.apiKey;

    // Basic SDK config (API key only initially)
    createConfig({
      integrator: 'm3s-minimal', // Use a distinct integrator name
      apiKey: this.apiKey,
      // Providers added later in setExecutionProvider
    });

    this.initialized = true;
    console.log("[MinimalLiFiAdapter] Initialized.");

    // Set provider if provided during init
    if (config.provider) {
      await this.setExecutionProvider(config.provider);
    }
  }

  /**
   * Checks if the adapter has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Sets the execution provider and configures the LI.FI SDK
   */
  async setExecutionProvider(provider: LiFiExecutionProvider): Promise<void> {
    if (!this.initialized) {
      throw new Error("MinimalLiFiAdapter not initialized");
    }
    console.log(`[MinimalLiFiAdapter] Setting execution provider: ${provider.address}`);
    this.executionProvider = provider;

    // Re-configure SDK with the EVM provider
    createConfig({
      integrator: 'm3s-minimal',
      apiKey: this.apiKey,
      providers: [
        EVM({
          getWalletClient: async () => {
            // Directly return the wallet client from the provider
            if (!this.executionProvider?.walletClient) {
              throw new Error("Execution provider's walletClient is not set.");
            }
            return this.executionProvider.walletClient;
          },
          switchChain: async (chainId: number): Promise<any> => {
            console.log(`[MinimalLiFiAdapter] Requesting chain switch to ${chainId}`);
            if (!this.executionProvider?.switchChain) {
              throw new Error("Execution provider does not support switchChain.");
            }
            try {
              // Delegate entirely to the provided switchChain function
              // <<< REMOVE unused switchedProvider assignment >>>
              // const switchedProvider = await this.executionProvider.switchChain(chainId);
              await this.executionProvider.switchChain(chainId); // Await the switch
              console.log(`[MinimalLiFiAdapter] Chain switch successful for ${chainId}.`);

              // LI.FI SDK expects the *new* wallet client after switching.
              // We assume the provider's switchChain updates its internal state
              // and we can retrieve the potentially updated client here.
              // This relies on the LiFiExecutionProvider implementation.
              if (!this.executionProvider?.walletClient) {
                throw new Error("Wallet client not available after chain switch.");
              }
              // Return the (potentially updated) walletClient from the provider
              return this.executionProvider.walletClient;

            } catch (error: any) {
              console.error(`[MinimalLiFiAdapter] Failed to switch chain to ${chainId}: ${error.message}`);
              throw error; // Re-throw the error for the SDK
            }
          }
        }),
      ],
    });
    console.log("[MinimalLiFiAdapter] Execution provider configured with LI.FI SDK.");
  }

  /**
   * Checks if an execution provider is set
   */
  hasExecutionProvider(): boolean {
    return !!this.executionProvider;
  }

  /**
   * Gets quotes for an operation.
   */
  async getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");

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
        // Add other relevant options from intent if needed (order, allow/deny lists etc.)
      };

      const quoteStep: LiFiStep = await getQuote(quoteRequest);

      // Minimal mapping to OperationQuote
      const feeUSD = quoteStep.estimate.feeCosts?.reduce((sum, fee: FeeCost) => sum + parseFloat(fee.amountUSD || '0'), 0).toString() || '0';

      // <<< START CHANGE: Re-add gas cost mapping >>>
      const firstGasCost = quoteStep.estimate.gasCosts?.[0]; // Take the first gas cost estimate
      const gasCostsEstimate = firstGasCost ? {
        limit: firstGasCost.limit || '',
        amount: firstGasCost.amount || '', // Amount in native token (e.g., wei)
        amountUSD: firstGasCost.amountUSD || '0'
      } : undefined;
      // <<< END CHANGE >>>

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
        adapterName: 'lifi-minimal',
        adapterQuote: quoteStep, // Store raw quote
      };

      console.log(`[MinimalLiFiAdapter] Quote received: ${operationQuote.id}`);
      return [operationQuote];

    } catch (error: any) {
      console.error("[MinimalLiFiAdapter] Error getting quote:", error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  /**
   * Executes an operation based on a quote.
   */
  async executeOperation(
    quote: OperationQuote,
    onStatusUpdate?: (route: RouteExtended) => void
  ): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    if (!this.executionProvider) throw new Error("Execution provider required");

    const step = quote.adapterQuote as LiFiStep | undefined;
    if (!step?.id || !step.action || !step.estimate) {
      throw new Error("Invalid adapterQuote in OperationQuote");
    }

    try {
      console.log(`[MinimalLiFiAdapter] Converting quote ${step.id} to route...`);
      const route = await convertQuoteToRoute(step);
      
      console.log(`[MinimalLiFiAdapter] Executing route ${route.id}...`);

      executeRoute(route, {
        updateRouteHook: onStatusUpdate // Pass the provided hook directly
      });

      console.log(`[MinimalLiFiAdapter] Route execution initiated: ${route.id}`);

      // Return minimal initial PENDING status
      return {
        operationId: route.id,
        status: 'PENDING',
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        statusMessage: 'Execution initiated via LI.FI SDK.',
        adapterName: 'lifi-minimal',
      };

    } catch (error: any) {
      console.error("[MinimalLiFiAdapter] Error executing operation:", error);
      // Return minimal FAILED status
      return {
        operationId: step.id || `failed-op-${Date.now()}`, // Use step ID if available
        status: 'FAILED',
        sourceTx: { chainId: quote.intent.sourceAsset.chainId },
        destinationTx: { chainId: quote.intent.destinationAsset.chainId },
        error: `Execution failed: ${error.message}`,
        statusMessage: `Execution failed: ${error.message}`,
        adapterName: 'lifi-minimal',
      };
    }
  }

  /**
   * Gets the status of an operation by querying the SDK.
   */
  async getOperationStatus(operationId: string): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");

    try {
      const activeRoute = getActiveRoute(operationId);
      console.warn('activeRoute', activeRoute)

      if (!activeRoute) {
        console.warn(`[MinimalLiFiAdapter] No active route found for ID: ${operationId}`);
        // We don't have internal tracking, so we can only assume UNKNOWN if the SDK doesn't know.
        // A more robust version might query an external API if available, but for minimal, this is it.
        return {
          operationId,
          status: 'UNKNOWN',
          sourceTx: {},
          statusMessage: 'Operation not found in active LI.FI routes.',
          adapterName: 'lifi-minimal',
        };
      }

      // Translate the current route state to our status format
      return this.translateRouteToStatus(activeRoute);

    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error getting status for ${operationId}:`, error);
      return {
        operationId,
        status: 'UNKNOWN',
        sourceTx: {},
        error: `Failed to get status: ${error.message}`,
        statusMessage: `Failed to get status: ${error.message}`,
        adapterName: 'lifi-minimal',
      };
    }
  }

  /**
   * Cancels an operation using the SDK.
   */
  async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");

    try {
      const activeRoute = getActiveRoute(operationId);
      if (activeRoute) {
        console.log(`[MinimalLiFiAdapter] Stopping route execution for ${operationId}`);
        stopRouteExecution(activeRoute);

        // Return a FAILED status immediately after stopping
        return {
          operationId,
          status: 'FAILED',
          sourceTx: { chainId: activeRoute.fromChainId },
          destinationTx: { chainId: activeRoute.toChainId },
          error: reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
          statusMessage: reason === 'timeout' ? 'Operation canceled due to timeout' : 'Operation canceled by user',
          adapterName: 'lifi-minimal',
        };
      } else {
        console.warn(`[MinimalLiFiAdapter] Cannot cancel ${operationId}: No active route found.`);
        return {
          operationId,
          status: 'UNKNOWN', // Or FAILED? UNKNOWN seems safer if we never found it.
          sourceTx: {},
          error: 'Cannot cancel: Operation not found in active routes',
          statusMessage: 'Cannot cancel: Operation not found in active routes',
          adapterName: 'lifi-minimal',
        };
      }
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error cancelling operation ${operationId}:`, error);
      return {
        operationId,
        status: 'UNKNOWN',
        sourceTx: {},
        error: `Cancellation failed: ${error.message}`,
        statusMessage: `Cancellation failed: ${error.message}`,
        adapterName: 'lifi-minimal',
      };
    }
  }

  // --- Minimal Helper Methods ---

  /**
   * Simple translation from LI.FI RouteExtended to OperationResult
   */
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
      receivedAmount = (lastStep.execution as Execution)?.toAmount || route.toAmount; // Basic amount
      // Simple search for last tx hash on destination chain
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
      sourceTx: {
        hash: sourceProcess?.txHash,
        chainId: route.fromChainId,
        explorerUrl: sourceProcess?.txLink,
      },
      destinationTx: {
        hash: destTxHash,
        chainId: route.toChainId,
        explorerUrl: destTxExplorerUrl,
      },
      receivedAmount: receivedAmount,
      error: error,
      statusMessage: statusMessage,
      adapterName: 'lifi-minimal',
    };
  }

  /**
   * Simple status derivation logic.
   */
  private deriveOverallStatus(route: RouteExtended): OperationResult['status'] {
    if (!route.steps || route.steps.length === 0) return 'PENDING';

    let hasFailed = false;
    let needsAction = false;
    let allDone = true;
    let hasPending = false;

    for (const step of route.steps) {
      const stepStatus = this.mapLifiStatus(step.execution?.status);
      if (stepStatus === 'FAILED') { hasFailed = true; break; }
      if (stepStatus === 'ACTION_REQUIRED') needsAction = true;
      if (stepStatus !== 'COMPLETED') allDone = false;
      if (stepStatus === 'PENDING') hasPending = true;
    }

    if (hasFailed) return 'FAILED';
    if (needsAction) return 'ACTION_REQUIRED';
    // Ensure all steps actually have execution data before declaring completed
    const allExecuted = route.steps.every(step => step.execution);
    if (allExecuted && allDone) return 'COMPLETED';
    if (hasPending) return 'PENDING';

    // Fallback if state is unclear (e.g., steps exist but none executed)
    return 'PENDING'; // Default to PENDING if not clearly terminal or actionable
  }

  /**
   * Maps LI.FI execution status strings to our standard OperationResult status.
   */
  private mapLifiStatus(lifiStatus?: string): OperationResult['status'] {
    switch (lifiStatus) {
      case 'PENDING':
      case 'STARTED':
        return 'PENDING';
      case 'ACTION_REQUIRED':
        return 'ACTION_REQUIRED';
      case 'DONE':
        return 'COMPLETED';
      case 'FAILED':
      case 'CANCELLED':
      case 'NOT_FOUND':
        return 'FAILED';
      case undefined: // Step exists but execution hasn't started
        return 'PENDING';
      default:
        console.warn(`[MinimalLiFiAdapter] Unknown LI.FI status: ${lifiStatus}`);
        return 'UNKNOWN';
    }
  }

  // --- Minimal Read-Only Methods (No Caching) ---

  async getSupportedChains(): Promise<{ chainId: number; name: string }[]> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    try {
      const chains = await getChains({ chainTypes: [ChainType.EVM] });
      return chains.map(chain => ({ chainId: chain.id, name: chain.name }));
    } catch (error: any) {
      console.error("[MinimalLiFiAdapter] Error fetching chains:", error);
      throw new Error(`Failed to get chains: ${error.message}`);
    }
  }

  async getSupportedTokens(chainId: string): Promise<ChainAsset[]> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    try {
      const response = await getTokens({ chains: [Number(chainId) as ChainId] });
      const tokens = response.tokens[Number(chainId)] || [];
      return tokens.map(token => ({
        chainId: token.chainId.toString(), // Ensure string format
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        logoURI: token.logoURI // Include logo if available
      }));
    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error fetching tokens for chain ${chainId}:`, error);
      throw new Error(`Failed to get tokens for chain ${chainId}: ${error.message}`);
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
      // Return zero values on error
      return { amount: '0', usdValue: '0' };
    }
  }

  // --- Methods not implemented in minimal version ---

  /**
     * Resumes a previously initiated operation (e.g., after user interaction).
     * Relies on the configured provider to handle signing (auto or manual).
     */
  async resumeOperation(operationId: string): Promise<OperationResult> {
    if (!this.initialized) throw new Error("MinimalLiFiAdapter not initialized");
    if (!this.executionProvider) throw new Error("Execution provider required for resume");

    try {
      const activeRoute = getActiveRoute(operationId);
      if (!activeRoute) {
        // If no active route, check status to return something meaningful
        console.warn(`[MinimalLiFiAdapter] Cannot resume ${operationId}: No active route found. Checking last known status.`);
        // Attempt to get status - might return UNKNOWN or a previous state
        return this.getOperationStatus(operationId);
      }

      console.log(`[MinimalLiFiAdapter] Resuming route ${operationId}.`);

      // Resume the route - SDK handles provider interaction based on config
      resumeRoute(activeRoute);

      console.log(`[MinimalLiFiAdapter] Route resumption initiated: ${operationId}`);

      // Return PENDING status immediately after resuming
      // A subsequent getOperationStatus call will reflect the actual state
      return {
        operationId: activeRoute.id,
        status: 'PENDING', // Assume pending until next status check
        sourceTx: { chainId: activeRoute.fromChainId },
        destinationTx: { chainId: activeRoute.toChainId },
        statusMessage: 'Resumption initiated via LI.FI SDK.',
        adapterName: 'lifi-minimal',
      };

    } catch (error: any) {
      console.error(`[MinimalLiFiAdapter] Error resuming operation ${operationId}:`, error);
      // Return minimal FAILED status on error
      return {
        operationId,
        status: 'FAILED',
        sourceTx: {}, // Chain IDs might not be known if route wasn't found
        destinationTx: {},
        error: `Resume failed: ${error.message}`,
        statusMessage: `Resume failed: ${error.message}`,
        adapterName: 'lifi-minimal',
      };
    }
  }

  async checkForTimedOutOperations(): Promise<void> {
    // No-op in minimal version as there's no internal timeout tracking
    console.log("[MinimalLiFiAdapter] checkForTimedOutOperations called (No-op)");
  }
}