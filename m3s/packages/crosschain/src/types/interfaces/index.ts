import { IEVMWallet } from "@m3s/wallet";
import { ExecutionStatusEnum } from "../enums/index.js";
import { IAdapterIdentity, IAdapterLifecycle } from "@m3s/common";

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
 * Defines the user's intent for a cross-chain operation.
 */
export interface OperationIntent {
  sourceAsset: ChainAsset;
  destinationAsset: ChainAsset;
  amount: string;            // Amount in human-readable units (e.g., '0.1' for 0.1 ETH, '100' for 100 USDC)
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
  adapter: {
    name: string,
    version: string
  }
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
  status: ExecutionStatusEnum,
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
  adapter: {
    name: string,
    version: string
  }
}


/**
 * Quote generation capabilities for cross-chain operations
 */
interface IQuoteProvider {
  /**
   * Get operation quotes for a cross-chain intent
   */
  getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]>;
}

/**
 * Operation execution capabilities for cross-chain transactions
 */
interface IOperationExecutor {
  /**
   * Execute a cross-chain operation
   */
  executeOperation(
    quote: OperationQuote,
    options: {
      wallet: IEVMWallet;
    },
  ): Promise<OperationResult>;

}

/**
 * Operation monitoring and status tracking capabilities
 */
interface IOperationMonitor {
  /**
   * Get the current status of an operation
   */
  getOperationStatus(operationId: string): Promise<OperationResult>;
  
  /**
   * Cancel an ongoing operation
   */
  cancelOperation(
    operationId: string,
    options: { wallet?: IEVMWallet; reason?: string }
  ): Promise<OperationResult>;
  
  /**
   * Resume a paused or failed operation
   */
  resumeOperation(
    operationId: string,
    options: { wallet?: IEVMWallet }
  ): Promise<OperationResult>;

  on(event: 'status', listener: (result: OperationResult) => void): this;
  off(event: 'status', listener: (result: OperationResult) => void): this;
}

/**
 * Chain and token discovery capabilities
 */
interface IChainDiscovery {
  /**
   * Get supported blockchain networks
   */
  getSupportedChains(): Promise<{chainId: number|string, name: string, symbol: string}[]>;
  
  /**
   * Get supported tokens for a specific chain
   */
  getSupportedTokens(chainId: number|string): Promise<ChainAsset[]>;
}

/**
 * Gas estimation capabilities for cross-chain operations
 */
interface IGasEstimator {
  /**
   * Estimate gas costs on the destination chain
   */
  getGasOnDestination(intent: OperationIntent): Promise<{amount: string, usdValue: string}>;
}

/**
 * Maintenance and cleanup capabilities (optional for some adapters)
 */
interface IOperationMaintenance {
  /**
   * Check for and handle timed-out operations
   */
  checkForTimedOutOperations(): Promise<void>;
}

/**
 * Complete cross-chain interface - composed of all cross-chain capabilities
 */
export interface ICrossChain extends 
  IAdapterIdentity,
  IAdapterLifecycle,
  IQuoteProvider,
  IOperationExecutor,
  IOperationMonitor,
  IChainDiscovery,
  IGasEstimator,
  IOperationMaintenance 
  {}