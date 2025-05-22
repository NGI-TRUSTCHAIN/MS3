import { Web3AuthNoModal } from "@web3auth/no-modal";
import { ChainNamespaceType, WALLET_ADAPTERS } from "@web3auth/base";
import { ethers, TransactionReceipt } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { WalletEvent, IEVMWallet, AssetBalance, GenericTransactionData, EIP712TypedData, EstimatedFeeData } from "../types/index.js";
import { AdapterArguments, AdapterError, NetworkConfig, WalletErrorCode } from "@m3s/common";

/**
 * Configuration specific to the Web3AuthWalletAdapter.
 * This structure is expected within the `options` field of `IWalletOptions`
 * when creating the adapter via `createWallet`.
 */
export interface IWeb3AuthWalletOptionsV1  {
  web3authConfig: {
    /** Your Web3Auth Plug and Play Client ID */
    clientId: string;
    /** Web3Auth Network ("sapphire_mainnet", "sapphire_devnet", "mainnet", "cyan", "aqua", "testnet") */
    web3AuthNetwork: string;
    /** Configuration for the blockchain */
    chainConfig: {
      chainNamespace: ChainNamespaceType; // e.g., "eip155"
      chainId: string; // Hexadecimal chain ID (e.g., "0x1" for Ethereum Mainnet)
      rpcTarget: string; // RPC endpoint URL
      displayName: string; // User-friendly network name (e.g., "Ethereum Mainnet")
      blockExplorer: string; // Block explorer URL
      ticker: string; // Native currency ticker (e.g., "ETH")
      tickerName: string; // Native currency name (e.g., "Ethereum")
    };
    /** Configuration for the login provider (e.g., Google, Facebook) */
    loginConfig: {
      loginProvider: string; // e.g., "google", "facebook", "twitter"
      // Add other login provider specific options if needed
    };
    // Add other Web3Auth specific configurations if necessary
    // e.g., uiConfig, sessionTime, etc.
  };
}

/**
 * The specific argument type that Web3AuthWalletAdapter's constructor and static create method
 * will work with internally. It uses the common AdapterArguments base.
 */
interface args extends AdapterArguments<IWeb3AuthWalletOptionsV1> { }

/**
 * Web3AuthWalletAdapter is an implementation of the IEVMWallet interface using Web3AuthNoModal.
 * It provides methods to initialize the wallet, connect to a provider, and perform various
 * wallet operations such as sending transactions, signing messages, and retrieving account information.
 */
export class Web3AuthWalletAdapter implements IEVMWallet {
  private web3auth: Web3AuthNoModal | null = null;
  private initialized = false;
  private config: args;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();


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
  private constructor(args: args) {
    // console.debug("Web3Auth adapter received args:", JSON.stringify(args, null, 2));
    this.config = args;
  }

