import { ICrossChain, OperationParams, OperationQuote, OperationResult, ChainAsset, TransactionConfirmationHandler } from '../types/interfaces/index.js';
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
  resumeRoute,
  stopRouteExecution,
} from '@lifi/sdk';


/**
 * Interface for LI.FI execution provider
 * Abstraction over any wallet implementation that can execute transactions
 */
export interface LiFiExecutionProvider {
  address: string;
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
  autoConfirmTransactions?: boolean; // Only for testing environments!
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
 * Internal operation tracking structure
 */
interface OperationTracking {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  startTime: number;
  params: OperationParams;
  transactionHash: string;
  destinationTransactionHash: string;
  explorerUrl: string;
  error?: string;
}

/**
 * Adapter for LI.FI cross-chain operations
 * Implements the ICrossChain interface using LI.FI's API
 */
export class LiFiAdapter implements Partial<ICrossChain> {
  // Configuration
  private apiKey?: string;
  private apiUrl?: string;

  // State
  private initialized: boolean = false;
  private chains: any[] = [];
  private cachedChains: { chainId: number, name: string }[] | null = null;
  private cachedTokens: Map<string, ChainAsset[]> = new Map();

  // Execution provider (optional)
  private executionProvider?: LiFiExecutionProvider;
  private confirmationHandler?: TransactionConfirmationHandler;
  private autoConfirmTransactions?: boolean;

  // Optional timeouts.
  private confirmationTimeout?: number;
  private pendingOperationTimeout?: number;

  // Keep track of in-progress operations
  private pendingOperations: Map<string, OperationTracking> = new Map();

  /**
   * Private constructor - use static create method
   */
  private constructor(args: LiFiAdapterArgs) {
    // Only store basic configuration in constructor
    this.apiKey = args.config?.apiKey;
    this.apiUrl = args.config?.apiUrl;
  }

  /**
   * Factory method to create an instance of LiFiAdapter
   */
  static async create(args: { adapterName: string, config?: LiFiConfig }): Promise<LiFiAdapter> {
    const adapter = new LiFiAdapter(args);

    if (args.config) {
      await adapter.initialize(args.config);
    }

    return adapter;
  }

  /**
   * Initializes the adapter with the given configuration (API-only)
   */
  async initialize(config: LiFiConfig): Promise<void> {
    if (this.initialized) return;

    this.log('info', "Initializing LiFiAdapter", {
      apiKey: config.apiKey ? "***" : undefined,
      apiUrl: config.apiUrl
    });

    // Store configuration
    this.apiKey = config.apiKey || this.apiKey;
    this.apiUrl = config.apiUrl || this.apiUrl;
    this.confirmationHandler = config.confirmationHandler;
    this.autoConfirmTransactions = config.autoConfirmTransactions;
    this.confirmationTimeout = config.confirmationTimeout;
    this.pendingOperationTimeout = config.pendingOperationTimeout

    createConfig({
      integrator: 'm3s',
      apiKey: this.apiKey
    });

    // Load chains for future use 
    this.chains = await getChains({ chainTypes: [ChainType.EVM] });

    // Mark as initialized
    this.initialized = true;
    config.provider && this.setExecutionProvider(config.provider)
  }

  /**
   * Checks if the adapter has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Validates the adapter is ready for operations
   * @private
   */
  private validatePrerequisites(): void {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    if (!this.executionProvider) {
      throw new Error("Execution provider required for transaction execution");
    }
  }

  /**
   * Determines if the current configuration requires user interaction
   * @private
   */
  private requiresUserInteraction(): boolean {
    return !this.autoConfirmTransactions && !!this.confirmationHandler;
  }

