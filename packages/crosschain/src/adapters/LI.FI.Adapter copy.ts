// import { ICrossChain, OperationParams, OperationQuote, OperationResult, ChainAsset, TransactionConfirmationHandler } from '../types/interfaces/index.js';
// import {
//   getChains,
//   getQuote,
//   getTokens,
//   convertQuoteToRoute,
//   executeRoute,
//   createConfig,
//   QuoteRequest,
//   ExecutionOptions,
//   ExtendedTransactionInfo,
//   EVM,
//   ChainType,
//   ChainId,
//   getStatus,
//   GetStatusRequest,
//   getGasRecommendation,
//   getActiveRoute,
//   RouteExtended,
//   resumeRoute,
//   stopRouteExecution,
// } from '@lifi/sdk';


// /**
//  * Interface for LI.FI execution provider
//  * Abstraction over any wallet implementation that can execute transactions
//  */
// export interface LiFiExecutionProvider {
//   address: string;
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

// /**
//  * Adapter for LI.FI cross-chain operations
//  * Implements the ICrossChain interface using LI.FI's API
//  */
// export class LiFiAdapter implements Partial<ICrossChain> {
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
//   private pendingOperations: Map<string, {
//     status: 'PENDING' | 'COMPLETED' | 'FAILED',
//     startTime: number,
//     error?: string, // Only for our own error states like timeouts
//     customData?: any // Any application-specific data
//   }> = new Map();

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
//  * Checks for timed-out operations and cancels them
//  * This should be called periodically to clean up stale operations
//  */
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
//           // Use the updated cancelOperation method with 'timeout' reason
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
//  * Cancels an in-progress operation
//  * @param operationId ID of the operation to cancel
//  * @returns Status of the canceled operation
//  */
//   async cancelOperation(operationId: string, reason?: string): Promise<OperationResult> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Get the active route from the SDK
//       const activeRoute = <RouteExtended>getActiveRoute(operationId);
//       if (!activeRoute) {
//         // If no active route, check if we're tracking it
//         const pendingOp = this.pendingOperations.get(operationId);
//         if (pendingOp) {
//           // Mark as canceled in our internal tracking with the appropriate message
//           pendingOp.status = 'FAILED';
//           pendingOp.error = reason === 'timeout'
//             ? 'Operation timed out and was canceled'
//             : 'Operation canceled by user';
//           this.pendingOperations.set(operationId, pendingOp);

//           this.log('info', `🛑 Marked operation as canceled: ${operationId} (${pendingOp.error})`);
//           return this.getOperationStatus(operationId);
//         }
//         throw new Error(`No active route found for operation ID: ${operationId}`);
//       }

//       // Stop the route execution
//       this.log('info', `🛑 Cancelling operation: ${operationId}`);
//       stopRouteExecution(activeRoute);

//       // Update our tracking with the appropriate error message
//       const tracking = this.pendingOperations.get(operationId);
//       if (tracking) {
//         tracking.status = 'FAILED';
//         tracking.error = reason === 'timeout'
//           ? 'Operation timed out and was canceled'
//           : 'Operation canceled by user';
//         this.pendingOperations.set(operationId, tracking);
//       }

//       // Return the current status
//       return this.getOperationStatus(operationId);
//     } catch (error: any) {
//       this.log('error', `Failed to cancel operation ${operationId}: ${error.message}`);
//       throw new Error(`Failed to cancel operation: ${error.message}`);
//     }
//   }

//   /**
//    * Set an execution provider for transaction operations
//    * This can be called after initialization to add transaction capabilities
//    */
//   async setExecutionProvider(provider: LiFiExecutionProvider): Promise<void> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter must be initialized before setting execution provider");
//     }

//     this.executionProvider = provider;
//     this.log('info', `Setting up execution provider with address: ${provider.address}`);

//     // Re-initialize SDK WITH the execution provider - much simpler now!
//     createConfig({
//       integrator: 'm3s',
//       apiKey: this.apiKey,
//       providers: [
//         EVM({
//           // Just pass the wallet client directly
//           getWalletClient: async () => provider.walletClient,
//           // And use the provider's switchChain implementation
//           switchChain: provider.switchChain
//         })
//       ]
//     });

