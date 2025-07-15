import { ethers } from "ethers";
import { NonceType, WalletEvent } from "../enums/index.js";
import { NetworkConfig } from "@m3s/shared";

export interface IConnectionHandler {
  // Connection state for wallets (unlike other adapters)
  disconnect(): void | Promise<void>;
  isConnected(): boolean;

}

export interface IAccountManager {
  // Account management
  getBalance(account?: string): Promise<AssetBalance>;
  getAccounts(): Promise<string[]>;
}

export interface INetworkManager {
  getNetwork(): Promise<NetworkConfig>;
  setProvider(providerConfig: NetworkConfig): Promise<void>;
}

/**
 * Event emitter capabilities
 */
export interface IEventEmitter {
  on(event: WalletEvent | string, listener: (...args: any[]) => void): void;
  off(event: WalletEvent | string, listener: (...args: any[]) => void): void;
}

/**
 * Message signing capabilities
 */
export interface IMessageSigner {
  signMessage(message: string | Uint8Array): Promise<string>;
  verifySignature(
    message: string | Uint8Array | EIP712TypedData,
    signature: string,
    address: string
  ): Promise<boolean>;
}

/**
 * Transaction signing and sending capabilities
 */
export interface GenericTransactionData {
  to?: string;
  /** Amount of the native asset to send (e.g., "0.01" for ETH, "1000000" for lamports). Adapter handles conversion. */
  value?: string;
  /** Transaction data or payload. */
  data?: string | Uint8Array;
  /** Adapter-specific options (e.g., gas settings, compute units, nonce). */
  options?: TransactionOptions;
}

export interface ITransactionHandler {
  getNonce(type: NonceType): Promise<number>
  signTransaction(tx: GenericTransactionData): Promise<string>;
  sendTransaction(tx: GenericTransactionData): Promise<string>;
}

/**
 * EIP-712 typed data signing capabilities
 */
export interface ITypedDataSigner {
  signTypedData(data: EIP712TypedData): Promise<string>;
}

/**
 * Gas estimation and management for EVM chains
 */
export interface IGasEstimation {
  getGasPrice(): Promise<bigint>;
  estimateGas(tx: GenericTransactionData): Promise<EstimatedFeeData>;
}

/**
 * Token operations for EVM chains
 */
export interface ITokenOperations {
  callContract(
    options: {
      contractAddress: string,
      abi: any,
      method: string,
      args?: any[]
    }
  ): Promise<any>;
  writeContract(
    options: {
      contractAddress: string,
      abi: any,
      method: string,
      args?: any[],
      value?: string | bigint,// Optional: send ETH with call
      overrides?: Partial<GenericTransactionData['options']>
    }
  ): Promise<any>
}

/**
 * Transaction receipt and status checking
 */
export interface ITransactionStatus {
  getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null>;
}

export interface IRPCHandler {
  /**
   * Get ALL configured RPC URLs for ALL chains
   */
  getAllChainRpcs(): Record<string, string[]>;

  /**
   * Update ALL RPC configurations at once
   */
  updateAllChainRpcs(multiChainRpcs: Record<string, string[]>): Promise<void>;
}

/**
 * Method Argument & Return types.
 */
export interface EIP712TypedData {
  /**
   * The EIP-712 domain separator components.
   */
  domain: {
    name?: string;
    version?: string;
    chainId?: string | number | bigint;
    verifyingContract?: string;
    salt?: string | Uint8Array;
  };
  /**
   * The type definitions for the structured data.
   * Maps type names to arrays of fields (name and type).
   */
  types: Record<string, Array<{ name: string; type: string }>>;
  /**
   * The primary data object (value) to be signed.
   * Its structure must correspond to the definitions in `types`.
   */
  value: Record<string, any>;
}

export interface AssetBalance {
  /** The raw balance amount in the smallest unit (e.g., wei, lamports). */
  amount: string;
  /** The number of decimals for the asset. */
  decimals: number;
  /** The symbol of the native asset (e.g., "ETH", "SOL"). */
  symbol: string;
  /** Optional: A human-readable formatted version of the balance. */
  formattedAmount?: string;
}

export interface EstimatedFeeData {
  gasLimit: bigint | string;
  gasPrice?: string; // For legacy transactions
  maxFeePerGas?: string; // For EIP-1559 transactions
  maxPriorityFeePerGas?: string; // For EIP-1559 transactions
}

export interface TransactionOptions {
  chainId?: number | string;
  gasLimit?: string | bigint; // Can be string or bigint, will be handled by adapter
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  // Adapters might support other custom options here
  [key: string]: any; // Allow other adapter-specific options
}