  /**
   * Creates a standardized error result
   * @param error The error object
   * @param params The operation parameters
   * @private
   */
  private createErrorResult(error: any, params: OperationParams): OperationResult {
    this.log('error', `Operation failed: ${error.message}`);

    return {
      operationId: Math.random().toString(36).substring(2, 15), // Generate a random ID
      status: 'FAILED',
      transactionHash: '',
      destinationTransactionHash: '',
      fromChain: params.sourceAsset.chainId.toString(),
      toChain: params.destinationAsset.chainId.toString(),
      bridge: '',
      explorerUrl: '',
      error: error.message || "Unknown error during execution"
    };
  }

  /**
   * Prepares a route for execution based on a quote
   * @param params The operation parameters
   * @param quote The operation quote
   * @private
   */
  private async prepareRouteForExecution(params: OperationParams): Promise<RouteExtended> {
    // Get fresh quote for execution
    const quoteRequest: QuoteRequest = {
      fromChain: Number(params.sourceAsset.chainId),
      fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000',
      fromAddress: params.fromAddress,
      fromAmount: params.amount,
      toChain: Number(params.destinationAsset.chainId),
      toToken: params.destinationAsset.address || '0x0000000000000000000000000000000000000000',
      toAddress: params.toAddress || params.fromAddress,
      slippage: params.slippage ? params.slippage / 100 : 0.01,
      integrator: 'm3s',
      referrer: params.referrer
    };

    this.log('debug', "Getting fresh quote for execution", quoteRequest);
    const freshQuote = await getQuote(quoteRequest);
    this.log('debug', "Converting quote to route...");

    // Convert quote to route for execution
    return convertQuoteToRoute(freshQuote);
  }

  /**
   * Creates a route update hook for tracking status changes
   * @param operationId The operation ID
   * @private
   */
  private createRouteUpdateHook(operationId: string): (route: RouteExtended) => void {
    return (updatedRoute: RouteExtended) => {
      // Get tracking object - early exit if not found
      const tracking = this.pendingOperations.get(operationId);
      if (!tracking) return;

      // Check for ACTION_REQUIRED status
      const actionStep = updatedRoute.steps.find(step =>
        step.execution?.status === 'ACTION_REQUIRED'
      );

      // Handle action required steps
      if (actionStep) {
        this.handleActionRequiredStep(operationId, updatedRoute, actionStep);
      }

      // Update transaction hash if available
      if (updatedRoute.steps?.[0]?.execution?.process) {
        for (const process of updatedRoute.steps[0].execution.process) {
          if (process.txHash && !tracking.transactionHash) {
            tracking.transactionHash = process.txHash;
            tracking.explorerUrl = process.txUrl || '';
            this.log('info', `📡 Transaction submitted: ${process.txHash}`);
            break;
          }
        }
      }

      // Determine status based on steps instead of direct route status
      const hasFailedStep = updatedRoute.steps.some(
        step => step.execution?.status === 'FAILED'
      );

      const allStepsDone = updatedRoute.steps.every(
        step => step.execution?.status === 'DONE'
      );

      if (hasFailedStep) {
        tracking.status = 'FAILED';
        // Find the failed step to get error message
        const failedStep = updatedRoute.steps.find(
          step => step.execution?.status === 'FAILED'
        );
        tracking.error = failedStep?.execution?.process[0]?.error?.message;
        this.log('error', `❌ Operation failed: ${operationId}`, tracking.error);
      } else if (allStepsDone) {
        tracking.status = 'COMPLETED';
        this.log('info', `✅ Operation completed: ${operationId}`);
      }

      // Update tracking
      this.pendingOperations.set(operationId, tracking);
    };
  }