//     this.log('info', "Successfully registered execution provider with LI.FI SDK");
//   }

//   /**
//    * Checks if the adapter has been initialized
//    */
//   isInitialized(): boolean {
//     return this.initialized;
//   }

//   /**
//    * Checks if the adapter has an execution provider set
//    */
//   hasExecutionProvider(): boolean {
//     return !!this.executionProvider;
//   }

//   /**
//   * Gets the list of supported chains
//   * @returns Array of supported chains with chainId and name
//   */
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
//       console.error("Error fetching supported chains:", error);
//       throw new Error(`Failed to get supported chains: ${error}`);
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
//       console.error(`Error fetching tokens for chain ${chainId}:`, error);
//       throw new Error(`Failed to get tokens for chain ${chainId}: ${error}`);
//     }
//   }

//   /**
//    * Gets a quote for a cross-chain operation
//    * @param params Operation parameters
//    * @returns Operation quote with pricing and route information
//    */
//   async getOperationQuote(params: OperationParams): Promise<OperationQuote> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Convert our params to LI.FI format
//       const quoteRequest: QuoteRequest = {
//         fromChain: Number(params.sourceAsset.chainId),
//         fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000',
//         fromAddress: params.fromAddress,
//         fromAmount: params.amount,
//         toChain: Number(params.destinationAsset.chainId),
//         toToken: params.destinationAsset.address || '0x0000000000000000000000000000000000000000',
//         toAddress: params.toAddress || params.fromAddress,
//         slippage: params.slippage ? params.slippage / 100 : 0.01, // Convert percentage to decimal
//         integrator: 'm3s',
//         referrer: params.referrer
//       };

//       // Get quote from LI.FI
//       const quote = await getQuote(quoteRequest);

//       // Transform to our standard format
//       return {
//         id: quote.id,
//         estimate: {
//           fromAmount: quote.action.fromAmount,
//           toAmount: quote.estimate.toAmount,
//           route: quote.toolDetails.name,
//           executionTime: quote.estimate.executionDuration,
//           fee: quote.estimate.feeCosts?.reduce((total: string, fee: any) => {
//             const feeAmountUsd = fee.amountUsd || '0';
//             return (BigInt(total) + BigInt(feeAmountUsd)).toString();
//           }, '0')
//         },
//         validUntil: Math.floor(Date.now() / 1000) + 60 * 3, // 3 minutes validity
//         serviceTime: quote.estimate.executionDuration
//       };
//     } catch (error) {
//       console.error("Error getting operation quote:", error);
//       throw new Error(`Failed to get operation quote: ${error}`);
//     }
//   }

//   /**
//  * Gets the active route for a given operation ID
//  * @param operationId Operation ID to check
//  * @returns Active route if found, otherwise undefined
//  */
//   async getActiveRoute(operationId: string): Promise<any> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     return getActiveRoute(operationId);
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
//   * Executes a cross-chain operation
//   * @param params Operation parameters
//   * @returns Operation result with transaction details
//   */
//   async executeOperation(params: OperationParams): Promise<OperationResult> {

//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     if (!this.executionProvider) {
//       throw new Error("Execution provider required for transaction execution");
//     }

//     try {
//       console.log("Getting operation quote...");
//       // Get a fresh quote
//       const quote: any = await this.getOperationQuote(params);
//       console.log("Execution ---->>> :", quote);

//       // Get fresh quote for execution
//       const quoteRequest: QuoteRequest = {
//         fromChain: Number(params.sourceAsset.chainId),
//         fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000',
//         fromAddress: params.fromAddress,
//         fromAmount: params.amount,
//         toChain: Number(params.destinationAsset.chainId),
//         toToken: params.destinationAsset.address || '0x0000000000000000000000000000000000000000',
//         toAddress: params.toAddress || params.fromAddress,
//         slippage: params.slippage ? params.slippage / 100 : 0.01,
//         integrator: 'm3s',
//         referrer: params.referrer
//       };

//       console.log("Getting fresh quote for execution:", quoteRequest);
//       const freshQuote = await getQuote(quoteRequest);
//       console.log("Converting quote to route...");

//       // Convert quote to route for execution
//       const route: any = convertQuoteToRoute(freshQuote);
//       console.log("Executing route...");

