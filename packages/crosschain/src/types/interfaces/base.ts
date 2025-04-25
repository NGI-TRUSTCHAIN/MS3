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

// /**
//  * Parameters for a cross-chain operation
//  */
// export interface OperationParams {
//   operationType: 'swap' | 'transfer' | 'bridge';
//   sourceAsset: ChainAsset;
//   destinationAsset: ChainAsset;
//   amount: string;           // Amount in smallest unit (e.g., wei)
//   fromAddress: string;      // Source wallet address
//   toAddress?: string;       // Destination wallet address (if different from fromAddress)
//   slippage?: number;        // Slippage tolerance in percentage (e.g., 0.5 for 0.5%)
//   referrer?: string;        // Optional referral code
// }

/**
 * Defines the user's intent for a cross-chain operation.
 */
export interface OperationIntent {
  sourceAsset: ChainAsset;
  destinationAsset: ChainAsset;
  amount: string;           // Amount in sourceAsset's smallest unit (e.g., wei)
  userAddress: string;      // The primary user address initiating the operation
  recipientAddress?: string; // Destination address (defaults to userAddress if not provided)
  /** Optional slippage tolerance in basis points (e.g., 50 for 0.5%) */
  slippageBps?: number;
  /** Optional referral code or identifier */
  referrer?: string;
  /** Optional adapter-specific parameters */
  adapterOptions?: Record<string, any>;
}

/**
 * Response containing price quote for an operation
 */
export interface OperationQuote {
  id: string;               // Unique identifier for this quote/route
  intent: OperationIntent;  // The original intent this quote satisfies
  estimate: {
    fromAmount: string;     // Input amount (sourceAsset units)
    toAmount: string;       // Estimated output amount (destinationAsset units)
    toAmountMin: string;    // Minimum guaranteed output amount after slippage
    /** High-level description or list of steps/protocols involved */
    routeDescription: string | string[];
    /** Estimated total time in seconds */
    executionDuration: number;
    /** Estimated fees in USD */
    feeUSD: string;
    /** Estimated gas costs on source chain (native token units) - Optional */
    gasCosts?: {
        limit: string;
        amount: string; // wei
        amountUSD: string;
    };
    // Add other relevant estimates? e.g., price impact
  };
  /** Timestamp (seconds) until the quote expires */
  expiresAt?: number;
  /** The adapter that generated this quote */
  adapterName: string;
  /** Raw quote data from the adapter, if needed for execution */
  adapterQuote: any; // Use specific type per adapter if possible, but 'any' for interface
  /** Warnings or important notices about this route */
  warnings?: string[];
}

/**
 * Represents the status and result of an executed or ongoing operation.
 */
export interface OperationResult {
  operationId: string;      // Unique ID for this specific execution attempt
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ACTION_REQUIRED' | 'UNKNOWN'; // <<< Added ACTION_REQUIRED, UNKNOWN
  sourceTx: { // <<< Structured source tx info
      hash?: string;
      chainId?: string | number;
      explorerUrl?: string;
  };
  destinationTx?: { // <<< Structured destination tx info (optional)
      hash?: string;
      chainId?: string | number;
      explorerUrl?: string;
  };
  /** The final amount received by the recipient (destinationAsset units) - available when COMPLETED */
  receivedAmount?: string; // <<< Added receivedAmount
  /** Error message if status is FAILED */
  error?: string;
  /** Additional details or context about the current status */
  statusMessage?: string; // <<< Added statusMessage
   /** The adapter that handled this operation */
  adapterName: string; // <<< Added adapterName
}

/**
 * Interface for cross-chain operations
 */
export interface ICrossChain {
  // Core methods
  initialize(config: any): Promise<void>; // <<< Will update later
  isInitialized(): boolean;

  // Operation methods - UPDATED
  getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]>; // <<< Return ARRAY of new OperationQuote
  executeOperation(quote: OperationQuote): Promise<OperationResult>; // <<< Accept ONE new OperationQuote
  getOperationStatus(operationId: string): Promise<OperationResult>;

  // Chain & token methods
  getSupportedChains(): Promise<{chainId: number|string, name: string}[]>;
  getSupportedTokens(chainId:  number|string): Promise<ChainAsset[]>;

  // Tools & utilities
  getGasOnDestination(intent: OperationIntent): Promise<{amount: string, usdValue: string}>;
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
  ) => Promise<boolean>;
}