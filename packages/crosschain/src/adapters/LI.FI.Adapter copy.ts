// import { ICrossChain, OperationIntent, OperationQuote, OperationResult, ChainAsset, TransactionConfirmationHandler } from '../types/interfaces/index.js';
// import {
//   getChains,
//   getQuote,
//   getTokens,
//   convertQuoteToRoute,
//   executeRoute,
//   createConfig,
//   QuoteRequest,
//   EVM,
//   ChainType,
//   ChainId,
//   getGasRecommendation,
//   getActiveRoute,
//   RouteExtended,
//   resumeRoute,
//   stopRouteExecution,
//   LiFiStep,
//   FeeCost,
//   Process,
//   Execution
// } from '@lifi/sdk';
// import { IEVMWallet } from '@m3s/wallet'; // <<< Import IEVMWallet
// import { createWalletClient, http } from 'viem';
// import * as viemChains from 'viem/chains'

// /**
//  * Interface for LI.FI execution provider
//  * Abstraction over any wallet implementation that can execute transactions
//  */
// export interface LiFiExecutionProvider {
//   address: any;
//   walletClient: any;
//   signTransaction: (tx: any) => Promise<string>;
//   switchChain: (chainId: number) => Promise<any>;
// }

// /**
//  * Base configuration for the LI.FI adapter (read-only operations)
//  */
// export interface LiFiConfig {
//   apiKey?: string;
//   apiUrl?: string;
//   provider?: LiFiExecutionProvider;
//   confirmationHandler?: TransactionConfirmationHandler;
//   autoConfirmTransactions?: boolean; // Only for testing environments!
//   confirmationTimeout?: number; // Timeout in milliseconds for confirmation
//   pendingOperationTimeout?: number; // Auto-cancel pending operations after this time (ms)
// }

// /**
//  * LI.FI adapter configuration arguments
//  */
// export interface LiFiAdapterArgs {
//   adapterName: string;
//   config?: LiFiConfig;
//   options?: any;
// }


// function findViemChain(chainId: number): viemChains.Chain | undefined {
//   for (const key in viemChains) {
//     const chain = (viemChains as any)[key] as viemChains.Chain;
//     if (chain.id === chainId) {
//       return chain;
//     }
//   }
//   return undefined;
// }

// /**
//  * Internal operation tracking structure - UPDATED
//  */
// interface OperationTracking {
//   status: OperationResult['status']; // <<< Use status from new OperationResult
//   startTime: number;
//   intent: OperationIntent; // <<< Keep intent (renamed from params)
//   lifiRoute?: RouteExtended; // <<< Store the route for status updates
//   sourceTx: OperationResult['sourceTx']; // <<< Match OperationResult structure
//   destinationTx?: OperationResult['destinationTx']; // <<< Match OperationResult structure
//   receivedAmount?: string; // <<< Match OperationResult structure
//   error?: string; // <<< Match OperationResult structure
//   statusMessage?: string; // <<< Match OperationResult structure
//   isAwaitingConfirmationDetails?: boolean;
// }

// /**
//  * Adapter for LI.FI cross-chain operations
//  * Implements the ICrossChain interface using LI.FI's API
//  */
// export class LiFiAdapter implements ICrossChain {
//   // Configuration
//   private apiKey?: string;
//   private apiUrl?: string;

//   // State
//   private initialized: boolean = false;
//   private chains: any[] = [];
//   private cachedChains: { chainId: number, name: string }[] | null = null;
//   private cachedTokens: Map<string, ChainAsset[]> = new Map();

//   // Execution provider (optional)
//   private executionProvider?: LiFiExecutionProvider;
//   private confirmationHandler?: TransactionConfirmationHandler;
//   private autoConfirmTransactions?: boolean;

//   // Optional timeouts.
//   private confirmationTimeout?: number;
//   private pendingOperationTimeout?: number;

//   // Keep track of in-progress operations
//   private pendingOperations: Map<string, OperationTracking> = new Map();
//   private m3sWalletInstance?: IEVMWallet;

//   /**
//    * Private constructor - use static create method
//    */
//   private constructor(args: LiFiAdapterArgs) {
//     // Only store basic configuration in constructor
//     this.apiKey = args.config?.apiKey;
//     this.apiUrl = args.config?.apiUrl;
//   }

//   /**
//    * Factory method to create an instance of LiFiAdapter
//    */
//   static async create(args: { adapterName: string, config?: LiFiConfig }): Promise<LiFiAdapter> {
//     const adapter = new LiFiAdapter(args);

//     if (args.config) {
//       await adapter.initialize(args.config);
//     }

//     return adapter;
//   }

//   /**
//    * Initializes the adapter with the given configuration (API-only)
//    */
//   async initialize(config: LiFiConfig): Promise<void> {
//     if (this.initialized) return;

//     this.log('info', "Initializing LiFiAdapter", {
//       apiKey: config.apiKey ? "***" : undefined,
//       apiUrl: config.apiUrl
//     });

//     // Store configuration
//     this.apiKey = config.apiKey || this.apiKey;
//     this.apiUrl = config.apiUrl || this.apiUrl;
//     this.confirmationHandler = config.confirmationHandler;
//     this.autoConfirmTransactions = config.autoConfirmTransactions;
//     this.confirmationTimeout = config.confirmationTimeout;
//     this.pendingOperationTimeout = config.pendingOperationTimeout

//     createConfig({
//       integrator: 'm3s',
//       apiKey: this.apiKey
//     });

//     // Load chains for future use 
//     this.chains = await getChains({ chainTypes: [ChainType.EVM] });

//     // Mark as initialized
//     this.initialized = true;
//     config.provider && this.setExecutionProvider(config.provider)
//   }

//   /**
//    * Checks if the adapter has been initialized
//    */
//   isInitialized(): boolean {
//     return this.initialized;
//   }

//   /**
//    * Validates the adapter is ready for operations
//    * @private
//    */
//   private validatePrerequisites(): void {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     if (!this.executionProvider) {
//       throw new Error("Execution provider required for transaction execution");
//     }
//   }

//   /**
//    * Creates a standardized error result - UPDATED RETURN TYPE
//    * @param error The error object
//    * @param intent The operation intent (extracted from quote)
//    * @private
//    */
//   private createErrorResult(error: any, intent?: OperationIntent): OperationResult { // <<< Return new OperationResult
//     this.log('error', `Operation failed: ${error.message}`);
//     const opId = Math.random().toString(36).substring(2, 15); // Generate a random ID
//     const errorMessage = error.message || "Unknown error during execution";

