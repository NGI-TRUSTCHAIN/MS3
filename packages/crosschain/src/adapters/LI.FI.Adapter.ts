import { ICrossChain, OperationIntent, OperationQuote, OperationResult, ChainAsset, TransactionConfirmationHandler } from '../types/interfaces/index.js';
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
  LiFiStep,
  FeeCost,
  Process,
  Execution
} from '@lifi/sdk';
import { IEVMWallet } from '@m3s/wallet'; // <<< Import IEVMWallet
import { createWalletClient, http } from 'viem';
import * as viemChains from 'viem/chains'

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


function findViemChain(chainId: number): viemChains.Chain | undefined {
  for (const key in viemChains) {
    const chain = (viemChains as any)[key] as viemChains.Chain;
    if (chain.id === chainId) {
      return chain;
    }
  }
  return undefined;
}

/**
 * Internal operation tracking structure - UPDATED
 */
interface OperationTracking {
  status: OperationResult['status']; // <<< Use status from new OperationResult
  startTime: number;
  intent: OperationIntent; // <<< Keep intent (renamed from params)
  lifiRoute?: RouteExtended; // <<< Store the route for status updates
  sourceTx: OperationResult['sourceTx']; // <<< Match OperationResult structure
  destinationTx?: OperationResult['destinationTx']; // <<< Match OperationResult structure
  receivedAmount?: string; // <<< Match OperationResult structure
  error?: string; // <<< Match OperationResult structure
  statusMessage?: string; // <<< Match OperationResult structure
}

/**
 * Adapter for LI.FI cross-chain operations
 * Implements the ICrossChain interface using LI.FI's API
 */
export class LiFiAdapter implements ICrossChain {
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
  private m3sWalletInstance?: IEVMWallet;

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
   * Creates a standardized error result - UPDATED RETURN TYPE
   * @param error The error object
   * @param intent The operation intent (extracted from quote)
   * @private
   */
  private createErrorResult(error: any, intent?: OperationIntent): OperationResult { // <<< Return new OperationResult
    this.log('error', `Operation failed: ${error.message}`);
    const opId = Math.random().toString(36).substring(2, 15); // Generate a random ID
    const errorMessage = error.message || "Unknown error during execution";

    return {
      operationId: opId,
      status: 'FAILED',
      sourceTx: { // <<< Use sourceTx structure
        chainId: intent?.sourceAsset.chainId,
      },
      destinationTx: { // <<< Use destinationTx structure
        chainId: intent?.destinationAsset.chainId,
      },
      error: errorMessage,
      statusMessage: `Operation failed: ${errorMessage}`, // <<< Add statusMessage
      adapterName: 'lifi' // <<< Add adapterName
    };
  }