//       // Create the operation tracking object with full necessary data
//       const operationTracking = {
//         status: 'PENDING' as 'PENDING' | 'COMPLETED' | 'FAILED',
//         startTime: Date.now(),
//         params,
//         transactionHash: '',
//         destinationTransactionHash: '',
//         explorerUrl: '',
//         error: undefined
//       };

//       // Store in pendingOperations BEFORE starting execution
//       this.pendingOperations.set(route.id, operationTracking);

//       // Now execute the route with a tracking hook
//       executeRoute(route, {
//         updateRouteHook: (updatedRoute: any) => {
//           // Only log concise route updates
//           const routeSteps = updatedRoute.steps.map((s: any) => ({
//             tool: s.tool,
//             status: s.execution?.status,
//             txHash: s.execution?.process?.[0]?.txHash?.slice(0, 10) + '...' // Truncate hash
//           }));

//           this.log('debug', `Route update for ${route.id.slice(0, 8)}`, routeSteps);

//           // Check for ACTION_REQUIRED status
//           const actionStep = updatedRoute.steps.find((step: any) =>
//             step.execution?.status === 'ACTION_REQUIRED'
//           );

//           // Update our tracking with new information
//           const tracking = this.pendingOperations.get(route.id);

//           if (actionStep) {
//             const actionProcess = actionStep.execution?.process.find((p: any) =>
//               p.status === 'ACTION_REQUIRED' && p.txRequest
//             );

//             if (actionProcess?.txRequest) {
//               if (this.autoConfirmTransactions) {
//                 // Auto-confirm for testing environments
//                 this.log('info', `🤖 Auto-confirming transaction for ${route.id}`);
//                 this.resumeOperation(route.id).catch(err =>
//                   console.error(`Failed to auto-resume operation: ${err.message}`)
//                 );
//               }
//               else if (this.confirmationHandler) {
//                 // First, stop the execution to prevent any automatic processing
//                 this.log('info', `⏸️ Pausing execution for user approval for ${route.id}`);

//                 // Use the confirmation handler for user approval
//                 const txInfo = {
//                   from: actionProcess.txRequest.from,
//                   to: actionProcess.txRequest.to,
//                   value: actionProcess.txRequest.value?.toString() || '0',
//                   chainId: actionStep.action.fromChainId.toString(),
//                   data: actionProcess.txRequest.data
//                 };

//                 stopRouteExecution(route);

//                 // Create a promise that will be rejected after timeout
//                 let timeoutId: any;
//                 const confirmationPromise = this.confirmationHandler.onConfirmationRequired(route.id, txInfo);

//                 const timeoutPromise = this.confirmationTimeout ?
//                   new Promise((_, reject) => {
//                     timeoutId = setTimeout(() => {
//                       this.log('warn', `⏱️ Confirmation timed out for ${route.id} after ${this.confirmationTimeout}ms`);
                      
//                       // IMPORTANT: Mark as failed immediately when timeout occurs
//                       if (tracking) {
//                         tracking.status = 'FAILED';
//                         tracking.error = `Confirmation timed out after ${this.confirmationTimeout}ms`;
//                         this.pendingOperations.set(route.id, tracking);
//                       }
                      
//                       reject(new Error(`Confirmation timed out after ${this.confirmationTimeout}ms`));
//                     }, this.confirmationTimeout);
//                   }) : 
//                   new Promise(resolve => null);// No timeout

//                 Promise.race([confirmationPromise, timeoutPromise])
//                   .then(approved => {
//                     if (timeoutId) clearTimeout(timeoutId);

//                     if (approved) {
//                       this.log('info', `✅ User approved transaction for ${route.id}`);
//                       this.resumeOperation(route.id).catch(err =>
//                         this.log('error', `Failed to resume operation: ${err.message}`)
//                       );
//                     } else {
//                       this.log('info', `❌ User rejected transaction for ${route.id}`);

//                       // Mark the operation as FAILED in case of rejection
//                       if (tracking) {
//                         tracking.status = 'FAILED';
//                         tracking.error = 'Transaction rejected by user';
//                         this.pendingOperations.set(route.id, tracking);