  /**
   * Factory method to create an instance of Web3AuthWalletAdapter.
   * @param {args} args - The configuration arguments for the Web3AuthWalletAdapter.
   * @returns {Promise<Web3AuthWalletAdapter>} A promise that resolves to the created adapter instance.
   */
  static async create(args: args): Promise<Web3AuthWalletAdapter> {
    const adapter = new Web3AuthWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  /**
   * Initialize the Web3AuthNoModal instance with the provided configuration.
   * @throws Error if initialization fails or chainConfig is missing.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const opts = this.config.options as IWeb3AuthWalletOptionsV1;
    if (!opts || !opts.web3authConfig) {
      throw new AdapterError("Web3Auth configuration (options.web3authConfig) is missing for initialization.", {
        code: WalletErrorCode.MissingConfig,
        methodName: 'initialize',
        details: { path: 'options.web3authConfig' }
      });
    }

    try {

      this.web3auth = new Web3AuthNoModal({
        clientId: opts.web3authConfig.clientId,
        web3AuthNetwork: opts.web3authConfig.web3AuthNetwork as any,
        chainConfig: { // This is Web3Auth's internal chainConfig
          chainNamespace: opts.web3authConfig.chainConfig.chainNamespace as ChainNamespaceType,
          chainId: opts.web3authConfig.chainConfig.chainId,
          rpcTarget: opts.web3authConfig.chainConfig.rpcTarget,
          displayName: opts.web3authConfig.chainConfig.displayName,
          // Renamed as for web3auth requirement to blockExplorerUrl
          blockExplorerUrl: opts.web3authConfig.chainConfig.blockExplorer,
          ticker: opts.web3authConfig.chainConfig.ticker,
          tickerName: opts.web3authConfig.chainConfig.tickerName,
        },
      });

      const authAdapter = new AuthAdapter({
        adapterSettings: {
          clientId: opts.web3authConfig.clientId,
          loginConfig: this.config.options.web3authConfig.loginConfig as any
        }
      });

      this.web3auth.configureAdapter(authAdapter);
      await this.web3auth.init();
      this.initialized = true;
    } catch (error: unknown) {
      const errorCode = WalletErrorCode.InitializationFailed;
      console.error(`[Web3AuthWalletAdapter:${'initialize'}] ${errorCode}: Initialization failed:`, error);
      this.initialized = false;
      throw new AdapterError("Web3Auth initialization failed.", {
        cause: error,
        code: errorCode,
        methodName: 'initialize'
      });
    }
  }

  /**
  * Check if the wallet has been initialized
  * @returns True if the wallet is initialized, otherwise false
  */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Disconnects from Web3Auth
   */
  async disconnect(): Promise<void> {
    if (this.web3auth && this.web3auth.connected) {
      await this.web3auth.logout();
      // console.debug("[Web3AuthWalletAdapter] Logged out.");
    }
    // Reset state partially, keep config
    this.web3auth = null; // Allow re-initialization
    this.initialized = false;
    this.eventListeners.clear();
    // console.debug("[Web3AuthWalletAdapter] Disconnected.");
  }

  /********************/
  /** Wallet Metadata */
  /********************/

  /**
  * Gets the name of the wallet adapter
  * @returns The name of the wallet adapter
  */
  getWalletName(): string {
    return "Web3AuthWallet";
  }

  /**
   * Gets the version of the wallet adapter
   * @returns The version string of the wallet adapter
   */
  getWalletVersion(): string {
    // TODO: Potentially get version from Web3Auth SDK if available
    return "1.0.0";
  }

  /**
   * Checks both initialization and Web3Auth connection status
   * @returns True if the wallet is connected, otherwise false
   */
  isConnected(): boolean {
    return this.initialized && !!this.web3auth?.connected;
  }

  /***********************/
  /** Account Management */
  /***********************/

  /**
     * Requests user accounts and triggers Web3Auth login flow if not already connected
     * @returns Promise resolving to an array of account addresses
     * @throws Error if connection fails or provider is not available
     */
  async requestAccounts(): Promise<string[]> {
    if (!this.initialized || !this.web3auth) {
      throw new AdapterError("Wallet not initialized. Call initialize() first.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'requestAccounts'
      });
    }

    try {
      if (this.web3auth.connected) {
        const accounts = await this.getAccounts(); // Use internal getAccounts
        // console.debug("[Web3AuthWalletAdapter] Already connected, returning accounts:", accounts);

        this.emitEvent(WalletEvent.accountsChanged, accounts);
        return accounts;
      }

      // Login flow
      // console.debug("[Web3AuthWalletAdapter] Not connected, triggering login flow...");
      const loginProvider = this.config.options.web3authConfig.loginConfig.loginProvider;
      await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider }); // Use AUTH adapter

      if (!this.web3auth.connected || !this.web3auth.provider) {
        throw new AdapterError("Failed to connect to Web3Auth or provider unavailable after login.", {
          code: WalletErrorCode.ConnectionFailed,
          methodName: 'requestAccounts'
        });
      }
      // console.debug("[Web3AuthWalletAdapter] Connection successful.");

      // Get accounts after connection
      const accounts = await this.web3auth.provider.request({
        method: "eth_accounts"
      }) as string[];

