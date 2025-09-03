import { IEVMWallet } from "@m3s/wallet";
import { ExecutionStatusEnum } from "../enums/index.js";

/**
 * Represents an asset on a blockchain
 */
export interface ChainAsset {
  chainId: string | number; 
  address?: string
  symbol: string;
  decimals: number;
  name?: string;
}

/**
 * Defines the user's intent for a cross-chain operation.
 */
export interface OperationIntent {
  sourceAsset: ChainAsset;
  destinationAsset: ChainAsset;
  amount: string; 
  userAddress: string;
  recipientAddress?: string;
  slippageBps?: number;
  referrer?: string;
  adapterOptions?: Record<string, any>;
}

/**
 * Response containing price quote for an operation
 */
export interface OperationQuote {
  id: string;
  intent: OperationIntent;
  expiresAt?: number;
  feeUSD: string;
  gasCosts?: {
    limit: string;
    amount: string;
    amountUSD: string;
  };
  adapter: {
    name: string,
    version: string
  }
  adapterQuote: any;
  warnings?: string[];
}

/**
 * Represents the status and result of an executed or ongoing operation.
 */
export interface OperationResult {
  operationId: string;
  status: ExecutionStatusEnum,
  sourceTx: {
    hash?: string;
    chainId?: string | number;
    explorerUrl?: string;
  };
  destinationTx?: {
    hash?: string;
    chainId?: string | number;
    explorerUrl?: string;
  };
  receivedAmount?: string;
  error?: string;
  statusMessage?: string;
  adapter: {
    name: string,
    version: string
  }
}

/**
 * Quote generation capabilities for cross-chain operations
 */
export interface IQuoteProvider {
  /**
   * Get operation quotes for a cross-chain intent
   */
  getOperationQuote(intent: OperationIntent): Promise<OperationQuote[]>;
}

/**
 * Operation execution capabilities for cross-chain transactions
 */
export interface IOperationHandler {
  /**
   * Execute a cross-chain operation
   */
  executeOperation(
    quote: OperationQuote,
    options: {
      wallet: IEVMWallet;
    },
  ): Promise<OperationResult>;
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
export interface IChainDiscovery {
  /**
   * Get supported blockchain networks
   */
  getSupportedChains(): Promise<{ chainId: number | string, name: string, symbol: string }[]>;

  /**
   * Get supported tokens for a specific chain
   */
  getSupportedTokens(chainId: number | string): Promise<ChainAsset[]>;
}

/**
 * Gas estimation capabilities for cross-chain operations
 */
export interface IGasEstimator {
  /**
   * Estimate gas costs on the destination chain
   */
  getGasOnDestination(intent: OperationIntent): Promise<{ amount: string, usdValue: string }>;
}

/**
 * Maintenance and cleanup capabilities (optional for some adapters)
 */
export interface IOperationMaintenance {
  /**
   * Check for and handle timed-out operations
   */
  checkForTimedOutOperations(): Promise<void>;
}