  /**
 * Handle steps requiring user action/confirmation
 * @private
 */
  private handleActionRequiredStep(
    operationId: string,
    updatedRoute: RouteExtended,
    actionStep: any
  ): void {
    const actionProcess = actionStep.execution?.process.find((p: any) =>
      p.status === 'ACTION_REQUIRED' && p.txRequest
    );

    if (!actionProcess?.txRequest) return;

    if (this.autoConfirmTransactions) {
      // Auto-confirm for testing environments
      this.log('info', `🤖 Auto-confirming transaction for ${operationId}`);
      this.resumeOperation(operationId).catch(err =>
        this.log('error', `Failed to auto-resume operation: ${err.message}`)
      );
    }
    else if (this.confirmationHandler) {
      // Prepare for user approval
      this.log('info', `⏸️ Pausing execution for user approval for ${operationId}`);

      // Stop execution to prevent automatic processing
      stopRouteExecution(updatedRoute);

      // Prepare transaction info for the confirmation handler
      const txInfo = {
        from: actionProcess.txRequest.from,
        to: actionProcess.txRequest.to,
        value: actionProcess.txRequest.value?.toString() || '0',
        chainId: actionStep.action.fromChainId.toString(),
        data: actionProcess.txRequest.data
      };

      // Handle confirmation with timeout
      this.handleConfirmation(operationId, txInfo, this.confirmationTimeout)
        .then(approved => {
          if (approved) {
            this.log('info', `✅ User approved transaction for ${operationId}`);
            this.resumeOperation(operationId).catch(err =>
              this.log('error', `Failed to resume operation: ${err.message}`)
            );
          } else {
            this.log('info', `❌ User rejected transaction for ${operationId}`);
          }
        })
        .catch(err => {
          this.log('error', `Error in confirmation handler: ${err.message}`);
        });
    }
  }

  /**
   * Translates a LI.FI route to our standardized status format
   * @param route The LI.FI route object
   * @private
   */
  private translateRouteToStatus(route: RouteExtended): OperationResult {
    // Extract basic info
    const result: OperationResult = {
      operationId: route.id,
      status: 'PENDING',
      transactionHash: '',
      destinationTransactionHash: '',
      fromChain: route.fromChainId?.toString() || '',
      toChain: route.toChainId?.toString() || '',
      bridge: route.steps[0]?.tool || '',
      explorerUrl: '',
      error: undefined
    };

    // Process step status
    if (route.steps?.length > 0) {
      // Check if any step has failed
      const hasFailedStep = route.steps.some(
        step => step.execution?.status === 'FAILED'
      );

      // Check if all steps are done
      const allStepsDone = route.steps.every(
        step => step.execution?.status === 'DONE'
      );

      if (hasFailedStep) {
        result.status = 'FAILED';
        // Find the failed step to get error message
        const failedStep = route.steps.find(
          step => step.execution?.status === 'FAILED'
        );
        result.error = failedStep?.execution?.process[0]?.error?.message;
      } else if (allStepsDone) {
        result.status = 'COMPLETED';
      }
    }

    // Extract transaction details from the first step's execution
    if (route.steps?.[0]?.execution?.process) {
      for (const process of route.steps[0].execution.process) {
        if (process.txHash) {
          result.transactionHash = process.txHash;
          result.explorerUrl = process.txUrl || '';
          break;
        }
      }
    }

    // Try to find destination transaction hash (cross-chain transfer)
    if (route.steps.length > 1 && route.steps[1]?.execution?.process) {
      for (const process of route.steps[1].execution.process) {
        if (process.txHash) {
          result.destinationTransactionHash = process.txHash;
          break;
        }
      }
    }

    return result;
  }