      // console.debug("[Web3AuthWalletAdapter] Accounts obtained after login:", accounts);
      // this.accounts = accounts;
      this.emitEvent(WalletEvent.accountsChanged, accounts);
      return accounts;
    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Error requesting accounts:", error);
      throw error;
    }
  }

  /**
 * Gets the current accounts without triggering login flow
 * @returns Promise resolving to an array of account addresses
 */
  async getAccounts(): Promise<string[]> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      // Return empty array if not connected, don't throw
      // console.debug("[Web3AuthWalletAdapter] getAccounts called while not connected.");
      return [];
    }

    try {
      const accounts = await this.web3auth.provider.request({ method: "eth_accounts" }) as string[];
      // console.debug("[Web3AuthWalletAdapter] getAccounts result:", accounts);
      return accounts;
    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Error in getAccounts:", error);
      return []; // Return empty on error
    }
  }

  /**
   * Gets the balance of the specified account
   * @param account The account address (optional, defaults to the first account)
   * @returns Promise resolving to the balance in ether
   * @throws Error if wallet is not connected or balance retrieval fails
   * */
  async getBalance(account?: string): Promise<AssetBalance> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new AdapterError("Not connected to Web3Auth or provider unavailable.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getBalance'
      });
    }

    try {
      const provider = this.getProvider(); // Use helper
      const address = account || (await this.getAccounts())[0];
      if (!address) {
        throw new AdapterError("No account available to fetch balance.", {
          code: WalletErrorCode.AccountUnavailable,
          methodName: 'getBalance'
        });
      }

      const balanceWei = await provider.getBalance(address);
      const decimals = 18
      const symbol = this.config.options.web3authConfig.chainConfig.ticker || "ETH";

      return {
        amount: balanceWei.toString(),
        decimals: decimals,
        symbol: symbol,
        formattedAmount: ethers.formatUnits(balanceWei, decimals)
      };
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: getBalance] Error getting balance:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError(`Failed to get balance: ${message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError,
        methodName: 'getBalance'
      });
    }
  }

  /**
   * Verifies the signature of a message
   * @param message The message to verify
   * @param signature The signature to verify against
   * @returns Promise resolving to true if the signature is valid, otherwise false
   */
  async verifySignature(message: string | Uint8Array, signature: string, address: string): Promise<boolean> {
    // Verification doesn't strictly require connection, but address matching does
    if (!address) {
      throw new Error("Address parameter is required for verification.");
    }
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const result = recoveredAddress.toLowerCase() === address.toLowerCase();
      // console.debug(`[Web3AuthWalletAdapter] Signature verification result for ${address}: ${result}`);
      return result;
    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Signature verification failed:", error);
      return false; // Return false on error
    }
  }

  /********************/
  /** Event Handling  */
  /********************/

  /**
   * Emits an event with the specified name and payload
   * @param eventName The name of the event to emit
   * @param payload The payload to pass to the event listeners
   */
  private emitEvent(eventName: WalletEvent, payload: any): void {
    // console.debug(`[Web3AuthWalletAdapter] Emitting ${eventName} event with:`, payload);
    const listeners = this.eventListeners.get(eventName);
    if (listeners && listeners.size > 0) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error: unknown) {
          console.error(`[Web3AuthWalletAdapter] Error in ${eventName} event handler:`, error);
        }
      });
    } else {
      console.warn(`[Web3AuthWalletAdapter] No listeners registered for ${eventName} event`);
    }
  }

  /**
   * Registers an event listener
   * @param event The event to listen for
   * @param callback The callback function to invoke when the event is emitted
   */
  on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    // console.debug(`[Web3AuthWalletAdapter] Listener added for ${event}`);
    // No direct provider listeners needed, we emit manually
  }

  /**
   * Removes an event listener
   * @param event The event to remove the listener from
   * @param callback The callback function to remove
   */
  off(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
      // console.debug(`[Web3AuthWalletAdapter] Listener removed for ${event}`);
    }
  }

  /***********************/
  /** Network Management */
  /***********************/

  /**
 * Gets network information
 * @returns Promise resolving to an object with chainId and optional name properties
 * @throws Error if provider is not available
 */
  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    // console.debug("[Web3AuthWalletAdapter] Getting network");
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new AdapterError("Not connected to Web3Auth or provider unavailable.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getNetwork'
      });
    }
    try {
      const provider = this.getProvider();
      const network = await provider.getNetwork();
      // console.debug("[Web3AuthWalletAdapter] getNetwork result:", network);
      // Return chainId as string or number based on ICoreWallet definition
      return {
        chainId: network.chainId.toString(), // Or keep as bigint/number if interface allows
        name: network.name
      };
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: getNetwork] Error getting network:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new AdapterError(`Failed to get network: ${message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError,
        methodName: 'getNetwork'
      });
    }
  }

  /**
 * Gets a fresh provider from the current Web3Auth instance
 * @returns A new provider using the current Web3Auth state
 */
  private getProvider(): ethers.BrowserProvider {
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new Error("Web3Auth provider not available");
    }
    // Cache provider instance? Maybe not, Web3Auth might change underneath.
    return new ethers.BrowserProvider(this.web3auth.provider as any); // Cast needed
  }


  /**
   * Sets the provider for Web3Auth by switching chains.
   * This method accepts either a direct chainConfig object or an object containing chainConfig.
   * 
   * @param config - Network configuration with required chain details
   */
  async setProvider(config: NetworkConfig): Promise<void> {
    if (!this.initialized || !this.web3auth) {
      throw new Error("Web3Auth not initialized");
    }

    // Validate required property
    if (!config.chainId) {
      throw new AdapterError("chainId is required in setProvider config (NetworkConfig).", { code: 'MISSING_PARAMETER' });
    }
    if (!config.rpcUrls || config.rpcUrls.length === 0 || !config.rpcUrls[0]) {
      throw new AdapterError("At least one rpcUrl is required in setProvider config (NetworkConfig).", { code: 'MISSING_PARAMETER' });
    }

    const newChainIdHex = config.chainId.startsWith('0x') ? config.chainId : `0x${parseInt(config.chainId, 10).toString(16)}`;

    try {
      const currentChainId = this.web3auth.provider ? await this.web3auth.provider.request({ method: "eth_chainId" }) : null;

      if (currentChainId !== newChainIdHex) {
        // console.debug(`[Web3AuthWalletAdapter] Attempting to switch chain to ${newChainIdHex}. Current: ${currentChainId}`);
        await this.web3auth.switchChain({ chainId: newChainIdHex });
        // console.debug(`[Web3AuthWalletAdapter] Switched chain to ${newChainIdHex} successfully.`);
      } else {
        // console.debug(`[Web3AuthWalletAdapter] Already on chain ${newChainIdHex}, no switch needed.`);
        // Even if on the same chain, ensure provider state is refreshed and event is emitted if it's a fresh setProvider call
      }
    } catch (switchError: any) {
      if (switchError.code === -32000 || switchError.code === 4902 || (typeof switchError.message === 'string' && switchError.message.includes("Unrecognized chain ID"))) { // Common codes for "chain not added"
        try {
          const chainToAdd = {
            chainId: newChainIdHex,
            chainNamespace: this.config.options.web3authConfig.chainConfig.chainNamespace || "eip155" as ChainNamespaceType,
            displayName: config.displayName || config.name || 'Custom Network',
            rpcTarget: config.rpcUrls[0], // Use the first RPC URL from NetworkConfig
            blockExplorerUrl: config.blockExplorer, // Web3Auth expects singular blockExplorerUrl
            ticker: config.ticker || 'ETH',
            tickerName: config.tickerName || config.ticker || 'Ethereum',
          };
          // console.debug("[Web3AuthWalletAdapter] Attempting to add chain:", chainToAdd);
          await this.web3auth.addChain(chainToAdd as any); // Cast needed if Web3Auth types are not perfectly aligned
          // console.debug(`[Web3AuthWalletAdapter] Added chain ${newChainIdHex}. Now attempting to switch again.`);
          await this.web3auth.switchChain({ chainId: newChainIdHex });
          // console.debug(`[Web3AuthWalletAdapter] Switched to added chain ${newChainIdHex} successfully.`);
        } catch (addError: any) {
          // console.error(`[Web3AuthWalletAdapter] Error adding or switching to chain ${newChainIdHex} after attempt to add:`, addError);
          throw new AdapterError(`Failed to set provider: Could not add or switch to chain ${newChainIdHex}. Add error: ${addError.message}`, { code: 'PROVIDER_SWITCH_FAILED', cause: addError });
        }
      } else {
        // console.error(`[Web3AuthWalletAdapter] Error switching chain to ${newChainIdHex} (not an 'unrecognized chain' error):`, switchError);
        throw new AdapterError(`Failed to set provider: Could not switch to chain ${newChainIdHex}. Error: ${switchError.message}`, { code: 'PROVIDER_SWITCH_FAILED', cause: switchError });
      }
    }

    // Force Web3Auth to refresh its internal provider state after switch/add
    // This can help ensure the subsequent getNetwork() calls reflect the new chain.
    if (this.web3auth.provider) {
      try {
        await this.web3auth.provider.request({ method: "eth_chainId" });
        await this.web3auth.provider.request({ method: "eth_accounts" }); // Also refresh accounts
      } catch (refreshError) {
        // console.warn("[Web3AuthWalletAdapter] Error refreshing provider state after chain switch/add:", refreshError);
        // Not throwing here, as the switch/add might have succeeded.
      }
    }

    const networkInfo = await this.getNetwork(); // Get updated network info
    this.emitEvent(WalletEvent.chainChanged, networkInfo.chainId); // Emit the actual chainId
  }

  /***************************/
  /** Transactions & Signing */
  /***************************/

  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    const signer = await this.getSigner();

    // Basic structure from GenericTransactionData
    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value,
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      nonce: tx.options?.nonce,
      gasLimit: tx.options?.gasLimit ? BigInt(tx.options.gasLimit) : undefined,
      gasPrice: tx.options?.gasPrice ? BigInt(tx.options.gasPrice) : undefined,
      maxFeePerGas: tx.options?.maxFeePerGas ? BigInt(tx.options.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? BigInt(tx.options.maxPriorityFeePerGas) : undefined,
      chainId: tx.options?.chainId ? BigInt(tx.options.chainId) : undefined,
      ...(tx.options?.type !== undefined && { type: tx.options.type }),
    };

    // Populate missing fields if not provided in options (e.g., nonce, gas)
    if (txRequest.nonce === undefined) {
      txRequest.nonce = await signer.getNonce();
    }
    // Gas handling: Prioritize options, then estimate
    if (txRequest.gasLimit === undefined && tx.options?.gasLimit === undefined) {
      // Use estimateGas internally - requires TransactionData or adaptation
      // For now, let's skip auto-estimation in sendTransaction and require it in options or estimateGas call
      // txRequest.gasLimit = await this.(tx as TransactionData); // Requires casting or changing estimateGas input
    }
    if (txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined && tx.options?.gasPrice === undefined && tx.options?.maxFeePerGas === undefined) {
      const feeData = await signer.provider?.getFeeData();
      if (feeData?.maxFeePerGas && feeData?.maxPriorityFeePerGas) {
        txRequest.maxFeePerGas = feeData.maxFeePerGas;
        txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else {
        txRequest.gasPrice = feeData?.gasPrice;
      }
    }

    // Remove undefined fields
    Object.keys(txRequest).forEach(key => txRequest[key as keyof ethers.TransactionRequest] === undefined && delete txRequest[key as keyof ethers.TransactionRequest]);

    return txRequest;
  }

  /**
   * Sends a transaction
   * @param tx The transaction to send
   * @returns Promise resolving to the transaction hash
   * @throws Error if wallet is not connected
   */
  async sendTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot send transaction.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'sendTransaction'
      });
    }

    try {
      console.log('sendTransaction: Getting signer...');
      const signer = await this.getSigner();
      console.log('Signer is: ', signer)

      console.log('sendTransaction: Preparing transaction request...');
      const txRequest = await this.prepareTransactionRequest(tx);
      console.log('Transaction request is: ', txRequest)

      console.log('sendTransaction: Calling signer.sendTransaction...');
      const response = await signer.sendTransaction(txRequest);
      console.log('Signer.sendTransaction result: ', response)

      return response.hash;

    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: sendTransaction] Error sending transaction:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      let errorCode: WalletErrorCode | string = WalletErrorCode.TransactionFailed;
      if (message.toLowerCase().includes('user denied') || message.toLowerCase().includes('rejected by user')) {
        errorCode = WalletErrorCode.UserRejected;
      }
      throw new AdapterError(`Failed to send transaction: ${message}`, {
        cause: error,
        code: errorCode,
        methodName: 'sendTransaction'
      });
    }
  }

  /**
   * Signs a transaction without sending it
   * @param tx The transaction to sign
   * @returns Promise resolving to the signed transaction as a hex string
   * @throws Error if wallet is not connected
   */
  async signTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot sign transaction.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'signTransaction'
      });
    }
    try {
      const signer = await this.getSigner();
      const preparedTx = await this.prepareTransactionRequest(tx);
      // console.debug("[Web3AuthWalletAdapter] Signing transaction:", preparedTx);
      const signedTx = await signer.signTransaction(preparedTx);
      // console.debug("[Web3AuthWalletAdapter] Transaction signed.");
      return signedTx;
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: signTransaction] Error signing transaction:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      let errorCode: WalletErrorCode | string = WalletErrorCode.SigningFailed;
      if (message.toLowerCase().includes('user denied') || message.toLowerCase().includes('rejected by user')) {
        errorCode = WalletErrorCode.UserRejected;
      }
      throw new AdapterError(`Failed to sign transaction: ${message}`, {
        cause: error,
        code: errorCode,
        methodName: 'signTransaction'
      });
    }
  }

  /**
 * Gets a fresh signer from the current Web3Auth provider
 * @returns A promise resolving to a new signer
 */
  private async getSigner(): Promise<ethers.Signer> {
    const provider = this.getProvider();
    // Ensure provider is connected and has accounts before getting signer
    const accounts = await this.getAccounts();
    if (accounts.length === 0) {
      throw new Error("No accounts available to create signer.");
    }
    return await provider.getSigner(accounts[0]); // Get signer for the first account
  }

  /**
   * Signs a message
   * @param message The message to sign
   * @returns Promise resolving to the signature
   * @throws Error if wallet is not connected
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot sign message.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'signMessage'
      });
    }
    try {
      const signer = await this.getSigner();
      // console.debug("[Web3AuthWalletAdapter] Signing message:", message);
      const signature = await signer.signMessage(message);
      // console.debug("[Web3AuthWalletAdapter] Message signed.");
      return signature;
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: signMessage] Error signing message:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const messageText = error instanceof Error ? error.message : String(error);
      let errorCode: WalletErrorCode | string = WalletErrorCode.SigningFailed;
      if (messageText.toLowerCase().includes('user denied') || messageText.toLowerCase().includes('rejected by user')) {
        errorCode = WalletErrorCode.UserRejected;
      }
      throw new AdapterError(`Failed to sign message: ${messageText}`, {
        cause: error,
        code: errorCode,
        methodName: 'signMessage'
      });
    }
  }

  /**************************/
  /** EVM-Specific Features */
  /**************************/

  /**
     * Signs typed data according to EIP-712
     * @param data The typed data to sign containing domain, types and value
     * @returns Promise resolving to the signature
     * @throws Error if wallet is not connected
     */
  async signTypedData(data: EIP712TypedData): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot sign typed data.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'signTypedData'
      });
    }
    try {
      const signer = await this.getSigner();
      // console.debug("[Web3AuthWalletAdapter] Signing typed data:", data);
      const signature = await signer.signTypedData(data.domain, data.types, data.value);
      // console.debug("[Web3AuthWalletAdapter] Typed data signed.");
      return signature;
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: signTypedData] Error signing typed data:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      let errorCode: WalletErrorCode | string = WalletErrorCode.SigningFailed;
      if (message.toLowerCase().includes('user denied') || message.toLowerCase().includes('rejected by user')) {
        errorCode = WalletErrorCode.UserRejected;
      }
      throw new AdapterError(`Failed to sign typed data: ${message}`, {
        cause: error,
        code: errorCode,
        methodName: 'signTypedData'
      });
    }
  }


  /**
   * Estimates gas for a transaction
   * @param tx The transaction to estimate gas for
   * @returns Promise resolving to the estimated gas as a string
   * @throws Error if wallet is not connected
   */
  async estimateGas(tx: GenericTransactionData): Promise<EstimatedFeeData> {

    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot estimate gas.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'estimateGas'
      });
    }

    try {
      const provider = this.getProvider();
      const preparedTx = await this.prepareTransactionRequest(tx);
      // console.debug("[Web3AuthWalletAdapter] Estimating gas for:", preparedTx);

      const gasLimit = await provider.estimateGas(preparedTx);
      // console.debug("[Web3AuthWalletAdapter] Gas estimated:", gasLimit.toString());

      let feeData: ethers.FeeData | null = null;
      try {
        feeData = await provider.getFeeData();
      } catch (feeError) {
        // console.warn("[Web3AuthWalletAdapter] Could not fetch EIP-1559 fee data, falling back to gasPrice if available.", feeError);
      }

      return {
        gasLimit: gasLimit,
        gasPrice: feeData?.gasPrice?.toString(),
        maxFeePerGas: feeData?.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString(),
      };
    } catch (error: any) {
      console.error(`[Web3AuthWalletAdapter: estimateGas] Error estimating gas:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError(`Failed to estimate gas: ${message}`, {
        cause: error,
        code: WalletErrorCode.GasEstimationFailed,
        methodName: 'estimateGas'
      });
    }
  }

  /**
  * Gets the current gas price
  * @returns Promise resolving to the gas price as a string
  * @throws Error if wallet is not connected or gas price is unavailable
  */
  async getGasPrice(): Promise<bigint> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot get gas price.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getGasPrice'
      });
    }
    try {
      const provider = this.getProvider();
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice) {
        return feeData.gasPrice;
      }
      throw new AdapterError("Gas price not available (network might be EIP-1559 only or provider did not return it). Consider using estimateGas.", {
        code: WalletErrorCode.GasEstimationFailed, // More specific
        methodName: 'getGasPrice'
      });
    } catch (error: any) {
      console.error(`[Web3AuthWalletAdapter: getGasPrice] Error getting gas price:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError(`Failed to get gas price: ${message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError, // Or a more specific code
        methodName: 'getGasPrice'
      });
    }
  }


  /**
  * Gets the transaction receipt for a transaction hash
  * @param txHash The transaction hash
  * @returns Promise resolving to the transaction receipt
  * @throws Error if wallet is not connected
  */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> { // Use ethers type
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot get transaction receipt.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getTransactionReceipt'
      });
    }
    try {
      const provider = this.getProvider();
      // console.debug(`[Web3AuthWalletAdapter] Getting transaction receipt for hash: ${txHash}`);
      const receipt = await provider.getTransactionReceipt(txHash);
      // console.debug("[Web3AuthWalletAdapter] Transaction receipt:", receipt);
      return receipt;
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: getTransactionReceipt] Error getting transaction receipt for ${txHash}:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError(`Failed to get transaction receipt for ${txHash}: ${message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError, // Or a more specific code
        methodName: 'getTransactionReceipt'
      });
    }
  }

  /**
   * Gets the token balance for an ERC20 token
   * @param tokenAddress The token contract address
   * @param account Optional account address, uses connected account if not specified
   * @returns Promise resolving to the token balance as a string
   * @throws Error if wallet is not connected
   */
  async getTokenBalance(tokenAddress: string, account?: string, abi?: string[]): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected. Cannot get token balance.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getTokenBalance'
      });
    }
    try {
      const provider = this.getProvider();
      const targetAccount = account || (await this.getAccounts())[0];
      if (!targetAccount) {
        throw new AdapterError("No account available to fetch token balance.", {
          code: WalletErrorCode.AccountUnavailable,
          methodName: 'getTokenBalance'
        });
      }

      const contractAbi = abi || [
        "function balanceOf(address owner) view returns (uint256)",
      ];
      const contract = new ethers.Contract(tokenAddress, contractAbi, provider);
      // console.debug(`[Web3AuthWalletAdapter] Getting token balance for ${tokenAddress} on account ${targetAccount}`);
      const balance = await contract.balanceOf(targetAccount);
      // console.debug("[Web3AuthWalletAdapter] Token balance obtained:", balance.toString());
      return balance.toString(); // Return raw balance string
    } catch (error: unknown) {
      console.error(`[Web3AuthWalletAdapter: getTokenBalance] Error getting token balance for ${tokenAddress}:`, error);
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AdapterError(`Failed to get token balance for ${tokenAddress}: ${message}`, {
        cause: error,
        code: WalletErrorCode.TokenBalanceFailed,
        methodName: 'getTokenBalance'
      });
    }
  }
}