//     return {
//       operationId: opId,
//       status: 'FAILED',
//       sourceTx: { // <<< Use sourceTx structure
//         chainId: intent?.sourceAsset.chainId,
//       },
//       destinationTx: { // <<< Use destinationTx structure
//         chainId: intent?.destinationAsset.chainId,
//       },
//       error: errorMessage,
//       statusMessage: `Operation failed: ${errorMessage}`, // <<< Add statusMessage
//       adapterName: 'lifi' // <<< Add adapterName
//     };
//   }

//   /**
//      * Creates a route update hook for tracking status changes - UPDATED LOGIC
//      * @param operationId The operation ID
//      * @private
//      */
//   private createRouteUpdateHook(operationId: string): (route: RouteExtended) => void {
//     return (updatedRoute: RouteExtended) => {
//       this.log('debug', `Route Update Hook Called for ${operationId}`, { /* ... */ });
//       const tracking = this.pendingOperations.get(operationId);
//       if (!tracking) { /* ... */ return; }

//       tracking.lifiRoute = updatedRoute;
//       const previousStatus = tracking.status; // Capture status *before* any updates in this hook
//       const overallStatus = this.deriveOverallStatus(updatedRoute);
//       this.log('debug', `[Hook Start ${operationId}] PrevStatus(Track): ${previousStatus}, DerivedOverall: ${overallStatus}, IsWaiting: ${tracking.isAwaitingConfirmationDetails}`);

//       // Update tracking status if it changed
//       if (tracking.status !== overallStatus) {
//         this.log('debug', `[Status Change ${operationId}] Updating tracking.status from ${tracking.status} to ${overallStatus}`);
//         tracking.status = overallStatus; // Update the tracking object's status
//       }

//       const needsActionCheck = tracking.isAwaitingConfirmationDetails || (previousStatus !== 'ACTION_REQUIRED' && overallStatus === 'ACTION_REQUIRED');

//       if (needsActionCheck) {
//         this.log('debug', `[Action Check ${operationId}] Needs check. IsWaiting: ${tracking.isAwaitingConfirmationDetails}, OverallStatus: ${overallStatus}, PrevStatusVar: ${previousStatus}`);
//         const actionStep = updatedRoute.steps.find(step =>
//           this.mapLifiStatus(step.execution?.status) === 'ACTION_REQUIRED'
//         );

//         if (actionStep) {
//           this.log('debug', `[Calling Handler ${operationId}] Found action step ${actionStep.id}. IsWaiting: ${tracking.isAwaitingConfirmationDetails}`);
//           // Call the handler. It will check for txRequest and manage the isAwaitingConfirmationDetails flag internally.
//           this.handleActionRequiredStep(operationId, updatedRoute, actionStep);
//           // Log status *after* handler call (flag might have changed)
//           this.log('debug', `[After Handler Call ${operationId}] IsWaiting: ${tracking.isAwaitingConfirmationDetails}`);
//         } else if (tracking.isAwaitingConfirmationDetails) {
//           // If we were waiting, but there's no ACTION_REQUIRED step anymore,
//           // it might have resolved or failed. The status update below will handle it.
//           // We only reset the flag explicitly on terminal states now.
//           this.log('debug', `[Action Check ${operationId}] Was waiting, but no ACTION_REQUIRED step found now. Status: ${overallStatus}. Flag remains ${tracking.isAwaitingConfirmationDetails} until terminal state.`);
//         } else {
//           // overallStatus is ACTION_REQUIRED, but no specific step found (should be rare)
//           this.log('warn', `[Action Check ${operationId}] Overall status is ACTION_REQUIRED, but no specific action step found.`);
//         }
//       }

//       // --- Update Status Message and Error ---
//       if (overallStatus === 'FAILED') {
//         const failedStep = updatedRoute.steps.find((step) => this.mapLifiStatus(step.execution?.status) === 'FAILED');
//         const failedProcess = failedStep?.execution?.process.find(p => p.status === 'FAILED');
//         tracking.error = failedProcess?.error?.message || failedStep?.execution?.process[0]?.error?.message || 'Unknown error in failed step';
//         tracking.statusMessage = `Operation failed: ${tracking.error}`;
//         this.log('error', `❌ Operation failed: ${operationId}`, tracking.error);
//         // Ensure flag is cleared on failure
//         if (tracking.isAwaitingConfirmationDetails) {
//           this.log('debug', `[Resetting Flag ${operationId}] Clearing wait flag due to FAILED status.`);
//           tracking.isAwaitingConfirmationDetails = false;
//         }
//       } else if (overallStatus === 'COMPLETED') {
//         tracking.receivedAmount = (updatedRoute.steps[updatedRoute.steps.length - 1]?.execution as Execution)?.toAmount || updatedRoute.toAmount;
//         tracking.statusMessage = 'Operation completed successfully.';
//         this.log('info', `✅ Operation completed: ${operationId}, Received: ${tracking.receivedAmount}`);
//         // Ensure flag is cleared on completion
//         if (tracking.isAwaitingConfirmationDetails) {
//           this.log('debug', `[Resetting Flag ${operationId}] Clearing wait flag due to COMPLETED status.`);
//           tracking.isAwaitingConfirmationDetails = false;
//         }
//       } else if (overallStatus === 'ACTION_REQUIRED') {
//         // Message might be set by handleActionRequiredStep if waiting
//         if (!tracking.isAwaitingConfirmationDetails) {
//           tracking.statusMessage = 'Action required by user.';
//         } else {
//           tracking.statusMessage = 'Waiting for transaction details...'; // Keep this message while waiting
//         }
//       } else if (overallStatus === 'PENDING') {
//         tracking.statusMessage = 'Operation in progress...';
//         // DO NOT reset the flag here if status flips temporarily to PENDING while waiting
//       } else { // UNKNOWN
//         tracking.statusMessage = 'Operation status is unknown.';
//         // Ensure flag is cleared on unknown status
//         if (tracking.isAwaitingConfirmationDetails) {
//           this.log('debug', `[Resetting Flag ${operationId}] Clearing wait flag due to UNKNOWN status.`);
//           tracking.isAwaitingConfirmationDetails = false;
//         }
//       }

