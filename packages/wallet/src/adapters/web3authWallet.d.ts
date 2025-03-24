import { ChainNamespaceType } from "@web3auth/base";
import { TransactionReceipt } from "ethers";
import { IEVMWallet, TransactionData, TypedData } from "../types/index.js";
interface args {
    adapterName: string;
    options: {
        web3authConfig: {
            clientId: string;
            web3AuthNetwork: string;
            chainConfig: {
                chainNamespace: ChainNamespaceType;
                chainId: string;
                rpcTarget: string;
                displayName: string;
                blockExplorer: string;
                ticker: string;
                tickerName: string;
            };
            loginConfig: {
                loginProvider: string;
            };
        };
    };
}
/**
 * Web3AuthWalletAdapter is an implementation of the IEVMWallet interface using Web3AuthNoModal.
 * It provides methods to initialize the wallet, connect to a provider, and perform various
 * wallet operations such as sending transactions, signing messages, and retrieving account information.
 */
export declare class Web3AuthWalletAdapter implements IEVMWallet {
    private web3auth;
    private initialized;
    private config;
    private eventListeners;
    /***************************/
    /** General Initialization */
    /***************************/
    /**
     * Creates an instance of Web3AuthWalletAdapter.
     *
     * @private
     * @constructor
     * @param {args} args - The configuration arguments for the Web3AuthWalletAdapter.
     */
    private constructor();
    /**
     * Factory method to create an instance of Web3AuthWalletAdapter.
     * @param {args} args - The configuration arguments for the Web3AuthWalletAdapter.
     * @returns {Promise<Web3AuthWalletAdapter>} A promise that resolves to the created adapter instance.
     */
    static create(args: args): Promise<Web3AuthWalletAdapter>;
    /**
     * Initialize the Web3AuthNoModal instance with the provided configuration.
     * @throws Error if initialization fails or chainConfig is missing
     */
    initialize(config?: any): Promise<void>;
    /**
    * Check if the wallet has been initialized
    * @returns True if the wallet is initialized, otherwise false
    */
    isInitialized(): boolean;
    /**
     * Disconnects from Web3Auth
     */
    disconnect(): Promise<void>;
    /********************/
    /** Wallet Metadata */
    /********************/
    /**
    * Gets the name of the wallet adapter
    * @returns The name of the wallet adapter
    */
    getWalletName(): string;
    /**
     * Gets the version of the wallet adapter
     * @returns The version string of the wallet adapter
     */
    getWalletVersion(): string;
    /**
     * Checks if the wallet is connected
     * @returns True if the wallet is connected, otherwise false
     */
    isConnected(): boolean;
    /***********************/
    /** Account Management */
    /***********************/
    /**
       * Requests user accounts and triggers Web3Auth login flow if not already connected
       * @returns Promise resolving to an array of account addresses
       * @throws Error if connection fails or provider is not available
       */
    requestAccounts(): Promise<string[]>;
    /**
     * Gets the private key from Web3Auth
     * @returns Promise resolving to the private key
     * @throws Error if wallet is not connected or private key is unavailable
     */
    getPrivateKey(): Promise<string>;
    /**
   * Gets the current accounts without triggering login flow
   * @returns Promise resolving to an array of account addresses
   */
    getAccounts(): Promise<string[]>;
    /**
     * Gets the balance of the specified account
     * @param account The account address (optional, defaults to the first account)
     * @returns Promise resolving to the balance in ether
     * @throws Error if wallet is not connected or balance retrieval fails
     * */
    getBalance(account?: string): Promise<string>;
    /**
     * Verifies the signature of a message
     * @param message The message to verify
     * @param signature The signature to verify against
     * @returns Promise resolving to true if the signature is valid, otherwise false
     */
    verifySignature(message: string, signature: string): Promise<boolean>;
    /**
     * Emits an event with the specified name and payload
     * @param eventName The name of the event to emit
     * @param payload The payload to pass to the event listeners
     */
    private emitEvent;
    /**
     * Registers an event listener
     * @param event The event to listen for
     * @param callback The callback function to invoke when the event is emitted
     */
    on(event: string, callback: (...args: any[]) => void): void;
    /**
     * Removes an event listener
     * @param event The event to remove the listener from
     * @param callback The callback function to remove
     */
    off(event: string, callback: (...args: any[]) => void): void;
    /***********************/
    /** Network Management */
    /***********************/
    /**
   * Gets network information
   * @returns Promise resolving to an object with chainId and optional name properties
   * @throws Error if provider is not available
   */
    getNetwork(): Promise<{
        chainId: string;
        name?: string;
    }>;
    /**
   * Gets a fresh provider from the current Web3Auth instance
   * @returns A new provider using the current Web3Auth state
   */
    private getProvider;
    /**
     * Sets the provider for the wallet by switching chains in Web3Auth
     * @param provider The provider configuration for Web3Auth
     * @returns Promise resolving when the provider is set
     * @throws Error if Web3Auth is not initialized or chain switch fails
     */
    setProvider(provider: Partial<{
        chainConfig: {
            chainNamespace: ChainNamespaceType;
            chainId: string;
            rpcTarget: string;
            displayName: string;
            blockExplorer: string;
            ticker: string;
            tickerName: string;
        };
        web3AuthNetwork: string;
        sessionTime: number;
        redirectUrl: string;
    }>): Promise<void>;
    /***************************/
    /** Transactions & Signing */
    /***************************/
    /**
     * Sends a transaction
     * @param tx The transaction to send
     * @returns Promise resolving to the transaction hash
     * @throws Error if wallet is not connected
     */
    sendTransaction(tx: TransactionData): Promise<string>;
    /**
     * Signs a transaction without sending it
     * @param tx The transaction to sign
     * @returns Promise resolving to the signed transaction as a hex string
     * @throws Error if wallet is not connected
     */
    signTransaction(tx: TransactionData): Promise<string>;
    /**
   * Gets a fresh signer from the current Web3Auth provider
   * @returns A promise resolving to a new signer
   */
    private getSigner;
    /**
     * Signs a message
     * @param message The message to sign
     * @returns Promise resolving to the signature
     * @throws Error if wallet is not connected
     */
    signMessage(message: string): Promise<string>;
    /**************************/
    /** EVM-Specific Features */
    /**************************/
    /**
       * Signs typed data according to EIP-712
       * @param data The typed data to sign containing domain, types and value
       * @returns Promise resolving to the signature
       * @throws Error if wallet is not connected
       */
    signTypedData(data: TypedData): Promise<string>;
    /**
    * Gets the current gas price
    * @returns Promise resolving to the gas price as a string
    * @throws Error if wallet is not connected or gas price is unavailable
    */
    getGasPrice(): Promise<string>;
    /**
     * Estimates gas for a transaction
     * @param tx The transaction to estimate gas for
     * @returns Promise resolving to the estimated gas as a string
     * @throws Error if wallet is not connected
     */
    estimateGas(tx: TransactionData): Promise<string>;
    /**
    * Gets the transaction receipt for a transaction hash
    * @param txHash The transaction hash
    * @returns Promise resolving to the transaction receipt
    * @throws Error if wallet is not connected
    */
    getTransactionReceipt(txHash: string): Promise<TransactionReceipt>;
    /**
     * Gets the token balance for an ERC20 token
     * @param tokenAddress The token contract address
     * @param account Optional account address, uses connected account if not specified
     * @returns Promise resolving to the token balance as a string
     * @throws Error if wallet is not connected
     */
    getTokenBalance(tokenAddress: string, account?: string, abi?: string[]): Promise<string>;
}
export {};