  /**
     * Creates a route update hook for tracking status changes - UPDATED LOGIC
     * @param operationId The operation ID
     * @private
     */
  private createRouteUpdateHook(operationId: string): (route: RouteExtended) => void {
    return (updatedRoute: RouteExtended) => {
      this.log('debug', `Route Update Hook Called for ${operationId}`, {
        routeId: updatedRoute.id,
        steps: updatedRoute.steps.map(s => ({ id: s.id, type: s.type, tool: s.tool, status: s.execution?.status, process: s.execution?.process.map(p => p.status) }))
      });

      const tracking = this.pendingOperations.get(operationId);
      if (!tracking) {
        this.log('warn', `Tracking not found for ${operationId} in update hook.`);
        return;
      }

      // Store the latest route object
      tracking.lifiRoute = updatedRoute;

      // --- Update Status ---
      const overallStatus = this.deriveOverallStatus(updatedRoute);
      this.log('debug', `Derived Overall Status for ${operationId}: ${overallStatus}`);

      tracking.status = overallStatus;

      // --- Update Transaction Hashes & Explorer URLs ---
      const firstStep = updatedRoute.steps[0];
      const lastStep = updatedRoute.steps[updatedRoute.steps.length - 1];

      // Source Tx
      const sourceProcess = this.findProcessWithTxHash(firstStep);
      if (sourceProcess && !tracking.sourceTx.hash) {
        tracking.sourceTx.hash = sourceProcess.txHash;
        tracking.sourceTx.explorerUrl = sourceProcess.txLink;
        tracking.sourceTx.chainId = firstStep.action.fromChainId; // Ensure chainId is set
        this.log('info', `📡 Source Tx submitted: ${tracking.sourceTx.hash}`);
      } else if (!tracking.sourceTx.chainId) {
        tracking.sourceTx.chainId = firstStep?.action.fromChainId; // Set chainId even if no hash yet
      }


      // Destination Tx (only if different from source)
      if (lastStep && lastStep.id !== firstStep.id) {
        const destProcess = this.findProcessWithTxHash(lastStep);
        if (!tracking.destinationTx) tracking.destinationTx = {}; // Initialize if needed
        if (destProcess && !tracking.destinationTx.hash) {
          this.log('debug', `Comparing source/dest process hashes for ${operationId}`, {
            sourceHash: tracking.sourceTx.hash,
            destHashAttempt: destProcess.txHash,
            destProcessStatus: destProcess.status,
            lastStepStatus: lastStep.execution?.status
          });
          tracking.destinationTx.hash = destProcess.txHash;
          tracking.destinationTx.explorerUrl = destProcess.txLink;
          tracking.destinationTx.chainId = lastStep.action.toChainId; // Ensure chainId is set
          this.log('info', `🏁 Destination Tx detected: ${tracking.destinationTx.hash}`);
        } else if (!tracking.destinationTx.chainId) {
          tracking.destinationTx.chainId = lastStep?.action.toChainId; // Set chainId even if no hash yet
        }
      }


      // --- Update Status Message and Error ---
      if (overallStatus === 'FAILED') {
        const failedStep = updatedRoute.steps.find((step) => this.mapLifiStatus(step.execution?.status) === 'FAILED');
        const failedProcess = failedStep?.execution?.process.find(p => p.status === 'FAILED');
        tracking.error = failedProcess?.error?.message || failedStep?.execution?.process[0]?.error?.message || 'Unknown error in failed step';
        tracking.statusMessage = `Operation failed: ${tracking.error}`;
        this.log('error', `❌ Operation failed: ${operationId}`, tracking.error);
      } else if (overallStatus === 'COMPLETED') {
        tracking.receivedAmount = (lastStep?.execution as Execution)?.toAmount || updatedRoute.toAmount; // <<< Use Execution type
        tracking.statusMessage = 'Operation completed successfully.';
        this.log('info', `✅ Operation completed: ${operationId}, Received: ${tracking.receivedAmount}`);
        // Optionally remove from pendingOperations here or after a short delay
      } else if (overallStatus === 'ACTION_REQUIRED') {
        this.log('info', `🚦 ACTION_REQUIRED detected in hook for ${operationId}`);

        tracking.statusMessage = 'Action required by user.';
        // Find the specific action step
        const actionStep = updatedRoute.steps.find(step =>
          this.mapLifiStatus(step.execution?.status) === 'ACTION_REQUIRED'
        );
        if (actionStep) {
          this.log('info', `📞 Calling handleActionRequiredStep for ${operationId}`);

          // Call handler (it might already be called by the SDK, but good to ensure state is updated)
          this.handleActionRequiredStep(operationId, updatedRoute, actionStep);
        } else {
          // <<< ADD MISSING STEP LOGGING >>>
          this.log('warn', `ACTION_REQUIRED status derived, but no specific action step found for ${operationId}`);
          // <<< END ADDED LOGGING >>>
        }
      } else if (overallStatus === 'PENDING') {
        tracking.statusMessage = 'Operation in progress...';
        // Maybe add more detail here based on current step?
      } else {
        tracking.statusMessage = 'Operation status is unknown.';
      }


      // Update tracking map
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
    this.log('debug', `handleActionRequiredStep called for ${operationId}`, {
      actionStepId: actionStep.id,
      actionStepExecution: actionStep.execution // Log the whole execution object
    })

    const actionProcess = actionStep.execution?.process.find((p: any) =>
      p.status === 'ACTION_REQUIRED' && p.txRequest
    );

    this.log('debug', `Found actionProcess for ${operationId}:`, {
      processExists: !!actionProcess,
      txRequestExists: !!actionProcess?.txRequest,
      // Log all processes for comparison
      allProcesses: actionStep.execution?.process
    });

    if (!actionProcess?.txRequest) {
      this.log('warn', `handleActionRequiredStep called for ${operationId}, but no valid actionProcess with txRequest found. Bailing out.`);
      return; // Keep the return for now, but the logs above will help diagnose
    }

    if (this.autoConfirmTransactions) {
      // Auto-confirm for testing environments
      this.log('info', `🤖 Auto-confirming transaction for ${operationId}`);
      resumeRoute(updatedRoute, {
        updateRouteHook: this.createRouteUpdateHook(operationId),
        executeInBackground: true // <<< Ensure background execution continues
      }).catch(err =>
        this.log('error', `Failed to auto-resume operation via resumeRoute: ${err.message}`)
      );
    }
    else if (this.confirmationHandler) {
      // Prepare for user approval
      this.log('info', `⏸️ Pausing execution for user approval for ${operationId}`);

      // Stop execution to prevent automatic processing
      stopRouteExecution(updatedRoute);
      this.log('debug', `Called stopRouteExecution for ${operationId}`); // <<< Add log

      // Prepare transaction info for the confirmation handler
      const txInfo = {
        from: actionProcess.txRequest.from,
        to: actionProcess.txRequest.to,
        value: actionProcess.txRequest.value?.toString() || '0',
        chainId: actionStep.action.fromChainId.toString(),
        data: actionProcess.txRequest.data
      };
      this.log('debug', `Prepared txInfo for handler ${operationId}`, { txInfo }); // <<< Add log

      // Handle confirmation with timeout
      this.handleConfirmation(operationId, txInfo, this.confirmationTimeout)
        .then(approved => {
          if (approved) {
            this.log('info', `✅ User approved transaction for ${operationId}`);
            // Use the standard resumeOperation here as user interaction occurred
            this.resumeOperation(operationId).catch(err =>
              this.log('error', `Failed to resume operation after approval: ${err.message}`)
            );
          } else {
            this.log('info', `❌ User rejected transaction for ${operationId}`);
            // No need to explicitly call cancelOperation here,
            // handleConfirmation should have updated the status to FAILED via tracking
          }
        })
        .catch(err => {
          this.log('error', `Error in confirmation handler: ${err.message}`);
          // No need to explicitly call cancelOperation here,
          // handleConfirmation should have updated the status to FAILED via tracking
        });
    } else {
      // No auto-confirm and no handler - this shouldn't really happen if validation is correct
      this.log('error', `ACTION_REQUIRED for ${operationId} but no confirmation handler and autoConfirm is false. Operation stalled.`);
      // Mark as failed in tracking
      const tracking = this.pendingOperations.get(operationId);
      if (tracking) {
        tracking.status = 'FAILED';
        tracking.error = 'Operation requires confirmation but no handler is configured.';
        tracking.statusMessage = tracking.error;
        this.pendingOperations.set(operationId, tracking);
      }
    }
  }

  /**
   * Translates a LI.FI route to our standardized status format - UPDATED
   * @param route The LI.FI route object
   * @private
   */
  private translateRouteToStatus(route: RouteExtended): OperationResult {
    const status = this.deriveOverallStatus(route); // <<< Use helper to determine status
    let error: string | undefined = undefined;
    let statusMessage: string | undefined = `Overall status: ${status}`;
    let receivedAmount: string | undefined = undefined;

    if (status === 'FAILED') {
      const failedStep = route.steps.find((step) => this.mapLifiStatus(step.execution?.status) === 'FAILED');
      const failedProcess = failedStep?.execution?.process.find(p => p.status === 'FAILED');
      error = failedProcess?.error?.message || failedStep?.execution?.process[0]?.error?.message || 'Unknown error in failed step';
      statusMessage = `Operation failed: ${error}`;
    } else if (status === 'COMPLETED') {
      const lastStep = route.steps[route.steps.length - 1];
      receivedAmount = (lastStep?.execution as Execution)?.toAmount || route.toAmount;
      statusMessage = 'Operation completed successfully.';
    } else if (status === 'ACTION_REQUIRED') {
      statusMessage = 'Action required by user.';
    } else if (status === 'PENDING') {
      statusMessage = 'Operation in progress...';
    } else {
      statusMessage = 'Operation status is unknown.';
    }

    // Find source and destination transaction details
    const sourceProcess = this.findProcessWithTxHash(route.steps[0]);
    const destProcess = route.steps.length > 0 ? this.findProcessWithTxHash(route.steps[route.steps.length - 1]) : undefined;

    return {
      operationId: route.id,
      status: status,
      sourceTx: { // <<< Use sourceTx structure
        hash: sourceProcess?.txHash,
        chainId: route.fromChainId,
        explorerUrl: sourceProcess?.txLink
      },
      destinationTx: { // <<< Use destinationTx structure
        hash: destProcess?.txHash,
        chainId: route.toChainId,
        explorerUrl: destProcess?.txLink
      },
      receivedAmount: receivedAmount, // <<< Add receivedAmount
      error: error,
      statusMessage: statusMessage, // <<< Add statusMessage
      adapterName: 'lifi' // <<< Add adapterName
    };
  }

  private findProcessWithTxHash(step?: RouteExtended['steps'][0]): Process | undefined {
    return step?.execution?.process?.find((p: Process) => !!p.txHash);
  }

  private mapLifiStatus(lifiStatus?: string): OperationResult['status'] { // <<< Signature uses only ExecutionStatus
    switch (lifiStatus) {
      case 'PENDING':
      case 'STARTED': // Treat STARTED as PENDING
        return 'PENDING';
      case 'ACTION_REQUIRED':
        return 'ACTION_REQUIRED';
      case 'DONE':
        return 'COMPLETED';
      case 'FAILED':
      case 'CANCELLED': // Treat CANCELLED as FAILED
      case 'NOT_FOUND': // Treat NOT_FOUND as FAILED
        return 'FAILED';
      case undefined: // If execution hasn't started for a step yet
        return 'PENDING'; // Assume PENDING if the route/step exists
      default:
        // Use type assertion to satisfy TS in the default case for logging
        this.log('warn', `Unknown LI.FI ExecutionStatus encountered: ${lifiStatus as string}`);
        return 'UNKNOWN';
    }
  }

  private deriveOverallStatus(route: RouteExtended): OperationResult['status'] {
    if (!route.steps || route.steps.length === 0) {
      // If a route object exists but has no steps yet, assume pending.
      // This might happen briefly after creation before the hook updates.
      return 'PENDING';
    }

    let hasFailed = false;
    let needsAction = false;
    let allDone = true;
    let hasPending = false;


    for (const step of route.steps) {
      // Get the status of the current step's execution
      const stepStatus = this.mapLifiStatus(step.execution?.status);

      if (stepStatus === 'FAILED') {
        hasFailed = true;
        break; // Failure overrides everything else
      }
      if (stepStatus === 'ACTION_REQUIRED') {
        needsAction = true;
        // Continue checking other steps, as a later step might fail
      }
      if (stepStatus !== 'COMPLETED') {
        // If *any* step is not COMPLETED, the overall status cannot be COMPLETED
        allDone = false;
      }
      if (stepStatus === 'PENDING') {
        hasPending = true;
      }
      // Ignore UNKNOWN for now unless it's the only status
    }

    // Prioritize terminal or blocking statuses
    if (hasFailed) return 'FAILED';
    if (needsAction) return 'ACTION_REQUIRED';

    // Check for completion only if no failure or action is needed
    // Ensure all steps have actually been executed before declaring completion
    const allStepsHaveExecution = route.steps.every(step => step.execution);
    if (allStepsHaveExecution && allDone) return 'COMPLETED';

    // If any step is still pending (and we haven't failed or need action)
    if (hasPending) return 'PENDING';

    // Fallback if the state is unclear (e.g., steps exist but none have execution yet, or all are UNKNOWN)
    this.log('warn', `Could not determine clear overall status for route ${route.id}, falling back to UNKNOWN.`);
    return 'UNKNOWN';
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
      const activeRoute = getActiveRoute(operationId); // Get route for potential stop

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
            this.log('warn', `⏱️ Confirmation timed out for ${operationId} after ${timeout}ms`);
          }
          // <<< ADD: Stop route on timeout >>>
          if (activeRoute) {
            this.log('info', `🛑 Stopping route ${operationId} due to confirmation timeout.`);
            stopRouteExecution(activeRoute);
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
              // <<< ADD: Stop route on rejection >>>
              if (activeRoute) {
                this.log('info', `🛑 Stopping route ${operationId} due to user rejection.`);
                stopRouteExecution(activeRoute);
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
   * Converts internal tracking to standard operation result format - UPDATED
   * @private
   */
  private trackingToResult(operationId: string, tracking: OperationTracking): OperationResult {
    return {
      operationId,
      status: tracking.status,
      sourceTx: tracking.sourceTx, // <<< Use sourceTx from tracking
      destinationTx: tracking.destinationTx, // <<< Use destinationTx from tracking
      receivedAmount: tracking.receivedAmount, // <<< Use receivedAmount from tracking
      error: tracking.error,
      statusMessage: tracking.statusMessage, // <<< Use statusMessage from tracking
      adapterName: 'lifi' // <<< Add adapterName
    };
  }

  /**
   * Gets a quote for a cross-chain operation - UPDATED PARAMETER & LOGIC
   * @param intent Operation intent
   * @returns Operation quote with pricing and route information
   */
  async getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]> { // <<< Return Promise<OperationQuote[]>
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Convert our intent to LI.FI format
      const quoteRequest: QuoteRequest = {
        fromChain: Number(intent.sourceAsset.chainId),
        fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000',
        fromAddress: intent.userAddress,
        fromAmount: intent.amount,
        toChain: Number(intent.destinationAsset.chainId),
        toToken: intent.destinationAsset.address || '0x0000000000000000000000000000000000000000',
        toAddress: intent.recipientAddress || intent.userAddress,
        slippage: intent.slippageBps ? intent.slippageBps / 10000 : undefined,
        integrator: 'm3s',
        referrer: intent.referrer,
        order: intent.adapterOptions?.order as 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST' | 'SAFEST' | undefined,
        allowExchanges: intent.adapterOptions?.allowExchanges as string[] | undefined,
        denyExchanges: intent.adapterOptions?.denyExchanges as string[] | undefined,
        preferExchanges: intent.adapterOptions?.preferExchanges as string[] | undefined,
        allowBridges: intent.adapterOptions?.allowBridges as string[] | undefined,
        denyBridges: intent.adapterOptions?.denyBridges as string[] | undefined,
        preferBridges: intent.adapterOptions?.preferBridges as string[] | undefined,
      };

      // Get quote step from LI.FI
      const quoteStep: LiFiStep = await getQuote(quoteRequest);

      // --- Map LiFiStep to the NEW OperationQuote structure ---

      // Calculate total fee in USD
      const feeUSD = quoteStep.estimate.feeCosts?.reduce((sum, fee: FeeCost) => {
        // Use BigInt for potentially large fee amounts if necessary, otherwise parseFloat might suffice
        return sum + parseFloat(fee.amountUSD || '0');
      }, 0).toString() || '0';

      // Map gas costs estimate
      const firstGasCost = quoteStep.estimate.gasCosts?.[0]; // Take the first gas cost estimate
      const gasCostsEstimate = firstGasCost ? {
        limit: firstGasCost.limit || '',
        amount: firstGasCost.amount || '', // Amount in native token (e.g., wei)
        amountUSD: firstGasCost.amountUSD || '0'
      } : undefined;

      // Create the new OperationQuote object
      const operationQuote: OperationQuote = {
        id: quoteStep.id, // Use step ID as quote ID
        intent: intent,   // Include the original intent
        estimate: {
          fromAmount: quoteStep.action.fromAmount,
          toAmount: quoteStep.estimate.toAmount,
          toAmountMin: quoteStep.estimate.toAmountMin, // <<< Add toAmountMin
          routeDescription: quoteStep.toolDetails.name || quoteStep.tool, // <<< Use routeDescription field
          executionDuration: quoteStep.estimate.executionDuration, // <<< Use executionDuration field
          feeUSD: feeUSD, // <<< Use feeUSD field
          gasCosts: gasCostsEstimate, // <<< Add gasCosts
        },
        expiresAt: Math.floor(Date.now() / 1000) + (quoteStep.estimate.executionDuration || 180), // <<< Use expiresAt field, add buffer
        adapterName: 'lifi', // <<< Add adapterName
        adapterQuote: quoteStep, // <<< Store the raw LiFiStep here
        warnings: undefined, // <<< Add warnings if any (e.g., from quoteStep.estimate.warnings)
      };

      this.log('info', `Quote received: ${operationQuote.id}, ToAmountMin: ${operationQuote.estimate.toAmountMin}`);
      // Return the quote inside an array
      return [operationQuote]; // <<< Return as array

    } catch (error: any) {
      this.log('error', "Error getting operation quote:", error);
      throw new Error(`Failed to get operation quote from LI.FI: ${error.message}`);
    }
  }

  /**
   * Resumes a previously halted or paused operation
   * @param operationId ID of the operation to resume
   * @returns Updated operation result
   */
  async resumeOperation(operationId: string): Promise<OperationResult> { // <<< Return new OperationResult
    this.validatePrerequisites();

    try {
      const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion
      if (!activeRoute) {
        // Check tracking before throwing error
        const tracking = this.pendingOperations.get(operationId);
        if (tracking) {
          this.log('warn', `Cannot resume ${operationId}: No active route found, returning status from tracking.`);
          return this.trackingToResult(operationId, tracking);
        }
        throw new Error(`No active route or tracking found for operation ID: ${operationId}`);
      }

      this.log('info', `Resuming operation: ${operationId}`);
      await resumeRoute(activeRoute, {
        updateRouteHook: this.createRouteUpdateHook(operationId),
        executeInBackground: false
      });

      // Return status immediately after resuming
      return this.getOperationStatus(operationId);
    } catch (error: any) {
      this.log('error', `Error resuming operation ${operationId}:`, error);
      // Try to return a FAILED status from tracking if possible
      const tracking = this.pendingOperations.get(operationId);
      if (tracking) {
        tracking.status = 'FAILED';
        tracking.error = `Failed to resume: ${error.message}`;
        tracking.statusMessage = tracking.error;
        return this.trackingToResult(operationId, tracking);
      }
      // Otherwise, create a generic error result
      return this.createErrorResult(error); // Intent might not be available here
    }
  }

  /**
   * Cancels an in-progress operation - UPDATED RETURN TYPE
   * @param operationId ID of the operation to cancel
   * @param reason Optional reason for cancellation ("timeout" for timeout-related cancellations)
   * @returns Status of the canceled operation
   */
  async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> { // <<< Return new OperationResult
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    let tracking = this.pendingOperations.get(operationId);
    const errorMsg = reason === 'timeout'
      ? 'Operation timed out and was canceled'
      : 'Operation canceled by user';

    try {
      const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion
      if (activeRoute) {
        this.log('info', `🛑 Cancelling active route: ${operationId}`);
        stopRouteExecution(activeRoute);
      } else {
        this.log('info', `🛑 No active route for ${operationId}, marking as canceled in tracking.`);
      }

      // Update tracking regardless of active route presence
      if (tracking) {
        tracking.status = 'FAILED';
        tracking.error = errorMsg;
        tracking.statusMessage = errorMsg;
        this.pendingOperations.set(operationId, tracking);
      } else {
        // If no tracking exists, create a minimal failed result
        this.log('warn', `No tracking found for ${operationId} during cancellation.`);
        return {
          operationId,
          status: 'FAILED',
          sourceTx: {},
          error: errorMsg,
          statusMessage: errorMsg,
          adapterName: 'lifi'
        };
      }

      return this.trackingToResult(operationId, tracking); // Return updated status from tracking

    } catch (error: any) {
      this.log('error', `Failed to cancel operation ${operationId}: ${error.message}`);
      // Update tracking if possible
      if (tracking) {
        tracking.status = 'FAILED';
        tracking.error = `Cancellation failed: ${error.message}`;
        tracking.statusMessage = tracking.error;
        this.pendingOperations.set(operationId, tracking);
        return this.trackingToResult(operationId, tracking);
      }
      // Otherwise, create generic error
      return this.createErrorResult(error); // Intent might not be available
    }
  }

  /**
  * Gets the status of a previously executed operation - UPDATED RETURN TYPE & LOGIC
  * @param operationId Operation ID to check
  * @returns Operation result with updated status
  */
  async getOperationStatus(operationId: string): Promise<OperationResult> { // <<< Return new OperationResult
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      const tracking = this.pendingOperations.get(operationId);
      const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion

      // <<< ADD: Prioritize internal FAILED status from tracking if due to cancellation/timeout >>>
      if (tracking && tracking.status === 'FAILED' && (tracking.error?.includes('canceled') || tracking.error?.includes('timed out'))) {
        this.log('debug', `Returning prioritized FAILED status from tracking for ${operationId}`);
        return this.trackingToResult(operationId, tracking);
      }

      // If route is active, it's the most up-to-date source (unless overridden above)
      if (activeRoute) {
        const routeStatus = this.translateRouteToStatus(activeRoute); // <<< Use updated translateRouteToStatus
        return routeStatus;
      }

      // If no active route, return status from tracking if available
      if (tracking) {
        this.log('debug', `Returning status from tracking for ${operationId} (no active route)`);
        return this.trackingToResult(operationId, tracking); // <<< Use updated trackingToResult
      }

      // If no route and no tracking, we don't know about this operation
      this.log('warn', `No active route or tracking found for operation ID: ${operationId}`);
      return {
        operationId,
        status: 'UNKNOWN', // <<< Use UNKNOWN status
        sourceTx: {}, // <<< Empty sourceTx
        statusMessage: 'Operation not found or tracking lost.', // <<< Add statusMessage
        adapterName: 'lifi' // <<< Add adapterName
      };
    } catch (error: any) {
      this.log('error', `Error getting operation status for ${operationId}: ${error.message}`);
      // Attempt to return FAILED from tracking if possible
      const tracking = this.pendingOperations.get(operationId);
      if (tracking) {
        this.log('debug', `Returning status from tracking for ${operationId} (no active route)`);
        return this.trackingToResult(operationId, tracking); // <<< Use updated trackingToResult
      }

      // Otherwise, create generic error
      return {
        operationId,
        status: 'UNKNOWN',
        sourceTx: {},
        statusMessage: 'Operation not found or tracking lost.',
        adapterName: 'lifi'
      };
    }
  }