//                         // Make doubly sure the execution is stopped
//                         try {
//                           stopRouteExecution(route);
//                         } catch (err: any) {
//                           this.log('error', `Error stopping route execution: ${err.message}`);
//                         }
//                       }
//                     }
//                   })
//                   .catch(err => {
//                     if (timeoutId) clearTimeout(timeoutId);

//                     this.log('error', `Error in confirmation handler: ${err.message}`);
//                     // Mark as failed if confirmation handler throws an error or times out
//                     if (tracking) {
//                       tracking.status = 'FAILED';
//                       tracking.error = err.message.includes('timed out') ?
//                         `Confirmation timed out` :
//                         `Confirmation handler error: ${err.message}`;
//                       this.pendingOperations.set(route.id, tracking);

//                       // Also stop execution
//                       try {
//                         stopRouteExecution(route);
//                       } catch (e: any) {
//                         this.log('error', `Error stopping route execution: ${e.message}`);
//                       }
//                     }
//                   });
//               }
//             }
//           }

//           if (tracking) {
//             // Check for transaction hash
//             if (updatedRoute.steps?.[0]?.execution?.process) {
//               const processes = updatedRoute.steps[0].execution.process;
//               for (const process of processes) {
//                 if (process.txHash && !tracking.transactionHash) {
//                   tracking.transactionHash = process.txHash;
//                   tracking.explorerUrl = process.txUrl || '';
//                   this.log('info', `📡 Transaction submitted: ${process.txHash}`);
//                   break;
//                 }
//               }
//             }

//             // Check for status updates
//             if (updatedRoute.status === 'DONE') {
//               tracking.status = 'COMPLETED';
//               this.log('info', `✅ Operation completed: ${route.id}`);
//             } else if (updatedRoute.status === 'FAILED') {
//               tracking.status = 'FAILED';
//               tracking.error = updatedRoute.error?.message;
//               this.log('error', `❌ Operation failed: ${route.id}`, tracking.error);
//             }

//             // Update in the map
//             this.pendingOperations.set(route.id, tracking);
//           }
//         },
//         executeInBackground: !this.confirmationHandler && !this.autoConfirmTransactions
//       });

//       // Return result immediately
//       return {
//         operationId: route.id,
//         status: 'PENDING',
//         transactionHash: '',
//         destinationTransactionHash: '',
//         fromChain: params.sourceAsset.chainId.toString(),
//         toChain: params.destinationAsset.chainId.toString(),
//         bridge: route.steps[0]?.tool || '',
//         explorerUrl: '',
//         error: undefined
//       };
//     } catch (error: any) {
//       console.error("Error executing operation:", error);
//       return {
//         operationId: Math.random().toString(36).substring(2, 15),
//         status: 'FAILED',
//         transactionHash: '',
//         destinationTransactionHash: '',
//         fromChain: params.sourceAsset.chainId.toString(),
//         toChain: params.destinationAsset.chainId.toString(),
//         bridge: '',
//         explorerUrl: '',
//         error: error.message || "Unknown error during execution"
//       };
//     }
//   }

//   /**
//    * Resumes a previously halted or paused operation
//    * @param operationId ID of the operation to resume
//    * @returns Updated operation result
//    */
//   async resumeOperation(operationId: string): Promise<OperationResult> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     if (!this.executionProvider) {
//       throw new Error("Execution provider required for resuming operation");
//     }

//     try {
//       // Get the active route from the SDK
//       const activeRoute = <RouteExtended>getActiveRoute(operationId);
//       if (!activeRoute) {
//         throw new Error(`No active route found for operation ID: ${operationId}`);
//       }

//       // Resume the route execution
//       console.log(`Resuming operation: ${operationId}`);

//       // Use the resumeRoute function to continue execution
//       resumeRoute(activeRoute, {
//         updateRouteHook: (updatedRoute: any) => {
//           console.log(`Route update for resumed operation ${operationId}:`, {
//             steps: updatedRoute.steps.map((s: any) => ({
//               tool: s.tool,
//               execution: s.execution?.status,
//               txHash: s.execution?.process?.[0]?.txHash
//             }))
//           });