//       this.pendingOperations.set(operationId, tracking);
//       this.log('debug', `[Hook End ${operationId}] Final Tracking Status: ${tracking.status}, IsWaiting: ${tracking.isAwaitingConfirmationDetails}`);
//     };

//   }

//   /**
//  * Handle steps requiring user action/confirmation
//  * @private
//  */
//   private handleActionRequiredStep(
//     operationId: string,
//     updatedRoute: RouteExtended,
//     actionStep: any
//   ): void {
//     const tracking = this.pendingOperations.get(operationId);
//     if (!tracking) {
//       this.log('error', `Tracking not found in handleActionRequiredStep for ${operationId}`);
//       return;
//     }

//     const actionProcess = actionStep.execution?.process.find((p: any) =>
//       p.status === 'ACTION_REQUIRED' && p.txRequest
//     );

//     this.log('debug', `Checking for actionProcess with txRequest for ${operationId}:`, {
//       processFound: !!actionProcess,
//       txRequestFound: !!actionProcess?.txRequest,
//       currentTrackingStatus: tracking.status, // Log status from tracking
//       isAlreadyWaiting: tracking.isAwaitingConfirmationDetails
//     });

//     this.log('debug', `Checking for actionProcess with txRequest for ${operationId}:`, {
//       processFound: !!actionProcess,
//       txRequestFound: !!actionProcess?.txRequest,
//       currentTrackingStatus: tracking.status, // Log status from tracking
//       isAlreadyWaiting: tracking.isAwaitingConfirmationDetails
//     });

//     if (actionProcess?.txRequest) {
//       // --- txRequest FOUND - Proceed with confirmation ---
//       this.log('info', `txRequest found for ${operationId}. Proceeding with confirmation logic.`);
//       tracking.isAwaitingConfirmationDetails = false; // Clear the flag

//       if (this.autoConfirmTransactions) {
//         this.log('info', `🤖 Auto-confirming transaction for ${operationId}`);
//         resumeRoute(updatedRoute, { /* ... */ }).catch(/* ... */);
//       } else if (this.confirmationHandler) {
//         this.log('info', `⏸️ Execution should be paused by SDK for user approval for ${operationId}`);
//         const txInfo = { /* ... */ };
//         this.log('debug', `Prepared txInfo for handler ${operationId}`, { txInfo });
//         this.handleConfirmation(operationId, txInfo, this.confirmationTimeout)
//           .then(approved => {
//             if (approved) {
//               this.log('info', `✅ User approved transaction for ${operationId}`);
//             } else {
//               this.log('info', `❌ User rejected transaction for ${operationId}`);
//               // Status should already be FAILED via handleConfirmation
//             }
//           })
//           .catch(err => {
//             this.log('error', `Error in confirmation handler: ${err.message}`);
//             // Status should already be FAILED via handleConfirmation
//           });
//       } else {
//         this.log('error', `ACTION_REQUIRED for ${operationId} but no confirmation handler and autoConfirm is false. Operation stalled.`);
//         tracking.status = 'FAILED';
//         tracking.error = 'Operation requires confirmation but no handler is configured.';
//         tracking.statusMessage = tracking.error;
//       }
//     } else {
//       // --- txRequest NOT FOUND - Set flag and wait ---
//       // Only set the flag if it's not already set, to avoid redundant logs? No, always set to ensure state.
//       // this.log('warn', `txRequest not found yet for ACTION_REQUIRED step ${actionStep.id} in operation ${operationId}. Setting flag and waiting for next update.`);
//       // this.log('warn', `txRequest actionStep:  ${JSON.stringify(actionStep, null, 2)}.`);

//       // <<< SET THE FLAG HERE >>>
//       tracking.isAwaitingConfirmationDetails = true;
//       tracking.statusMessage = 'Waiting for transaction details...'; // Update status message
//     }

//     // Update tracking map with potential changes (flag, statusMessage)
//     this.pendingOperations.set(operationId, tracking);
//   }

//   /**
//    * Translates a LI.FI route to our standardized status format - UPDATED
//    * @param route The LI.FI route object
//    * @private
//    */
//   private translateRouteToStatus(route: RouteExtended): OperationResult {
//     const status = this.deriveOverallStatus(route); // <<< Use helper to determine status
//     let error: string | undefined = undefined;
//     let statusMessage: string | undefined = `Overall status: ${status}`;
//     let receivedAmount: string | undefined = undefined;

//     if (status === 'FAILED') {
//       const failedStep = route.steps.find((step) => this.mapLifiStatus(step.execution?.status) === 'FAILED');
//       const failedProcess = failedStep?.execution?.process.find(p => p.status === 'FAILED');
//       error = failedProcess?.error?.message || failedStep?.execution?.process[0]?.error?.message || 'Unknown error in failed step';
//       statusMessage = `Operation failed: ${error}`;
//     } else if (status === 'COMPLETED') {
//       const lastStep = route.steps[route.steps.length - 1];
//       // Attempt to get received amount from the execution details of the last step
//       receivedAmount = (lastStep?.execution as Execution)?.toAmount || route.toAmount;
//       // Fallback or refinement: Look for a RECEIVING process in the last step
//       const receivingProcess = lastStep?.execution?.process?.find((p: any) => p.type === 'RECEIVING');
//       if (receivingProcess && (receivingProcess as any).output?.amount) {
//         receivedAmount = (receivingProcess as any).output.amount;
//       }
//       statusMessage = 'Operation completed successfully.';
//     } else if (status === 'ACTION_REQUIRED') {
//       // Check if we are waiting for tx details specifically
//       const tracking = this.pendingOperations.get(route.id);
//       statusMessage = tracking?.isAwaitingConfirmationDetails
//         ? 'Waiting for transaction details...'
//         : 'Action required by user.';
//     } else if (status === 'PENDING') {
//       statusMessage = 'Operation in progress...';
//     } else {
//       statusMessage = 'Operation status is unknown.';
//     }

//     // Find source and destination transaction details
//     const sourceProcess = this.findProcessWithTxHash(route.steps[0]);
//     // --- Refined Destination Transaction Logic ---
//     let destTxHash: string | undefined = undefined;
//     let destTxExplorerUrl: string | undefined = undefined;