  /**
   * Handles user confirmation for transactions with timeout support
   * @param operationId The operation ID
   * @param txInfo Transaction information
   * @param timeout Optional timeout in milliseconds
   * @private
   */
  private async handleConfirmation(
    operationId: string,
    txInfo: any,
    timeout?: number
  ): Promise<boolean> {
    if (!this.confirmationHandler) {
      return true;
    }
    // Handle confirmation with clean timeout logic
    return new Promise<boolean>((resolve, reject) => {
      let isResolved = false;

      // Set up timeout if specified
      const timeoutId = timeout ? setTimeout(() => {
        if (!isResolved) {
          isResolved = true;

          // Mark the operation as failed due to timeout
          const tracking = this.pendingOperations.get(operationId);
          if (tracking) {
            tracking.status = 'FAILED';
            tracking.error = `Confirmation timed out after ${timeout}ms`;
            this.pendingOperations.set(operationId, tracking);

            // Log the update for debugging
            this.log('warn', `⏱️ Confirmation timed out for ${operationId} after ${timeout}ms`);
          }

          reject(new Error(`Confirmation timed out after ${timeout}ms`));
        }
      }, timeout) : null;

      // Call the confirmation handler
      this.confirmationHandler!.onConfirmationRequired(operationId, txInfo)
        .then(approved => {
          if (!isResolved) {
            isResolved = true;
            if (timeoutId) clearTimeout(timeoutId);

            if (!approved) {
              // Mark as rejected by user
              const tracking = this.pendingOperations.get(operationId);
              if (tracking) {
                tracking.status = 'FAILED';
                tracking.error = 'Transaction rejected by user';
                this.pendingOperations.set(operationId, tracking);
              }
            }

            resolve(approved);
          }
        })
        .catch(err => {
          if (!isResolved) {
            isResolved = true;
            if (timeoutId) clearTimeout(timeoutId);

            // Mark operation as failed due to handler error
            const tracking = this.pendingOperations.get(operationId);
            if (tracking) {
              tracking.status = 'FAILED';
              tracking.error = `Confirmation handler error: ${err.message}`;
              this.pendingOperations.set(operationId, tracking);
            }

            reject(err);
          }
        });
    });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    // Only show important logs by default
    const showDebug = false;

    if (level === 'debug' && !showDebug) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[LiFiAdapter ${timestamp}]`;

    switch (level) {
      case 'info':
        if (data) {
          console.log(`${prefix} ${message}`, data);
        } else {
          console.log(`${prefix} ${message}`);
        }
        break;
      case 'warn':
        if (data) {
          console.warn(`${prefix} ⚠️ ${message}`, data);
        } else {
          console.warn(`${prefix} ⚠️ ${message}`);
        }
        break;
      case 'error':
        if (data) {
          console.error(`${prefix} 🚨 ${message}`, data);
        } else {
          console.error(`${prefix} 🚨 ${message}`);
        }
        break;
      case 'debug':
        if (data) {
          console.log(`${prefix} 🔍 ${message}`, data);
        } else {
          console.log(`${prefix} 🔍 ${message}`);
        }
        break;
    }
  }

  /**
 * Converts internal tracking to standard operation result format
 * @private
 */
  private trackingToResult(operationId: string, tracking: OperationTracking): OperationResult {
    return {
      operationId,
      status: tracking.status,
      transactionHash: tracking.transactionHash || '',
      destinationTransactionHash: tracking.destinationTransactionHash || '',
      fromChain: tracking.params.sourceAsset.chainId.toString(),
      toChain: tracking.params.destinationAsset.chainId.toString(),
      bridge: '', // Will be populated from route if available
      explorerUrl: tracking.explorerUrl || '',
      error: tracking.error
    };
  }


  /**
 * Gets a quote for a cross-chain operation
 * @param params Operation parameters
 * @returns Operation quote with pricing and route information
 */
  async getOperationQuote(params: OperationParams): Promise<OperationQuote> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Convert our params to LI.FI format
      const quoteRequest: QuoteRequest = {
        fromChain: Number(params.sourceAsset.chainId),
        fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000',
        fromAddress: params.fromAddress,
        fromAmount: params.amount,
        toChain: Number(params.destinationAsset.chainId),
        toToken: params.destinationAsset.address || '0x0000000000000000000000000000000000000000',
        toAddress: params.toAddress || params.fromAddress,
        slippage: params.slippage ? params.slippage / 100 : 0.01, // Convert percentage to decimal
        integrator: 'm3s',
        referrer: params.referrer
      };

      // Get quote from LI.FI
      const quote = await getQuote(quoteRequest);

      // Transform to our standard format
      return {
        id: quote.id,
        estimate: {
          fromAmount: quote.action.fromAmount,
          toAmount: quote.estimate.toAmount,
          route: quote.toolDetails.name,
          executionTime: quote.estimate.executionDuration,
          fee: quote.estimate.feeCosts?.reduce((total: string, fee: any) => {
            const feeAmountUsd = fee.amountUsd || '0';
            return (BigInt(total) + BigInt(feeAmountUsd)).toString();
          }, '0')
        },
        validUntil: Math.floor(Date.now() / 1000) + 60 * 3, // 3 minutes validity
        serviceTime: quote.estimate.executionDuration
      };
    } catch (error) {
      this.log('error', "Error getting operation quote:", error);
      throw new Error(`Failed to get operation quote: ${error}`);
    }
  }

  /**
   * Resumes a previously halted or paused operation
   * @param operationId ID of the operation to resume
   * @returns Updated operation result
   */
  async resumeOperation(operationId: string): Promise<OperationResult> {
    this.validatePrerequisites();

    try {
      // Get the active route from the SDK
      const activeRoute = <RouteExtended>getActiveRoute(operationId);
      if (!activeRoute) {
        throw new Error(`No active route found for operation ID: ${operationId}`);
      }

      this.log('info', `Resuming operation: ${operationId}`);

      // Resume the route execution
      await resumeRoute(activeRoute, {
        updateRouteHook: this.createRouteUpdateHook(operationId),
        executeInBackground: false // Always resume in foreground
      });

      // Return immediately with the current status
      return this.getOperationStatus(operationId);
    } catch (error: any) {
      this.log('error', `Error resuming operation ${operationId}:`, error);
      throw new Error(`Failed to resume operation: ${error.message}`);
    }
  }

  /**
   * Cancels an in-progress operation
   * @param operationId ID of the operation to cancel
   * @param reason Optional reason for cancellation ("timeout" for timeout-related cancellations)
   * @returns Status of the canceled operation
   */
  async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Get the active route from the SDK
      const activeRoute = <RouteExtended>getActiveRoute(operationId);
      if (!activeRoute) {
        // If no active route, check if we're tracking it
        const pendingOp = this.pendingOperations.get(operationId);
        if (pendingOp) {
          // Mark as canceled in our internal tracking with the appropriate message
          pendingOp.status = 'FAILED';
          pendingOp.error = reason === 'timeout'
            ? 'Operation timed out and was canceled'
            : 'Operation canceled by user';
          this.pendingOperations.set(operationId, pendingOp);

          this.log('info', `🛑 Marked operation as canceled: ${operationId} (${pendingOp.error})`);
          return this.getOperationStatus(operationId);
        }
        throw new Error(`No active route found for operation ID: ${operationId}`);
      }

      // Stop the route execution
      this.log('info', `🛑 Cancelling operation: ${operationId}`);
      stopRouteExecution(activeRoute);

      // Update our tracking with the appropriate error message
      const tracking = this.pendingOperations.get(operationId);
      if (tracking) {
        tracking.status = 'FAILED';
        tracking.error = reason === 'timeout'
          ? 'Operation timed out and was canceled'
          : 'Operation canceled by user';
        this.pendingOperations.set(operationId, tracking);
      }

      // Return the current status
      return this.getOperationStatus(operationId);
    } catch (error: any) {
      this.log('error', `Failed to cancel operation ${operationId}: ${error.message}`);
      throw new Error(`Failed to cancel operation: ${error.message}`);
    }
  }

  /**
   * Checks for timed-out operations and cancels them
   * This should be called periodically to clean up stale operations
   */
  async checkForTimedOutOperations(): Promise<void> {
    if (!this.pendingOperationTimeout || !this.initialized) return;

    const now = Date.now();
    for (const [operationId, tracking] of this.pendingOperations.entries()) {
      // Skip operations that are already completed or failed
      if (tracking.status !== 'PENDING') continue;

      // Check if the operation has timed out
      const operationAge = now - tracking.startTime;
      if (operationAge > this.pendingOperationTimeout) {
        this.log('warn', `🕒 Operation ${operationId} timed out after ${operationAge}ms`);

        try {
          // Use the cancelOperation method with 'timeout' reason
          await this.cancelOperation(operationId, 'timeout');
        } catch (error) {
          // If cancellation fails, just mark it as failed
          tracking.status = 'FAILED';
          tracking.error = 'Operation timed out and could not be canceled';
          this.pendingOperations.set(operationId, tracking);
        }
      }
    }
  }

  /**
   * Gets the status of a previously executed operation
   * @param operationId Operation ID to check
   * @returns Operation result with updated status
   */
  async getOperationStatus(operationId: string): Promise<OperationResult> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // PRIORITY 1: First check our internal tracking for FAILED status (this takes precedence)
      const tracking = this.pendingOperations.get(operationId);

      if (tracking?.status === 'FAILED') {
        this.log('debug', `Returning failed status from tracking for ${operationId}`);
        return this.trackingToResult(operationId, tracking);
      }

      // PRIORITY 2: Check active route for the most current information
      const activeRoute = <RouteExtended>getActiveRoute(operationId);

      if (activeRoute) {
        const routeStatus = <OperationResult>this.translateRouteToStatus(activeRoute);

        // If we have tracking but route is more current, merge important info
        if (tracking) {
          // Keep our error information if present
          if (tracking.error && !routeStatus.error) {
            routeStatus.error = tracking.error;
          }

          // If our status is FAILED, keep it (may be due to timeout/cancellation)
          if (tracking.status as 'PENDING' | 'COMPLETED' | 'FAILED' === 'FAILED') {
            routeStatus.status = 'FAILED';
            routeStatus.error = tracking.error;
          }
        }

        return routeStatus;
      }

      // PRIORITY 3: Fall back to our tracking for completed/inactive operations
      if (tracking) {
        this.log('debug', `Returning status from tracking for ${operationId}`);
        return this.trackingToResult(operationId, tracking);
      }

      // If we get here, we don't have any information about this operation
      return {
        operationId,
        status: 'PENDING',
        transactionHash: '',
        destinationTransactionHash: '',
        fromChain: '',
        toChain: '',
        bridge: '',
        explorerUrl: '',
        error: undefined
      };
    } catch (error: any) {
      this.log('error', `Error getting operation status: ${error.message}`);
      throw new Error(`Failed to get operation status: ${error.message}`);
    }
  }

  /**
   * Gets supported tokens for a specific chain
   * @param chainId Chain ID to get tokens for
   * @returns Array of supported tokens
   */
  async getSupportedTokens(chainId: string): Promise<ChainAsset[]> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Use cached results if available
      if (this.cachedTokens.has(chainId)) {
        return this.cachedTokens.get(chainId)!;
      }

      // Fetch tokens from API
      const response = await getTokens({ chains: [chainId as unknown as ChainId] });
      const tokens = response.tokens[Number(chainId)] || [];

      // Convert to ChainAsset format
      const assets: ChainAsset[] = tokens.map(token => ({
        chainId: token.chainId,
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name
      }));

      // Cache the results
      this.cachedTokens.set(chainId, assets);

      return assets;
    } catch (error) {
      this.log('error', `Error fetching tokens for chain ${chainId}:`, error);
      throw new Error(`Failed to get tokens for chain ${chainId}: ${error}`);
    }
  }

  /**
   * Gets the list of supported chains
   * @returns Array of supported chains with chainId and name
   */
  async getSupportedChains(): Promise<{ chainId: number, name: string }[]> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Use cached results if available
      if (this.cachedChains) {
        return this.cachedChains;
      }

      // If chains are already loaded during initialization, transform them
      if (this.chains && this.chains.length > 0) {
        this.cachedChains = this.chains.map(chain => ({
          chainId: chain.id,
          name: chain.name
        }));
        return this.cachedChains;
      }

      // Otherwise fetch from API
      const chains = await getChains({ chainTypes: [ChainType.EVM] });
      this.chains = chains;

      // Transform to the expected format
      this.cachedChains = chains.map(chain => ({
        chainId: chain.id,
        name: chain.name
      }));

      return this.cachedChains;
    } catch (error) {
      this.log('error', "Error fetching supported chains:", error);
      throw new Error(`Failed to get supported chains: ${error}`);
    }
  }

  /**
   * Gets gas estimation for the destination chain
   * @param params Operation parameters
   * @returns Gas estimate with amount and USD value
   */
  async getGasOnDestination(params: OperationParams): Promise<{ amount: string, usdValue: string }> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Get gas recommendation for destination chain
      const gasRecommendation = await getGasRecommendation({
        chainId: Number(params.destinationAsset.chainId),
        fromChain: Number(params.sourceAsset.chainId),
        fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000'
      });

      // Return standardized format
      return {
        amount: gasRecommendation.recommended?.amount || '0',
        usdValue: gasRecommendation.recommended?.amountUsd || '0'
      };
    } catch (error) {
      this.log('error', "Error getting gas on destination:", error);
      // Return empty values on error to prevent breaking
      return {
        amount: '0',
        usdValue: '0'
      };
    }
  }

  /**
   * Executes a cross-chain operation
   * @param params Operation parameters
   * @returns Operation result with transaction details
   */
  async executeOperation(params: OperationParams): Promise<OperationResult> {
    this.validatePrerequisites();

    try {
      this.log('info', "Getting operation quote...");

      // Prepare the route for execution
      const route = await this.prepareRouteForExecution(params);
      this.log('info', "Executing route...");

      // Create tracking for this operation BEFORE starting execution
      const operationTracking = {
        status: 'PENDING' as 'PENDING' | 'COMPLETED' | 'FAILED',
        startTime: Date.now(),
        params,
        transactionHash: '',
        destinationTransactionHash: '',
        explorerUrl: '',
        error: undefined
      };

      // Store in pendingOperations
      this.pendingOperations.set(route.id, operationTracking);

      // Execute the route with our tracking hook
      executeRoute(route, {
        updateRouteHook: this.createRouteUpdateHook(route.id),
        executeInBackground: !this.requiresUserInteraction()
      });

      // Return initial result (execution continues asynchronously)
      console.log("✅ Operation initiated:", route.id);
      return {
        operationId: route.id,
        status: 'PENDING',
        transactionHash: '',
        destinationTransactionHash: '',
        fromChain: params.sourceAsset.chainId.toString(),
        toChain: params.destinationAsset.chainId.toString(),
        bridge: route.steps[0]?.tool || '',
        explorerUrl: '',
        error: undefined
      };
    } catch (error: any) {
      return this.createErrorResult(error, params);
    }
  }

  /**
   * Set an execution provider for transaction operations
   * This can be called after initialization to add transaction capabilities
   */
  async setExecutionProvider(provider: LiFiExecutionProvider): Promise<void> {
    if (!this.initialized) {
      throw new Error("LiFiAdapter must be initialized before setting execution provider");
    }

    this.executionProvider = provider;
    this.log('info', `Setting up execution provider with address: ${provider.address}`);

    // Re-initialize SDK WITH the execution provider
    createConfig({
      integrator: 'm3s',
      apiKey: this.apiKey,
      providers: [
        EVM({
          // Pass the wallet client directly
          getWalletClient: async () => provider.walletClient,
          // Use the provider's switchChain implementation
          switchChain: provider.switchChain
        })
      ]
    });

    this.log('info', "Successfully registered execution provider with LI.FI SDK");
  }

  /**
   * Checks if the adapter has an execution provider set
   */
  hasExecutionProvider(): boolean {
    return !!this.executionProvider;
  }


}