//           // Update our tracking with new information
//           const tracking = this.pendingOperations.get(operationId);
//           if (tracking) {
//             // Check for transaction hash
//             if (updatedRoute.steps?.[0]?.execution?.process) {
//               const processes = updatedRoute.steps[0].execution.process;
//               for (const process of processes) {
//                 if (process.txHash) {
//                   tracking.transactionHash = process.txHash;
//                   tracking.explorerUrl = process.txUrl || '';
//                   break;
//                 }
//               }
//             }

//             // Check for destination transaction hash
//             if (updatedRoute.steps.length > 1 && updatedRoute.steps[1]?.execution?.process) {
//               const processes = updatedRoute.steps[1].execution.process;
//               for (const process of processes) {
//                 if (process.txHash) {
//                   tracking.destinationTransactionHash = process.txHash;
//                   break;
//                 }
//               }
//             }

//             // Check for status updates
//             if (updatedRoute.status === 'DONE') {
//               tracking.status = 'COMPLETED';
//             } else if (updatedRoute.status === 'FAILED') {
//               tracking.status = 'FAILED';
//               tracking.error = updatedRoute.error?.message;
//             }

//             // Update in the map
//             this.pendingOperations.set(operationId, tracking);
//           }
//         },
//         // By default, resume in foreground to allow user interaction
//         executeInBackground: false
//       });

//       // Return immediately with the current status
//       return this.getOperationStatus(operationId);
//     } catch (error: any) {
//       console.error(`Error resuming operation ${operationId}:`, error);
//       throw new Error(`Failed to resume operation: ${error.message}`);
//     }
//   }

//   /**
//    * Gets the status of a previously executed operation
//    * @param operationId Operation ID to check
//    * @returns Operation result with updated status
//    */
//   async getOperationStatus(operationId: string): Promise<OperationResult> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       const pendingOp = this.pendingOperations.get(operationId);
//       if (pendingOp) {
//         console.log(`Found pending operation in tracker: ${operationId}`);

//         // Return data from our tracker
//         return {
//           operationId,
//           status: pendingOp.status,
//           transactionHash: pendingOp.transactionHash,
//           destinationTransactionHash: pendingOp.destinationTransactionHash,
//           fromChain: pendingOp.params.sourceAsset.chainId.toString(),
//           toChain: pendingOp.params.destinationAsset.chainId.toString(),
//           bridge: '', // Will be updated when we have more info
//           explorerUrl: pendingOp.explorerUrl,
//           error: pendingOp.error
//         };
//       }

//       // This is recommended by the SDK documentation for monitoring routes
//       const activeRoute = <RouteExtended>getActiveRoute(operationId);

//       if (activeRoute) {
//         console.log(`Found active route for operation ${operationId}`);

//         // Extract status information from the active route
//         let status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING';
//         let txHash = '';
//         let destinationTxHash = '';
//         let explorerUrl = '';
//         let bridgeName = activeRoute.steps[0]?.tool || '';
//         let fromChain = activeRoute.fromChainId?.toString() || '';
//         let toChain = activeRoute.toChainId?.toString() || '';
//         let error: string | undefined;

//         // Determine status from steps instead of directly from route
//         if (activeRoute.steps?.length > 0) {
//           // Check if any step has failed
//           const hasFailedStep = activeRoute.steps.some(
//             step => step.execution?.status === 'FAILED'
//           );

//           // Check if all steps are done
//           const allStepsDone = activeRoute.steps.every(
//             step => step.execution?.status === 'DONE'
//           );

//           if (hasFailedStep) {
//             status = 'FAILED';
//             // Find the failed step to get error message
//             const failedStep = activeRoute.steps.find(
//               step => step.execution?.status === 'FAILED'
//             );
//             error = failedStep?.execution?.process[0]?.error?.message;
//           } else if (allStepsDone) {
//             status = 'COMPLETED';
//           }
//         }

//         // Extract transaction details from the first step's execution
//         if (activeRoute.steps[0]?.execution?.process) {
//           const processes = activeRoute.steps[0].execution.process;
//           for (const process of processes) {
//             if (process.txHash) {
//               txHash = process.txHash;
//               explorerUrl = process.txUrl || '';
//               break;
//             }
//           }
//         }

//         // Try to find destination transaction hash (cross-chain transfer)
//         if (activeRoute.steps.length > 1 && activeRoute.steps[1]?.execution?.process) {
//           const processes = activeRoute.steps[1].execution.process;
//           for (const process of processes) {
//             if (process.txHash) {
//               destinationTxHash = process.txHash;
//               break;
//             }
//           }
//         }