//     for (let i = route.steps.length - 1; i >= 0; i--) {
//       const step = route.steps[i];
//       // Check if this step involves the destination chain
//       if ((step.action.toChainId === route.toChainId || step.action.fromChainId === route.toChainId) && step.execution?.process) {
//         // Find the first process in this step (could be SWAP, CROSS_CHAIN, RECEIVING) that has a txHash *and* is on the destination chain
//         const processWithHashOnDestChain = step.execution.process.find(p => !!p.txHash && p.chainId === route.toChainId);
//         if (processWithHashOnDestChain) {
//           destTxHash = processWithHashOnDestChain.txHash;
//           destTxExplorerUrl = processWithHashOnDestChain.txLink;
//           this.log('debug', `Found destTxHash ${destTxHash} in step ${i} process type ${processWithHashOnDestChain.type} on chain ${processWithHashOnDestChain.chainId}`);
//           break; // Found the latest destination chain tx with a hash
//         }
//         // Fallback: Check any process in this step if no specific dest chain process found yet
//         if (!destTxHash) {
//           const anyProcessWithHash = step.execution.process.find(p => !!p.txHash);
//           if (anyProcessWithHash && anyProcessWithHash.chainId === route.toChainId) { // Ensure it's on the correct chain
//             destTxHash = anyProcessWithHash.txHash;
//             destTxExplorerUrl = anyProcessWithHash.txLink;
//             this.log('debug', `Found destTxHash ${destTxHash} (fallback) in step ${i} process type ${anyProcessWithHash.type} on chain ${anyProcessWithHash.chainId}`);
//             break;
//           }
//         }
//       }
//     }
//     // Final Fallback: If still no hash, check the very last process of the last step (original logic), ensuring chainId matches
//     if (!destTxHash && route.steps.length > 0) {
//       const lastStep = route.steps[route.steps.length - 1];
//       const lastProcessWithHash = lastStep?.execution?.process?.slice().reverse().find(p => !!p.txHash && p.chainId === route.toChainId); // Check last process first on dest chain
//       if (lastProcessWithHash) {
//         destTxHash = lastProcessWithHash.txHash;
//         destTxExplorerUrl = lastProcessWithHash.txLink;
//         this.log('debug', `Found destTxHash ${destTxHash} (final fallback) in last step process type ${lastProcessWithHash.type}`);
//       } else {
//         this.log('debug', `Could not find destination tx hash on chain ${route.toChainId} after checking all steps.`);
//       }
//     }

//     return {
//       operationId: route.id,
//       status: status,
//       sourceTx: {
//         hash: sourceProcess?.txHash,
//         chainId: route.fromChainId,
//         explorerUrl: sourceProcess?.txLink
//       },
//       destinationTx: {
//         hash: destTxHash, // <<< Use refined hash
//         chainId: route.toChainId,
//         explorerUrl: destTxExplorerUrl // <<< Use refined explorer URL
//       },
//       receivedAmount: receivedAmount,
//       error: error,
//       statusMessage: statusMessage,
//       adapterName: 'lifi'
//     };
//   }

//   private findProcessWithTxHash(step?: RouteExtended['steps'][0]): Process | undefined {
//     return step?.execution?.process?.find((p: Process) => !!p.txHash);
//   }

//   private mapLifiStatus(lifiStatus?: string): OperationResult['status'] { // <<< Signature uses only ExecutionStatus
//     switch (lifiStatus) {
//       case 'PENDING':
//       case 'STARTED': // Treat STARTED as PENDING
//         return 'PENDING';
//       case 'ACTION_REQUIRED':
//         return 'ACTION_REQUIRED';
//       case 'DONE':
//         return 'COMPLETED';
//       case 'FAILED':
//       case 'CANCELLED': // Treat CANCELLED as FAILED
//       case 'NOT_FOUND': // Treat NOT_FOUND as FAILED
//         return 'FAILED';
//       case undefined: // If execution hasn't started for a step yet
//         return 'PENDING'; // Assume PENDING if the route/step exists
//       default:
//         // Use type assertion to satisfy TS in the default case for logging
//         this.log('warn', `Unknown LI.FI ExecutionStatus encountered: ${lifiStatus as string}`);
//         return 'UNKNOWN';
//     }
//   }

//   private deriveOverallStatus(route: RouteExtended): OperationResult['status'] {
//     if (!route.steps || route.steps.length === 0) {
//       // If a route object exists but has no steps yet, assume pending.
//       // This might happen briefly after creation before the hook updates.
//       return 'PENDING';
//     }

//     let hasFailed = false;
//     let needsAction = false;
//     let allDone = true;
//     let hasPending = false;


//     for (const step of route.steps) {
//       // Get the status of the current step's execution
//       const stepStatus = this.mapLifiStatus(step.execution?.status);

//       if (stepStatus === 'FAILED') {
//         hasFailed = true;
//         break; // Failure overrides everything else
//       }
//       if (stepStatus === 'ACTION_REQUIRED') {
//         needsAction = true;
//         // Continue checking other steps, as a later step might fail
//       }
//       if (stepStatus !== 'COMPLETED') {
//         // If *any* step is not COMPLETED, the overall status cannot be COMPLETED
//         allDone = false;
//       }
//       if (stepStatus === 'PENDING') {
//         hasPending = true;
//       }
//       // Ignore UNKNOWN for now unless it's the only status
//     }

//     // Prioritize terminal or blocking statuses
//     if (hasFailed) return 'FAILED';
//     if (needsAction) return 'ACTION_REQUIRED';

//     // Check for completion only if no failure or action is needed
//     // Ensure all steps have actually been executed before declaring completion
//     const allStepsHaveExecution = route.steps.every(step => step.execution);
//     if (allStepsHaveExecution && allDone) return 'COMPLETED';

//     // If any step is still pending (and we haven't failed or need action)
//     if (hasPending) return 'PENDING';

//     // Fallback if the state is unclear (e.g., steps exist but none have execution yet, or all are UNKNOWN)
//     this.log('warn', `Could not determine clear overall status for route ${route.id}, falling back to UNKNOWN.`);
//     return 'UNKNOWN';
//   }

