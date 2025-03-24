import { Provider } from "ethers";
import { IEVMWallet } from "../types/interfaces/EVM/index.js";
import { TransactionData } from "../types/index.js";
interface args {
    provider?: Provider;
    options?: {
        privateKey?: string;
    };
}
export declare class EvmWalletAdapter implements IEVMWallet {
    private wallet;
    private provider?;
    private privateKey;
    initialized: boolean;
    private eventListeners;
    /** General Initialization */
    /**
     * Creates an instance of the EvmWalletAdapter.
     *
     * @param args - The arguments required to create the wallet adapter.
     * @param args.privateKey - The private key for the wallet. If not provided, a new wallet will be generated.
     * @param args.provider - The provider to be used with the wallet. Optional.
     *
     * @remarks
     * - If `privateKey` is not provided, a new wallet will be generated using `ethers.Wallet.createRandom()`.
     * - If `provider` is provided, it will be assigned to the instance.
     *
     * @example
     * ```typescript
     * const adapter = new EvmWalletAdapter({ privateKey: 'your-private-key', provider: yourProvider });
     * ```
     */
    private constructor();
    /**
     * Creates a new instance of EvmWalletAdapter.
     *
     * @param {args} args - The arguments required to create the EvmWalletAdapter instance.
     * @returns {Promise<EvmWalletAdapter>} A promise that resolves to the newly created EvmWalletAdapter instance.
     */
    static create(args: args): Promise<EvmWalletAdapter>;
    /**
     * Initializes the wallet instance if it has not been initialized yet.
     *
     * This method sets up the wallet using the provided private key and connects it to the provider if available.
     * It ensures that the wallet is only initialized once.
     *
     * @returns {Promise<void>} A promise that resolves when the initialization is complete.
     */
    initialize(): Promise<void>;
    /**
     * Checks if the wallet has been initialized.
     *
     * @returns {boolean} True if the wallet is initialized, otherwise false.
     */
    isInitialized(): boolean;
    /**
     * Disconnects the wallet by clearing the provider and wallet instance.
     * This method does not clean up event listeners or other resources.
     */
    disconnect(): void;
    /** Wallet Metadata */
    /**
     * Retrieves the name of the wallet adapter.
     *
     * @returns {string} The name of the wallet adapter.
     */
    getWalletName(): string;
    /**
     * Retrieves the version of the wallet.
     *
     * @returns {string} The version of the wallet as a string.
     */
    getWalletVersion(): string;
    /**
     * Checks if the wallet is connected to a provider.
     *
     * @returns {boolean} `true` if the wallet is connected to a provider, otherwise `false`.
     */
    isConnected(): boolean;
    /** Account Management */
    /**
     * Requests the list of accounts associated with the wallet.
     *
     * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
     *
     * @emits WalletEvent.accountsChanged - Emitted when accounts are requested.
     */
    requestAccounts(): Promise<string[]>;
    /**
     * Retrieves the private key associated with the wallet.
     *
     * @returns {Promise<string>} A promise that resolves to the private key as a string.
     */
    getPrivateKey(): Promise<string>;
    /**
     * Retrieves the list of accounts associated with the wallet.
     *
     * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
     */
    getAccounts(): Promise<string[]>;
    /**
     * Retrieves the balance of the specified account.
     *
     * @param {string} [account] - The account address to retrieve the balance for. Defaults to the wallet's address.
     * @returns {Promise<string>} A promise that resolves to the balance as a string.
     */
    getBalance(account?: string): Promise<string>;
    /**
     * Verifies the correctness of a signature for a given message.
     *
     * @param {string} message - The message to verify the signature against.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} A promise that resolves to `true` if the signature is valid, otherwise `false`.
     */
    verifySignature(message: string, signature: string): Promise<boolean>;
    /**
     * Emits an event with the specified name and payload
     * @param eventName The name of the event to emit
     * @param payload The payload to pass to the event listeners
     */
    private emitEvent;
    /**
     * Registers an event listener for the specified event.
     *
     * @param event - The name of the event to listen for.
     * @param callback - The callback function to be invoked when the event is emitted.
     *
     * @remarks
     * If the event is `WalletEvent.chainChanged` and the provider supports event listeners,
     * it will map the provider's `network` event to the `WalletEvent.chainChanged` event.
     *
     * @example
     * ```typescript
     * wallet.on('connect', (payload) => {
     *   console.log('Wallet connected:', payload);
     * });
     * ```
     */
    on(event: string, callback: (payload: unknown) => void): void;
    /**
     * Removes a specific callback function for a given event.
     *
     * @param event - The name of the event to remove the callback from.
     * @param callback - The callback function to be removed.
     */
    off(event: string, callback: (payload: unknown) => void): void;
    /** Network Management */
    /**
     * Retrieves the network information from the provider.
     *
     * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
     * @throws Will throw an error if the provider is not set.
     */
    getNetwork(): Promise<{
        chainId: string;
        name?: string;
    }>;
    /**
     * Sets the provider for the wallet and reconnects the wallet with the new provider if it is already connected.
     *
     * @param provider - The new provider to set for the wallet.
     */
    setProvider(provider: Provider): Promise<void>;
    /** Transactions & Signing */
    private processTransactionValue;
    /**
     * Sends a transaction using the initialized wallet.
     *
     * @param tx - The transaction object to be sent.
     * @returns A promise that resolves to the transaction hash as a string.
     * @throws Will throw an error if the wallet, provider, or initialization is not properly set up.
     */
    sendTransaction(tx: TransactionData): Promise<string>;
    /**
     * Signs a transaction using the wallet.
     *
     * @param tx - The transaction object to be signed.
     * @returns A promise that resolves to the signed transaction as a string.
     * @throws Will throw an error if the wallet is not initialized, the provider is not set, or the wallet is not available.
     */
    signTransaction(tx: any): Promise<string>;
    /**
     * Signs a given message using the wallet.
     *
     * @param message - The message to be signed.
     * @returns A promise that resolves to the signed message as a string.
     * @throws Will throw an error if the wallet is not initialized.
     */
    signMessage(message: string): Promise<string>;
    /** EVM-Specific Features */
    /**
     * Signs typed data using the wallet.
     *
     * @param data - The data to be signed, including the domain, types, and value.
     * @param version - (Optional) The version of the signing method to use.
     * @returns A promise that resolves to the signed data as a string.
     * @throws Will throw an error if the wallet is not initialized.
     */
    signTypedData(data: {
        domain: any;
        types: any;
        value: any;
    }, version?: string): Promise<string>;
    /**
     * Retrieves the current gas price from the provider.
     *
     * @returns {Promise<string>} A promise that resolves to the gas price as a string.
     * @throws {Error} If the gas price is not available.
     */
    getGasPrice(): Promise<string>;
    /**
     * Estimates the gas required for a given transaction.
     *
     * @param tx - The transaction data containing the recipient address, value, and optional data.
     * @returns A promise that resolves to the estimated gas as a string.
     */
    estimateGas(tx: TransactionData): Promise<string>;
    /**
     * Retrieves the transaction receipt for a given transaction hash.
     *
     * @param txHash - The hash of the transaction to retrieve the receipt for.
     * @returns A promise that resolves to the transaction receipt.
     */
    getTransactionReceipt(txHash: string): Promise<any>;
    /**
     * Retrieves the token balance for a given token address and account.
     *
     * @param tokenAddress - The address of the token contract.
     * @param account - The account address to retrieve the balance for. Defaults to the wallet's address.
     * @returns A promise that resolves to the token balance as a string.
     */
    getTokenBalance(tokenAddress: string, account?: string): Promise<string>;
}
export {};