  /**
  * Executes a cross-chain operation based on a previously obtained quote. - UPDATED RETURN TYPE
  * @param quote The OperationQuote containing the intent and LI.FI step data.
  * @returns A promise resolving to the initial OperationResult (usually PENDING).
  */
  async executeOperation(quote: OperationQuote): Promise<OperationResult> { // <<< Return new OperationResult
    this.validatePrerequisites();
    const intent = quote.intent;
    const step = quote.adapterQuote as LiFiStep | undefined;

    if (!step || typeof step !== 'object' || !step.id || !step.action || !step.estimate) {
      this.log('error', "Invalid or incompatible LI.FI step data in adapterQuote.", { adapterQuote: quote.adapterQuote });
      return this.createErrorResult(new Error("Invalid or incompatible LI.FI step data in adapterQuote."), intent);
    }

    try {
      this.log('info', `Preparing route from quote step ${step.id}...`);
      const route = await convertQuoteToRoute(step);
      this.log('info', `Executing route ${route.id}...`);

      // Create tracking for this operation BEFORE starting execution - UPDATED
      const operationTracking: OperationTracking = {
        status: 'PENDING',
        startTime: Date.now(),
        intent: intent, // <<< Store intent
        lifiRoute: route, // <<< Store initial route
        sourceTx: { chainId: intent.sourceAsset.chainId }, // <<< Init sourceTx
        destinationTx: { chainId: intent.destinationAsset.chainId }, // <<< Init destinationTx
        statusMessage: 'Execution initiated' // <<< Init statusMessage
      };
      this.pendingOperations.set(route.id, operationTracking);

      executeRoute(route, {
        updateRouteHook: this.createRouteUpdateHook(route.id),
        executeInBackground: !this.confirmationHandler
      });

      // Return initial result using the new structure
      this.log("info", `✅ Operation initiated: ${route.id}`);

      return {
        operationId: route.id,
        status: 'PENDING',
        sourceTx: { // <<< Use sourceTx structure
          chainId: intent.sourceAsset.chainId,
        },
        destinationTx: { // <<< Use destinationTx structure
          chainId: intent.destinationAsset.chainId,
        },
        statusMessage: 'Execution initiated', // <<< Add statusMessage
        adapterName: 'lifi' // <<< Add adapterName
      };
    } catch (error: any) {
      return this.createErrorResult(error, intent);
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
    * Gets gas estimation for the destination chain - UPDATED PARAMETER
    * @param intent Operation intent
    * @returns Gas estimate with amount and USD value
    */
  async getGasOnDestination(intent: OperationIntent): Promise<{ amount: string, usdValue: string }> { // <<< Use OperationIntent
    if (!this.initialized) {
      throw new Error("LiFiAdapter not initialized");
    }

    try {
      // Get gas recommendation for destination chain using intent
      const gasRecommendation = await getGasRecommendation({
        chainId: Number(intent.destinationAsset.chainId), // <<< Use intent
        fromChain: Number(intent.sourceAsset.chainId), // <<< Use intent
        fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000' // <<< Use intent
      });

      // Return standardized format
      return {
        amount: gasRecommendation.recommended?.amount || '0',
        usdValue: gasRecommendation.recommended?.amountUsd || '0'
      };
    } catch (error: any) { // <<< Use any for error type
      this.log('error', "Error getting gas on destination:", error);
      // Return empty values on error to prevent breaking
      return {
        amount: '0',
        usdValue: '0'
      };
    }
  }

  /**
   * Set an execution provider for transaction operations
   * This can be called after initialization to add transaction capabilities
   */
  async setExecutionProvider(provider: LiFiExecutionProvider): Promise<void> {
    // --- Helper to get RPC URL ---
    const getRpcUrl = (chainId: number): string | undefined => {
      const chainInfo = this.chains.find(c => c.id === chainId);
      // Prioritize known RPCs if available, otherwise use the first explorer RPC (less ideal)
      return chainInfo?.metamask?.rpcUrls?.[0] || chainInfo?.rpcUrls?.[0] || chainInfo?.blockExplorers?.[0]?.apiUrl;
    };

    if (!this.initialized) {
      throw new Error("LiFiAdapter must be initialized before setting execution provider");
    }

    this.executionProvider = provider;
    this.log('info', `Setting up execution provider with address: ${provider.address}`);

    // --- Store the current Viem client ---
    let currentViemWalletClient = provider.walletClient as any; // Initial client

    createConfig({
      integrator: 'm3s',
      apiKey: this.apiKey,
      providers: [
        EVM({
          // <<< Provide the *current* Viem client >>>
          getWalletClient: async () => currentViemWalletClient,
          // <<< Redefine switchChain >>>
          switchChain: async (chainId: number): Promise<any> => {
            this.log('info', `Attempting to switch chain via m3s/wallet to ${chainId}`);
            if (!this.m3sWalletInstance) {
              throw new Error("m3s/wallet instance not available for switching chain.");
            }
            try {
              const rpcUrl = getRpcUrl(chainId);
              if (!rpcUrl) {
                throw new Error(`No RPC URL found for chain ${chainId}`);
              }

              // --- 1. Switch chain using m3s/wallet ---
              const chainInfo = this.chains.find(c => c.id === chainId);
              const providerConfig = {
                chainConfig: {
                  chainId: `0x${chainId.toString(16)}`,
                  rpcTarget: rpcUrl,
                  chainNamespace: 'eip155',
                  displayName: chainInfo?.name || `Chain ${chainId}`,
                  blockExplorer: chainInfo?.blockExplorers?.[0]?.url || '',
                  ticker: chainInfo?.nativeCurrency?.symbol || 'ETH',
                  tickerName: chainInfo?.nativeCurrency?.name || 'Ether',
                }
              };
              // Use the stored m3s/wallet instance to switch
              await this.m3sWalletInstance.setProvider(providerConfig);
              this.log('info', `Successfully switched chain via m3s/wallet to ${chainId}`);

              // --- 2. Create a *new* Viem WalletClient for the new chain ---
              const viemChain = findViemChain(chainId); // Map ID to Viem chain object
              if (!viemChain) {
                throw new Error(`Viem chain configuration not found for chainId: ${chainId}`);
              }
              // Ensure we have the account details (might need to get from m3sWalletInstance or provider)
              const account = (currentViemWalletClient as any).account; // Get account from old client
              if (!account) {
                throw new Error("Cannot get account details to create new Viem client.");
              }

              currentViemWalletClient = createWalletClient({ // Update the stored client
                account,
                chain: viemChain,
                transport: http(rpcUrl)
              });
              this.log('info', `Created new Viem client for chain ${chainId}`);

              // --- 3. Return the *new* Viem client ---
              // LiFi SDK's getWalletClient will now get this updated client
              return currentViemWalletClient;

            } catch (error: any) {
              this.log('error', `Failed to switch chain to ${chainId}: ${error.message}`);
              throw error;
            }
          }
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