//   /**
//    * Handles user confirmation for transactions with timeout support
//    * @param operationId The operation ID
//    * @param txInfo Transaction information
//    * @param timeout Optional timeout in milliseconds
//    * @private
//    */
//   private async handleConfirmation(
//     operationId: string,
//     txInfo: any,
//     timeout?: number
//   ): Promise<boolean> {
//     if (!this.confirmationHandler) {
//       return true;
//     }
//     // Handle confirmation with clean timeout logic
//     return new Promise<boolean>((resolve, reject) => {
//       let isResolved = false;
//       const activeRoute = getActiveRoute(operationId); // Get route for potential stop

//       // Set up timeout if specified
//       const timeoutId = timeout ? setTimeout(() => {
//         if (!isResolved) {
//           isResolved = true;

//           // Mark the operation as failed due to timeout
//           const tracking = this.pendingOperations.get(operationId);
//           if (tracking) {
//             tracking.status = 'FAILED';
//             tracking.error = `Confirmation timed out after ${timeout}ms`;
//             this.pendingOperations.set(operationId, tracking);
//             this.log('warn', `⏱️ Confirmation timed out for ${operationId} after ${timeout}ms`);
//           }
//           // <<< ADD: Stop route on timeout >>>
//           if (activeRoute) {
//             this.log('info', `🛑 Stopping route ${operationId} due to confirmation timeout.`);
//             stopRouteExecution(activeRoute);
//           }

//           reject(new Error(`Confirmation timed out after ${timeout}ms`));
//         }
//       }, timeout) : null;

//       // Call the confirmation handler
//       this.confirmationHandler!.onConfirmationRequired(operationId, txInfo)
//         .then(approved => {
//           if (!isResolved) {
//             isResolved = true;
//             if (timeoutId) clearTimeout(timeoutId);

//             if (!approved) {
//               // Mark as rejected by user
//               const tracking = this.pendingOperations.get(operationId);
//               if (tracking) {
//                 tracking.status = 'FAILED';
//                 tracking.error = 'Transaction rejected by user';
//                 this.pendingOperations.set(operationId, tracking);
//               }
//               // <<< ADD: Stop route on rejection >>>
//               if (activeRoute) {
//                 this.log('info', `🛑 Stopping route ${operationId} due to user rejection.`);
//                 stopRouteExecution(activeRoute);
//               }
//             }
//             resolve(approved);
//           }
//         })
//         .catch(err => {
//           if (!isResolved) {
//             isResolved = true;
//             if (timeoutId) clearTimeout(timeoutId);

//             // Mark operation as failed due to handler error
//             const tracking = this.pendingOperations.get(operationId);
//             if (tracking) {
//               tracking.status = 'FAILED';
//               tracking.error = `Confirmation handler error: ${err.message}`;
//               this.pendingOperations.set(operationId, tracking);
//             }

//             reject(err);
//           }
//         });
//     });
//   }

//   private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
//     // Only show important logs by default
//     const showDebug = false;

//     if (level === 'debug' && !showDebug) return;

//     const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
//     const prefix = `[LiFiAdapter ${timestamp}]`;

//     switch (level) {
//       case 'info':
//         if (data) {
//           console.log(`${prefix} ${message}`, data);
//         } else {
//           console.log(`${prefix} ${message}`);
//         }
//         break;
//       case 'warn':
//         if (data) {
//           console.warn(`${prefix} ⚠️ ${message}`, data);
//         } else {
//           console.warn(`${prefix} ⚠️ ${message}`);
//         }
//         break;
//       case 'error':
//         if (data) {
//           console.error(`${prefix} 🚨 ${message}`, data);
//         } else {
//           console.error(`${prefix} 🚨 ${message}`);
//         }
//         break;
//       case 'debug':
//         if (data) {
//           console.log(`${prefix} 🔍 ${message}`, data);
//         } else {
//           console.log(`${prefix} 🔍 ${message}`);
//         }
//         break;
//     }
//   }

//   /**
//    * Converts internal tracking to standard operation result format - UPDATED
//    * @private
//    */
//   private trackingToResult(operationId: string, tracking: OperationTracking): OperationResult {
//     return {
//       operationId,
//       status: tracking.status,
//       sourceTx: tracking.sourceTx, // <<< Use sourceTx from tracking
//       destinationTx: tracking.destinationTx, // <<< Use destinationTx from tracking
//       receivedAmount: tracking.receivedAmount, // <<< Use receivedAmount from tracking
//       error: tracking.error,
//       statusMessage: tracking.statusMessage, // <<< Use statusMessage from tracking
//       adapterName: 'lifi' // <<< Add adapterName
//     };
//   }

//   /**
//    * Gets a quote for a cross-chain operation - UPDATED PARAMETER & LOGIC
//    * @param intent Operation intent
//    * @returns Operation quote with pricing and route information
//    */
//   async getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]> { // <<< Return Promise<OperationQuote[]>
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Convert our intent to LI.FI format
//       const quoteRequest: QuoteRequest = {
//         fromChain: Number(intent.sourceAsset.chainId),
//         fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000',
//         fromAddress: intent.userAddress,
//         fromAmount: intent.amount,
//         toChain: Number(intent.destinationAsset.chainId),
//         toToken: intent.destinationAsset.address || '0x0000000000000000000000000000000000000000',
//         toAddress: intent.recipientAddress || intent.userAddress,
//         slippage: intent.slippageBps ? intent.slippageBps / 10000 : undefined,
//         integrator: 'm3s',
//         referrer: intent.referrer,
//         order: intent.adapterOptions?.order as 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST' | 'SAFEST' | undefined,
//         allowExchanges: intent.adapterOptions?.allowExchanges as string[] | undefined,
//         denyExchanges: intent.adapterOptions?.denyExchanges as string[] | undefined,
//         preferExchanges: intent.adapterOptions?.preferExchanges as string[] | undefined,
//         allowBridges: intent.adapterOptions?.allowBridges as string[] | undefined,
//         denyBridges: intent.adapterOptions?.denyBridges as string[] | undefined,
//         preferBridges: intent.adapterOptions?.preferBridges as string[] | undefined,
//       };

//       // Get quote step from LI.FI
//       const quoteStep: LiFiStep = await getQuote(quoteRequest);

//       // --- Map LiFiStep to the NEW OperationQuote structure ---

//       // Calculate total fee in USD
//       const feeUSD = quoteStep.estimate.feeCosts?.reduce((sum, fee: FeeCost) => {
//         // Use BigInt for potentially large fee amounts if necessary, otherwise parseFloat might suffice
//         return sum + parseFloat(fee.amountUSD || '0');
//       }, 0).toString() || '0';