//         return {
//           operationId,
//           status,
//           transactionHash: txHash,
//           fromChain,
//           toChain,
//           bridge: bridgeName,
//           explorerUrl,
//           error
//         };
//       }

//       // If not an active route, check if we have a valid transaction hash
//       const [routeId, stepIndex] = operationId.split(':');
//       const isValidTxHash = routeId.startsWith('0x') && routeId.length === 66;

//       if (isValidTxHash) {
//         // Use getStatus API to check status of a specific transaction
//         const statusRequest: GetStatusRequest = {
//           txHash: routeId,
//           bridge: undefined,
//           fromChain: undefined,
//           toChain: undefined
//         };

//         const statusResponse: any = await getStatus(statusRequest);

//         // Process status response as in the current implementation
//         let status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING';
//         let error: string | undefined;
//         let txHash = '';
//         let destinationTxHash = '';
//         let explorerUrl = '';
//         let bridgeName = '';
//         let fromChain = '';
//         let toChain = '';

//         // Map LI.FI status to our status format
//         if (statusResponse.status === 'DONE') {
//           status = 'COMPLETED';
//         } else if (statusResponse.status === 'FAILED') {
//           status = 'FAILED';
//           error = statusResponse.error?.message;
//         }

//         // Extract transaction details
//         if (statusResponse.sending) {
//           txHash = statusResponse.sending.txHash;
//           explorerUrl = statusResponse.sending.txUrl;
//           fromChain = statusResponse.sending.chainId.toString();
//         }

//         if (statusResponse.receiving?.txHash) {
//           destinationTxHash = statusResponse.receiving.txHash;
//           toChain = statusResponse.receiving.chainId.toString();
//         }

//         // Get bridge name
//         bridgeName = statusResponse.tool || '';

//         return {
//           operationId,
//           status,
//           transactionHash: txHash,
//           fromChain,
//           toChain,
//           bridge: bridgeName,
//           explorerUrl,
//           error
//         };
//       }

//       // If not an active route or valid tx hash, return PENDING
//       console.log(`No active route or valid transaction hash for operation ${operationId}, returning PENDING status`);
//       return {
//         operationId,
//         status: 'PENDING',
//         transactionHash: '',
//         destinationTransactionHash: '',
//         fromChain: '',
//         toChain: '',
//         bridge: '',
//         explorerUrl: '',
//         error: undefined
//       };
//     } catch (error: any) {
//       if (error.toString().includes('Not a valid txHash')) {
//         console.log(`Operation ID ${operationId} is not a valid transaction hash, returning PENDING status`);
//         return {
//           operationId,
//           status: 'PENDING',
//           transactionHash: '',
//           destinationTransactionHash: '',
//           fromChain: '',
//           toChain: '',
//           bridge: '',
//           explorerUrl: '',
//           error: undefined
//         };
//       }

//       console.error(`Error getting operation status for ${operationId}:`, error);
//       throw new Error(`Failed to get operation status: ${error}`);
//     }
//   }

//   /**
//    * Gets gas estimation for the destination chain
//    * @param params Operation parameters
//    * @returns Gas estimate with amount and USD value
//    */
//   async getGasOnDestination(params: OperationParams): Promise<{ amount: string, usdValue: string }> {
//     if (!this.initialized) {
//       throw new Error("LiFiAdapter not initialized");
//     }

//     try {
//       // Get gas recommendation for destination chain
//       const gasRecommendation = await getGasRecommendation({
//         chainId: Number(params.destinationAsset.chainId),
//         fromChain: Number(params.sourceAsset.chainId),
//         fromToken: params.sourceAsset.address || '0x0000000000000000000000000000000000000000'
//       });

//       // Return standardized format
//       return {
//         amount: gasRecommendation.recommended?.amount || '0',
//         usdValue: gasRecommendation.recommended?.amountUsd || '0'
//       };
//     } catch (error) {
//       console.error("Error getting gas on destination:", error);
//       // Return empty values on error to prevent breaking
//       return {
//         amount: '0',
//         usdValue: '0'
//       };
//     }
//   }
// }