/**
 * Represents an asset on a blockchain
 */
export interface ChainAsset {
  chainId: string | number;  // Chain ID where the asset exists
  address?: string;         // Contract address (null for native tokens)
  symbol: string;           // Asset symbol
  decimals: number;         // Asset decimals
  name?: string;            // Asset name
}

/**
 * Parameters for a cross-chain operation
 */
export interface OperationParams {
  operationType: 'swap' | 'transfer' | 'bridge';
  sourceAsset: ChainAsset;
  destinationAsset: ChainAsset;
  amount: string;           // Amount in smallest unit (e.g., wei)
  fromAddress: string;      // Source wallet address
  toAddress?: string;       // Destination wallet address (if different from fromAddress)
  slippage?: number;        // Slippage tolerance in percentage (e.g., 0.5 for 0.5%)
  referrer?: string;        // Optional referral code
}

/**
 * Response containing price quote for an operation
 */
export interface OperationQuote {
  id: string;               // Quote ID
  estimate: {
    fromAmount: string;     // Input amount
    toAmount: string;       // Estimated output amount
    route: string | string[];        // Route of the operation
    executionTime: number;  // Estimated execution time in seconds
    fee: string | undefined;            // Fee amount in USD
  };
  validUntil: number;       // Timestamp until quote is valid
  serviceTime?: number;     // Service processing time in ms
}

/**
 * Result of an executed operation
 */
export interface OperationResult {
  operationId: string;      // Unique operation ID
  status: 'PENDING' | 'COMPLETED' | 'FAILED'; 
  transactionHash: string;  // Transaction hash on source chain
  destinationTransactionHash?: string; // Transaction hash on destination chain
  fromChain: string | number;
  toChain: string | number;
  bridge: string;          // Bridge used
  explorerUrl: string;     // URL to track the transaction
  error?: string;          // Error message if failed
}

/**
 * Interface for cross-chain operations
 */
export interface ICrossChain {
  // Core methods
  initialize(config: any): Promise<void>;
  isInitialized(): boolean;
  
  // Operation methods
  getOperationQuote(params: OperationParams): Promise<OperationQuote>;
  executeOperation(params: OperationParams): Promise<OperationResult>;
  getOperationStatus(operationId: string): Promise<OperationResult>;
  
  // Chain & token methods
  getSupportedChains(): Promise<{chainId: number|string, name: string}[]>;
  getSupportedTokens(chainId:  number|string): Promise<ChainAsset[]>;
  
  // Tools & utilities
  getGasOnDestination(params: OperationParams): Promise<{amount: string, usdValue: string}>;
}

export interface TransactionConfirmationHandler {
  onConfirmationRequired: (
    operationId: string, 
    txInfo: {
      from: string,
      to: string,
      value: string,
      chainId: string,
      data?: string
    }
  ) => Promise<boolean>; // Return true to approve, false to reject
}