//       // Map gas costs estimate
//       const firstGasCost = quoteStep.estimate.gasCosts?.[0]; // Take the first gas cost estimate
//       const gasCostsEstimate = firstGasCost ? {
//         limit: firstGasCost.limit || '',
//         amount: firstGasCost.amount || '', // Amount in native token (e.g., wei)
//         amountUSD: firstGasCost.amountUSD || '0'
//       } : undefined;

//       // Create the new OperationQuote object
//       const operationQuote: OperationQuote = {
//         id: quoteStep.id, // Use step ID as quote ID
//         intent: intent,   // Include the original intent
//         estimate: {
//           fromAmount: quoteStep.action.fromAmount,
//           toAmount: quoteStep.estimate.toAmount,
//           toAmountMin: quoteStep.estimate.toAmountMin, // <<< Add toAmountMin
//           routeDescription: quoteStep.toolDetails.name || quoteStep.tool, // <<< Use routeDescription field
//           executionDuration: quoteStep.estimate.executionDuration, // <<< Use executionDuration field
//           feeUSD: feeUSD, // <<< Use feeUSD field
//           gasCosts: gasCostsEstimate, // <<< Add gasCosts
//         },
//         expiresAt: Math.floor(Date.now() / 1000) + (quoteStep.estimate.executionDuration || 180), // <<< Use expiresAt field, add buffer
//         adapterName: 'lifi', // <<< Add adapterName
//         adapterQuote: quoteStep, // <<< Store the raw LiFiStep here
//         warnings: undefined, // <<< Add warnings if any (e.g., from quoteStep.estimate.warnings)
//       };

//       this.log('info', `Quote received: ${operationQuote.id}, ToAmountMin: ${operationQuote.estimate.toAmountMin}`);
//       // Return the quote inside an array
//       return [operationQuote]; // <<< Return as array

//     } catch (error: any) {
//       this.log('error', "Error getting operation quote:", error);
//       throw new Error(`Failed to get operation quote from LI.FI: ${error.message}`);
//     }
//   }

//   /**
//    * Resumes a previously halted or paused operation
//    * @param operationId ID of the operation to resume
//    * @returns Updated operation result
//    */
//   async resumeOperation(operationId: string): Promise<OperationResult> { // <<< Return new OperationResult
//     this.validatePrerequisites();

//     try {
//       const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion
//       if (!activeRoute) {
//         // Check tracking before throwing error
//         const tracking = this.pendingOperations.get(operationId);
//         if (tracking) {
//           this.log('warn', `Cannot resume ${operationId}: No active route found, returning status from tracking.`);
//           return this.trackingToResult(operationId, tracking);
//         }
//         throw new Error(`No active route or tracking found for operation ID: ${operationId}`);
//       }

//       this.log('info', `Resuming operation: ${operationId}`);
//       await resumeRoute(activeRoute, {
//         updateRouteHook: this.createRouteUpdateHook(operationId),
//         executeInBackground: false
//       });

//       // Return status immediately after resuming
//       return this.getOperationStatus(operationId);
//     } catch (error: any) {
//       this.log('error', `Error resuming operation ${operationId}:`, error);
//       // Try to return a FAILED status from tracking if possible
//       const tracking = this.pendingOperations.get(operationId);
//       if (tracking) {
//         tracking.status = 'FAILED';
//         tracking.error = `Failed to resume: ${error.message}`;
//         tracking.statusMessage = tracking.error;
//         return this.trackingToResult(operationId, tracking);
//       }
//       // Otherwise, create a generic error result
//       return this.createErrorResult(error); // Intent might not be available here
//     }
//   }

//   /**
//    * Cancels an in-progress operation - UPDATED RETURN TYPE
//    * @param operationId ID of the operation to cancel
//    * @param reason Optional reason for cancellation ("timeout" for timeout-related cancellations)
//    * @returns Status of the canceled operation
//    */
//   async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> { // <<< Return new OperationResult
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     let tracking = this.pendingOperations.get(operationId);
//     const errorMsg = reason === 'timeout'
//       ? 'Operation timed out and was canceled'
//       : 'Operation canceled by user';

//     try {
//       const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion
//       if (activeRoute) {
//         this.log('info', `🛑 Cancelling active route: ${operationId}`);
//         stopRouteExecution(activeRoute);
//       } else {
//         this.log('info', `🛑 No active route for ${operationId}, marking as canceled in tracking.`);
//       }

//       // Update tracking regardless of active route presence
//       if (tracking) {
//         tracking.status = 'FAILED';
//         tracking.error = errorMsg;
//         tracking.statusMessage = errorMsg;
//         this.pendingOperations.set(operationId, tracking);
//       } else {
//         // If no tracking exists, create a minimal failed result
//         this.log('warn', `No tracking found for ${operationId} during cancellation.`);
//         return {
//           operationId,
//           status: 'FAILED',
//           sourceTx: {},
//           error: errorMsg,
//           statusMessage: errorMsg,
//           adapterName: 'lifi'
//         };
//       }

//       return this.trackingToResult(operationId, tracking); // Return updated status from tracking

//     } catch (error: any) {
//       this.log('error', `Failed to cancel operation ${operationId}: ${error.message}`);
//       // Update tracking if possible
//       if (tracking) {
//         tracking.status = 'FAILED';
//         tracking.error = `Cancellation failed: ${error.message}`;
//         tracking.statusMessage = tracking.error;
//         this.pendingOperations.set(operationId, tracking);
//         return this.trackingToResult(operationId, tracking);
//       }
//       // Otherwise, create generic error
//       return this.createErrorResult(error); // Intent might not be available
//     }
//   }

//   /**
//   * Gets the status of a previously executed operation - UPDATED RETURN TYPE & LOGIC
//   * @param operationId Operation ID to check
//   * @returns Operation result with updated status
//   */
//   async getOperationStatus(operationId: string): Promise<OperationResult> { // <<< Return new OperationResult
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       const tracking = this.pendingOperations.get(operationId);
//       const activeRoute = getActiveRoute(operationId); // <<< Remove type assertion

