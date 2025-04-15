export type TransactionData = {
    from?: string;
    to: string;
    value?: string | bigint;
    data?: string;
    nonce?: number;
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
};

/**
 * Represents generic transaction data, adaptable to different chains.
 * Adapters are responsible for interpreting these fields and any 'options'.
 */
export interface GenericTransactionData {
    to?: string;
    /** Amount of the native asset to send (e.g., "0.01" for ETH, "1000000" for lamports). Adapter handles conversion. */
    value?: string;
    /** Transaction data or payload. */
    data?: string | Uint8Array;
    /** Adapter-specific options (e.g., gas settings, compute units, nonce). */
    options?: Record<string, any>;
}

/**
* Configuration for setting or switching the network provider.
*/
export interface ProviderConfig {
    /** The RPC endpoint URL for the network. */
    rpcUrl?: string;
    /** The unique identifier for the chain/network. */
    chainId?: string | number;
    /** Allow other properties for adapter-specific needs (e.g., API keys, custom node settings). */
    [key: string]: any;
}

/**
 * Represents the balance of a native asset.
 */
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