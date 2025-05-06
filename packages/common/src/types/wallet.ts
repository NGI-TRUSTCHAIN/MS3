// ---- ENUMS ---- //
export enum WalletEvent {
    connect = 'connect',
    disconnect = 'disconnect',
    accountsChanged = 'accountsChanged',
    chainChanged = 'chainChanged',
    balanceChanged = 'balanceChanged'
};
export enum SignTypedDataVersion {
    V1 = 'V1',
    V3 = 'V3',
    V4 = 'V4'
};
export enum WalletType {
    'core' = 'core',
    'evm' = 'evm',
    'web3auth' = 'web3auth'
}
// ---- ENUMS --- //


// ---- TYPES ---- //
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
// ---- TYPES ---- //

// ---- INTERFACES ---- //
export interface ICoreWallet {
    /** Initialize the adapter (e.g., setup SDKs, load configurations). */
    initialize(): Promise<void>;
    /** Check if the adapter has been successfully initialized. */
    isInitialized(): boolean;

    /** Disconnect the wallet (e.g., logout, clear session, disconnect provider). */
    disconnect(): void | Promise<void>;
    /** Check if the wallet is currently connected to a provider/network. */
    isConnected(): boolean;

    /** Get the name of the wallet adapter (e.g., 'ethers', 'web3auth'). */
    getWalletName(): string;
    /** Get the version of the wallet adapter or underlying SDK. */
    getWalletVersion(): string;

    /** Request account access if not already granted (might trigger connection/login UI). */
    requestAccounts(): Promise<string[]>;
    /** Get the primary account address(es) currently associated with the wallet. Returns empty array if unavailable. */
    getAccounts(): Promise<string[]>;

    /** Get the balance of the native asset for the specified account, or the primary connected account if unspecified. */
    getBalance(account?: string): Promise<AssetBalance>;

    /** Get the current network/chain information (ID and optionally name). */
    getNetwork(): Promise<{ chainId: string | number; name?: string }>;
    /** Set or update the network provider configuration. This may cause disconnection/reconnection. */
    setProvider(providerConfig: ProviderConfig): Promise<void>;

    /** Sign a message using the wallet's private key. */
    signMessage(message: string | Uint8Array): Promise<string>;
    /** Sign a transaction object without sending it to the network. */
    signTransaction(tx: GenericTransactionData): Promise<string>; // Added back
    /** Sign and send a transaction to the network. */
    sendTransaction(tx: GenericTransactionData): Promise<string>; // Returns transaction hash/id

    /** Subscribe to wallet events. */
    on(event: WalletEvent | string, listener: (...args: any[]) => void): void;
    /** Unsubscribe from wallet events. */
    off(event: WalletEvent | string, listener: (...args: any[]) => void): void;
}
export interface IChainConfig {
    chainConfig: {
        chainNamespace: string,
        chainId: string,
        rpcTarget: string,
        displayName: string,
        blockExplorer: string,
        ticker: string,
        tickerName: string
    },
}
export interface IWalletOptions {
    adapterName: string,
    neededFeature?: string,
    provider?: any,
    options?: IWeb3AuthOptions | IEVMOptions
}
export interface IEVMOptions {
    privateKey?: string,
}
export interface IWeb3AuthOptions {
    web3authConfig: {
        clientId: string,
        web3AuthNetwork: string,
        chainConfig: {
            chainNamespace: string,
            chainId: string,
            rpcTarget: string,
            displayName: string,
            blockExplorer: string,
            ticker: string,
            tickerName: string
        },
        loginConfig: {
            loginProvider: string
        }
    }
}
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
/**
 * Extends ICoreWallet with EVM-specific functionalities.
 */
export interface IEVMWallet extends ICoreWallet {
    /**
     * Signs typed data according to EIP-712.
     * @param data The structured typed data (domain, types, message).
     * @returns A promise that resolves to the signature string.
     */
    signTypedData(data: EIP712TypedData): Promise<string>;

    /**
     * Gets the current gas price from the network.
     * @returns A promise that resolves to the gas price as a bigint.
     */
    getGasPrice(): Promise<bigint>;

    /**
     * Estimates the gas required for a transaction.
     * Note: Uses original EVM TransactionData structure here for specificity.
     * Consider if GenericTransactionData with options is sufficient.
     * @param tx The transaction data.
     * @returns A promise that resolves to the estimated gas limit as a bigint.
     */
    estimateGas(tx: GenericTransactionData): Promise<bigint>; // Or use GenericTransactionData? Needs decision.

    /**
     * Gets the balance of a specific ERC-20 token for an account.
     * @param tokenAddress The address of the ERC-20 token contract.
     * @param account (Optional) The account address. Defaults to the connected account.
     * @returns A promise that resolves to the token balance as a string (in smallest unit).
     */
    getTokenBalance(tokenAddress: string, account?: string): Promise<string>;

    /**
     * Gets the receipt for a transaction hash.
     * @param txHash The hash of the transaction.
     * @returns A promise that resolves to the transaction receipt object, or null if not found/mined.
     */
    getTransactionReceipt(txHash: string): Promise<any | null>; // Type 'any' for now, can be refined with ethers specific type if desired
}
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
// ---- INTERFACES ---- //