//       // <<< ADD: Prioritize internal FAILED status from tracking if due to cancellation/timeout >>>
//       if (tracking && tracking.status === 'FAILED' && (tracking.error?.includes('canceled') || tracking.error?.includes('timed out'))) {
//         this.log('debug', `Returning prioritized FAILED status from tracking for ${operationId}`);
//         return this.trackingToResult(operationId, tracking);
//       }

//       // If route is active, it's the most up-to-date source (unless overridden above)
//       if (activeRoute) {
//         const routeStatus = this.translateRouteToStatus(activeRoute); // <<< Use updated translateRouteToStatus
//         return routeStatus;
//       }

//       // If no active route, return status from tracking if available
//       if (tracking) {
//         this.log('debug', `Returning status from tracking for ${operationId} (no active route)`);
//         return this.trackingToResult(operationId, tracking); // <<< Use updated trackingToResult
//       }

//       // If no route and no tracking, we don't know about this operation
//       this.log('warn', `No active route or tracking found for operation ID: ${operationId}`);
//       return {
//         operationId,
//         status: 'UNKNOWN', // <<< Use UNKNOWN status
//         sourceTx: {}, // <<< Empty sourceTx
//         statusMessage: 'Operation not found or tracking lost.', // <<< Add statusMessage
//         adapterName: 'lifi' // <<< Add adapterName
//       };
//     } catch (error: any) {
//       this.log('error', `Error getting operation status for ${operationId}: ${error.message}`);
//       // Attempt to return FAILED from tracking if possible
//       const tracking = this.pendingOperations.get(operationId);
//       if (tracking) {
//         this.log('debug', `Returning status from tracking for ${operationId} (no active route)`);
//         return this.trackingToResult(operationId, tracking); // <<< Use updated trackingToResult
//       }

//       // Otherwise, create generic error
//       return {
//         operationId,
//         status: 'UNKNOWN',
//         sourceTx: {},
//         statusMessage: 'Operation not found or tracking lost.',
//         adapterName: 'lifi'
//       };
//     }
//   }

//   /**
//   * Executes a cross-chain operation based on a previously obtained quote. - UPDATED RETURN TYPE
//   * @param quote The OperationQuote containing the intent and LI.FI step data.
//   * @returns A promise resolving to the initial OperationResult (usually PENDING).
//   */
//   async executeOperation(quote: OperationQuote): Promise<OperationResult> { // <<< Return new OperationResult
//     this.validatePrerequisites();
//     const intent = quote.intent;
//     const step = quote.adapterQuote as LiFiStep | undefined;

//     if (!step || typeof step !== 'object' || !step.id || !step.action || !step.estimate) {
//       this.log('error', "Invalid or incompatible LI.FI step data in adapterQuote.", { adapterQuote: quote.adapterQuote });
//       return this.createErrorResult(new Error("Invalid or incompatible LI.FI step data in adapterQuote."), intent);
//     }

//     try {
//       this.log('info', `Preparing route from quote step ${step.id}...`);
//       const route = await convertQuoteToRoute(step);
//       this.log('info', `Executing route ${route.id}...`);

//       // Create tracking for this operation BEFORE starting execution - UPDATED
//       const operationTracking: OperationTracking = {
//         status: 'PENDING',
//         startTime: Date.now(),
//         intent: intent, // <<< Store intent
//         lifiRoute: route, // <<< Store initial route
//         sourceTx: { chainId: intent.sourceAsset.chainId }, // <<< Init sourceTx
//         destinationTx: { chainId: intent.destinationAsset.chainId }, // <<< Init destinationTx
//         statusMessage: 'Execution initiated' // <<< Init statusMessage
//       };
//       this.pendingOperations.set(route.id, operationTracking);

//       executeRoute(route, {
//         updateRouteHook: this.createRouteUpdateHook(route.id),
//         executeInBackground: !this.confirmationHandler
//       });

//       // Return initial result using the new structure
//       this.log("info", `✅ Operation initiated: ${route.id}`);

//       return {
//         operationId: route.id,
//         status: 'PENDING',
//         sourceTx: { // <<< Use sourceTx structure
//           chainId: intent.sourceAsset.chainId,
//         },
//         destinationTx: { // <<< Use destinationTx structure
//           chainId: intent.destinationAsset.chainId,
//         },
//         statusMessage: 'Execution initiated', // <<< Add statusMessage
//         adapterName: 'lifi' // <<< Add adapterName
//       };
//     } catch (error: any) {
//       return this.createErrorResult(error, intent);
//     }
//   }

//   /**
//    * Checks for timed-out operations and cancels them
//    * This should be called periodically to clean up stale operations
//    */
//   async checkForTimedOutOperations(): Promise<void> {
//     if (!this.pendingOperationTimeout || !this.initialized) return;

//     const now = Date.now();
//     for (const [operationId, tracking] of this.pendingOperations.entries()) {
//       // Skip operations that are already completed or failed
//       if (tracking.status !== 'PENDING') continue;

//       // Check if the operation has timed out
//       const operationAge = now - tracking.startTime;
//       if (operationAge > this.pendingOperationTimeout) {
//         this.log('warn', `🕒 Operation ${operationId} timed out after ${operationAge}ms`);

//         try {
//           // Use the cancelOperation method with 'timeout' reason
//           await this.cancelOperation(operationId, 'timeout');
//         } catch (error) {
//           // If cancellation fails, just mark it as failed
//           tracking.status = 'FAILED';
//           tracking.error = 'Operation timed out and could not be canceled';
//           this.pendingOperations.set(operationId, tracking);
//         }
//       }
//     }
//   }

//   /**
//    * Gets supported tokens for a specific chain
//    * @param chainId Chain ID to get tokens for
//    * @returns Array of supported tokens
//    */
//   async getSupportedTokens(chainId: string): Promise<ChainAsset[]> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Use cached results if available
//       if (this.cachedTokens.has(chainId)) {
//         return this.cachedTokens.get(chainId)!;
//       }

//       // Fetch tokens from API
//       const response = await getTokens({ chains: [chainId as unknown as ChainId] });
//       const tokens = response.tokens[Number(chainId)] || [];

//       // Convert to ChainAsset format
//       const assets: ChainAsset[] = tokens.map(token => ({
//         chainId: token.chainId,
//         address: token.address,
//         symbol: token.symbol,
//         decimals: token.decimals,
//         name: token.name
//       }));

//       // Cache the results
//       this.cachedTokens.set(chainId, assets);

