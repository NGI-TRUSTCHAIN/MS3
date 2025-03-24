import { Provider } from "ethers";
import { ICoreWallet } from "../types/index.js";
interface args {
    privateKey?: string;
    provider?: Provider;
}
/**
 * The `MockedWalletAdapter` class implements the `ICoreWallet` interface and provides a mock wallet adapter for testing purposes.
 * It uses the `ethers` library to manage wallet operations and can be initialized with a private key and provider.
 *
 * @remarks
 * This class is designed to handle both old and new parameter styles for initialization. If the `privateKey` is not provided,
 * a new wallet will be generated using `ethers.Wallet.createRandom()`.
 *
 * @example
 * ```typescript
 * const walletAdapter = await MockedWalletAdapter.create({ privateKey: 'your-private-key', provider: yourProvider });
 * ```
 *
 * @public
 */
export declare class MockedWalletAdapter implements ICoreWallet {
    private wallet;
    private provider?;
    private privateKey;
    initialized: boolean;
    private eventListeners;
    /** General Initialization */
    /**
    * Creates an instance of EvmWalletAdapter.
    *
    * @param args - The arguments to create the wallet adapter.
    * @param args.privateKey - The private key for the wallet. If not provided, a new wallet will be generated.
    * @param args.provider - The provider to be used with the wallet.
    *
    * @remarks
    * This constructor handles both old and new parameter styles. If the `privateKey` is not provided,
    * a new wallet will be generated using `ethers.Wallet.createRandom()`.
    *
    * @example
    * ```typescript
    * const walletAdapter = new EvmWalletAdapter({ privateKey: 'your-private-key', provider: yourProvider });
    * ```
    */
    private constructor();
    /**
   * Static factory method for creating and initializing an adapter in one step
   * @param args Configuration parameters
   * @returns A fully initialized EvmWalletAdapter instance
   */
    static create(args: args): Promise<MockedWalletAdapter>;
    /**
      * Initialize the wallet adapter
      * @returns The adapter instance for chaining
      */
    initialize(): Promise<void>;
    /**
     * Checks if the wallet has been initialized.
     *
     * @returns {boolean} - Returns `true` if the wallet is initialized, otherwise `false`.
     */
    isInitialized(): boolean;
    /**
     * Disconnects the wallet by setting the provider to null.
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
     * Checks if the wallet is connected.
     *
     * @returns {boolean} - Returns `true` if both the provider and wallet's provider are available, otherwise `false`.
     */
    isConnected(): boolean;
    /** Account Management */
    /**
     * Requests the list of accounts from the wallet.
     *
     * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
     *
     * @emits WalletEvent#accountsChanged - Emits an event when the accounts have changed.
     */
    requestAccounts(): Promise<string[]>;
    /**
     * Retrieves the private key.
     *
     * @returns {Promise<string>} A promise that resolves to the private key as a string.
     */
    getPrivateKey(): Promise<string>;
    /**
     * Retrieves the list of account addresses associated with the wallet.
     *
     * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
     */
    getAccounts(): Promise<string[]>;
    /**
     * Retrieves the balance of the specified account.
     *
     * @param account - The account address to check the balance for. If not provided, uses the first account.
     * @returns {Promise<string>} A promise that resolves to the balance as a string.
     */
    getBalance(account?: string): Promise<string>;
    /**
     * Verifies the correctness of a signature for a given message.
     *
     * @param message - The message to verify the signature against.
     * @param signature - The signature to verify.
     * @returns {Promise<boolean>} A promise that resolves to `true` if the signature is valid, otherwise `false`.
     */
    verifySignature(message: string, signature: string): Promise<boolean>;
    /**
     * Registers an event listener for the specified event.
     *
     * @param event - The event to listen for.
     * @param callback - The callback function to be invoked when the event is triggered.
     */
    on(event: any, callback: (...args: any[]) => void): void;
    /**
     * Removes a previously registered event listener for the specified event.
     *
     * @param event - The event for which the listener should be removed.
     * @param callback - The callback function that was registered as the listener.
     */
    off(event: any, callback: (...args: any[]) => void): void;
    /** Network Management */
    /**
     * Retrieves the network information from the provider.
     *
     * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
     * @throws If the provider is not set.
     */
    getNetwork(): Promise<{
        chainId: string;
        name?: string;
    }>;
    /**
    * Sets the provider for the wallet and connects the wallet to the new provider if it exists.
    *
    * @param provider - The provider to set for the wallet.
    */
    setProvider(provider: Provider): void;
    /** Transactions & Signing */
    sendTransaction(tx: any): Promise<string>;
    signTransaction(tx: any): Promise<string>;
    signMessage(message: string): Promise<string>;
}
export {};