//       return assets;
//     } catch (error) {
//       this.log('error', `Error fetching tokens for chain ${chainId}:`, error);
//       throw new Error(`Failed to get tokens for chain ${chainId}: ${error}`);
//     }
//   }

//   /**
//    * Gets the list of supported chains
//    * @returns Array of supported chains with chainId and name
//    */
//   async getSupportedChains(): Promise<{ chainId: number, name: string }[]> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Use cached results if available
//       if (this.cachedChains) {
//         return this.cachedChains;
//       }

//       // If chains are already loaded during initialization, transform them
//       if (this.chains && this.chains.length > 0) {
//         this.cachedChains = this.chains.map(chain => ({
//           chainId: chain.id,
//           name: chain.name
//         }));
//         return this.cachedChains;
//       }

//       // Otherwise fetch from API
//       const chains = await getChains({ chainTypes: [ChainType.EVM] });
//       this.chains = chains;

//       // Transform to the expected format
//       this.cachedChains = chains.map(chain => ({
//         chainId: chain.id,
//         name: chain.name
//       }));

//       return this.cachedChains;
//     } catch (error) {
//       this.log('error', "Error fetching supported chains:", error);
//       throw new Error(`Failed to get supported chains: ${error}`);
//     }
//   }

//   /**
//     * Gets gas estimation for the destination chain - UPDATED PARAMETER
//     * @param intent Operation intent
//     * @returns Gas estimate with amount and USD value
//     */
//   async getGasOnDestination(intent: OperationIntent): Promise<{ amount: string, usdValue: string }> { // <<< Use OperationIntent
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Get gas recommendation for destination chain using intent
//       const gasRecommendation = await getGasRecommendation({
//         chainId: Number(intent.destinationAsset.chainId), // <<< Use intent
//         fromChain: Number(intent.sourceAsset.chainId), // <<< Use intent
//         fromToken: intent.sourceAsset.address || '0x0000000000000000000000000000000000000000' // <<< Use intent
//       });

//       // Return standardized format
//       return {
//         amount: gasRecommendation.recommended?.amount || '0',
//         usdValue: gasRecommendation.recommended?.amountUsd || '0'
//       };
//     } catch (error: any) { // <<< Use any for error type
//       this.log('error', "Error getting gas on destination:", error);
//       // Return empty values on error to prevent breaking
//       return {
//         amount: '0',
//         usdValue: '0'
//       };
//     }
//   }

//   /**
//    * Set an execution provider for transaction operations
//    * This can be called after initialization to add transaction capabilities
//    */
//   async setExecutionProvider(provider: LiFiExecutionProvider): Promise<void> {
//     // --- Helper to get RPC URL ---
//     const getRpcUrl = (chainId: number): string | undefined => {
//       const chainInfo = this.chains.find(c => c.id === chainId);
//       // Prioritize known RPCs if available, otherwise use the first explorer RPC (less ideal)
//       return chainInfo?.metamask?.rpcUrls?.[0] || chainInfo?.rpcUrls?.[0] || chainInfo?.blockExplorers?.[0]?.apiUrl;
//     };

//     if (!this.initialized) {
//       throw new Error("LiFiAdapter must be initialized before setting execution provider");
//     }

//     this.executionProvider = provider;
//     this.log('info', `Setting up execution provider with address: ${provider.address}`);

//     // --- Store the current Viem client ---
//     let currentViemWalletClient = provider.walletClient as any; // Initial client

//     createConfig({
//       integrator: 'm3s',
//       apiKey: this.apiKey,
//       providers: [
//         EVM({
//           // <<< Provide the *current* Viem client >>>
//           getWalletClient: async () => currentViemWalletClient,
//           // <<< Redefine switchChain >>>
//           switchChain: async (chainId: number): Promise<any> => {
//             this.log('info', `Attempting to switch chain via m3s/wallet to ${chainId}`);
//             if (!this.m3sWalletInstance) {
//               throw new Error("m3s/wallet instance not available for switching chain.");
//             }
//             try {
//               const rpcUrl = getRpcUrl(chainId);
//               if (!rpcUrl) {
//                 throw new Error(`No RPC URL found for chain ${chainId}`);
//               }

//               // --- 1. Switch chain using m3s/wallet ---
//               const chainInfo = this.chains.find(c => c.id === chainId);
//               const providerConfig = {
//                 chainConfig: {
//                   chainId: `0x${chainId.toString(16)}`,
//                   rpcTarget: rpcUrl,
//                   chainNamespace: 'eip155',
//                   displayName: chainInfo?.name || `Chain ${chainId}`,
//                   blockExplorer: chainInfo?.blockExplorers?.[0]?.url || '',
//                   ticker: chainInfo?.nativeCurrency?.symbol || 'ETH',
//                   tickerName: chainInfo?.nativeCurrency?.name || 'Ether',
//                 }
//               };
//               // Use the stored m3s/wallet instance to switch
//               await this.m3sWalletInstance.setProvider(providerConfig);
//               this.log('info', `Successfully switched chain via m3s/wallet to ${chainId}`);

//               // --- 2. Create a *new* Viem WalletClient for the new chain ---
//               const viemChain = findViemChain(chainId); // Map ID to Viem chain object
//               if (!viemChain) {
//                 throw new Error(`Viem chain configuration not found for chainId: ${chainId}`);
//               }
//               // Ensure we have the account details (might need to get from m3sWalletInstance or provider)
//               const account = (currentViemWalletClient as any).account; // Get account from old client
//               if (!account) {
//                 throw new Error("Cannot get account details to create new Viem client.");
//               }

//               currentViemWalletClient = createWalletClient({ // Update the stored client
//                 account,
//                 chain: viemChain,
//                 transport: http(rpcUrl)
//               });
//               this.log('info', `Created new Viem client for chain ${chainId}`);

//               // --- 3. Return the *new* Viem client ---
//               // LiFi SDK's getWalletClient will now get this updated client
//               return currentViemWalletClient;

//             } catch (error: any) {
//               this.log('error', `Failed to switch chain to ${chainId}: ${error.message}`);
//               throw error;
//             }
//           }
//         })
//       ]
//     });

//     this.log('info', "Successfully registered execution provider with LI.FI SDK");
//   }

//   /**
//    * Checks if the adapter has an execution provider set
//    */
//   hasExecutionProvider(): boolean {
//     return !!this.executionProvider;
//   }


// }