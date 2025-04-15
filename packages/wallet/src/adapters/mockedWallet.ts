import { ethers, Wallet as EthersWallet, JsonRpcProvider, TransactionReceipt, TransactionResponse } from "ethers";
import { AssetBalance, EIP712TypedData, GenericTransactionData, ICoreWallet, IWalletOptions, ProviderConfig, WalletEvent } from "../types/index.js";

export interface MockWalletArgs extends IWalletOptions {
  adapterName: 'mocked'; // Enforce 'mocked'
  options?: {
    privateKey?: string;
  };
  provider?: ProviderConfig;
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
export class MockedWalletAdapter implements ICoreWallet {
  private wallet: EthersWallet | null = null;
  private provider: JsonRpcProvider | undefined;
  private privateKey?: string; // Store the private key if provided
  private initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();
  private currentTicker: string | undefined = 'ETH'; // Default ticker, updated on setProvider
  private readonly name: string; // Store adapter name

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
  private constructor(args: MockWalletArgs) {
    console.log("[MockedWalletAdapter] Creating with args:", args);
    this.privateKey = args.options?.privateKey; // Store if provided
    this.name = args.adapterName; // Store adapter name ('mocked')

    // Initial provider setup is handled by createWallet factory or explicit setProvider call
    if (args.provider) {
      console.warn("[MockedWalletAdapter] Initial provider config in constructor ignored. Use setProvider after initialize().");
    }
    console.log("[MockedWalletAdapter] Created.");
  }

  /**
 * Static factory method for creating and initializing an adapter in one step
 * @param args Configuration parameters
 * @returns A fully initialized EvmWalletAdapter instance
 */
  static async create(args: MockWalletArgs): Promise<MockedWalletAdapter> {
    const adapter = new MockedWalletAdapter(args);
    // Initialization happens separately
    return adapter;
  }

  /**
    * Initialize the wallet adapter
    * @returns The adapter instance for chaining
    */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[MockedWalletAdapter] Already initialized.");
      return;
    }
    console.log("[MockedWalletAdapter] Initializing...");
    try {
      if (this.privateKey) {
        this.wallet = new EthersWallet(this.privateKey);
        console.log(`[MockedWalletAdapter] Wallet created from private key for address: ${this.wallet.address}`);
      } else {
        this.wallet = EthersWallet.createRandom() as any;
        this.privateKey = this.wallet!.privateKey; // Store the generated private key
        console.log(`[MockedWalletAdapter] Random wallet created for address: ${this.wallet!.address}`);
      }

      // Connect to provider ONLY if provider was set BEFORE initialize was called
      if (this.provider) {
        this.wallet = this.wallet!.connect(this.provider);
        console.log("[MockedWalletAdapter] Wallet connected to existing provider during initialization.");
      } else {
        console.log("[MockedWalletAdapter] Wallet initialized without provider. Call setProvider() to connect.");
      }

      this.initialized = true;
      console.log("[MockedWalletAdapter] Initialized successfully.");
      // Do not emit connect here, wait for setProvider

    } catch (error) {
      console.error("[MockedWalletAdapter] Initialization failed:", error);
      this.initialized = false;
      this.wallet = null;
      this.privateKey = undefined;
      throw error;
    }
  }

  /**
   * Checks if the wallet has been initialized.
   *
   * @returns {boolean} - Returns `true` if the wallet is initialized, otherwise `false`.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Disconnects the wallet by setting the provider to null.
   */
  async disconnect(): Promise<void> {
    console.log("[MockedWalletAdapter] Disconnecting...");
    const wasConnected = this.isConnected();
    this.provider = undefined;
    // Keep wallet instance and private key, just disconnect provider
    if (this.wallet) {
      this.wallet = this.wallet.connect(null);
    }
    // Reset network details
    this.currentTicker = 'ETH'; // Reset to default
    this.eventListeners.clear(); // Clear listeners on disconnect
    console.log("[MockedWalletAdapter] Disconnected from provider.");
    if (wasConnected) {
      this.emitEvent(WalletEvent.disconnect, null);
    }
  }

  /** Wallet Metadata */

  /**
   * Retrieves the name of the wallet adapter.
   *
   * @returns {string} The name of the wallet adapter.
   */
  getWalletName(): string {
    return this.name; // Returns 'mocked'
  }

  /**
   * Retrieves the version of the wallet.
   *
   * @returns {string} The version of the wallet as a string.
   */
  getWalletVersion(): string {
    return ethers.version; // Use ethers version like EvmWalletAdapter
  }

  /**
   * Checks if the wallet is connected.
   *
   * @returns {boolean} - Returns `true` if both the provider and wallet's provider are available, otherwise `false`.
   */
  isConnected(): boolean {
    // Considered connected if initialized and has a provider connected to the wallet instance
    return this.initialized && !!this.wallet?.provider;
  }

  /** Account Management */

  /**
   * Requests the list of accounts from the wallet.
   * 
   * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
   * 
   * @emits WalletEvent#accountsChanged - Emits an event when the accounts have changed.
   */
  async requestAccounts(): Promise<string[]> {
    if (!this.initialized || !this.wallet) {
      throw new Error("MockedWalletAdapter not initialized.");
    }
    console.log("[MockedWalletAdapter] Requesting accounts...");
    const accounts = [this.wallet.address];
    // Emit accountsChanged when requested, similar to EvmWalletAdapter
    this.emitEvent(WalletEvent.accountsChanged, accounts);
    return accounts;
  }

  /**
   * Retrieves the private key.
   *
   * @returns {Promise<string>} A promise that resolves to the private key as a string.
   */
  async getPrivateKey(): Promise<string> {
    if (!this.initialized) throw new Error("MockedWalletAdapter not initialized.");
    if (!this.privateKey) {
      // This case shouldn't happen if initialize worked correctly
      throw new Error("Private key not available.");
    }
    console.log("[MockedWalletAdapter] Returning private key.");
    return this.privateKey;
  }

  /**
   * Retrieves the list of account addresses associated with the wallet.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
   */
  async getAccounts(): Promise<string[]> {
    if (!this.initialized || !this.wallet) {
      console.log("[MockedWalletAdapter] getAccounts called while not initialized.");
      return [];
    }
    // Returns the single address of the internal wallet
    return [this.wallet.address];
  }

  /**
   * Retrieves the balance of the specified account.
   *
   * @param account - The account address to check the balance for. If not provided, uses the first account.
   * @returns {Promise<string>} A promise that resolves to the balance as a string.
   */
  async getBalance(account?: string): Promise<AssetBalance> {
    if (!this.isConnected() || !this.provider || !this.wallet) {
      throw new Error("MockedWalletAdapter not connected to a provider.");
    }
    const address = account || this.wallet.address;
    console.log(`[MockedWalletAdapter] Getting balance for ${address} from provider...`);
    try {
      const balanceWei = await this.provider.getBalance(address);
      // Attempt to get decimals (usually 18 for native currency)
      const decimals = 18; // Assume 18 for native currency
      const symbol = this.currentTicker || 'ETH'; // Use stored ticker

      return {
        amount: balanceWei.toString(),
        decimals: decimals,
        symbol: symbol,
        formattedAmount: ethers.formatUnits(balanceWei, decimals)
      };
    } catch (error) {
      console.error(`[MockedWalletAdapter] Error getting balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Verifies the correctness of a signature for a given message.
   *
   * @param message - The message to verify the signature against.
   * @param signature - The signature to verify.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the signature is valid, otherwise `false`.
   */
  async verifySignature(message: string | Uint8Array, signature: string, address: string): Promise<boolean> {
    if (!address) {
      throw new Error("Address parameter is required for verification.");
    }
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const result = recoveredAddress.toLowerCase() === address.toLowerCase();
      console.log(`[MockedWalletAdapter] Signature verification result for ${address}: ${result}`);
      return result;
    } catch (error) {
      console.error("[MockedWalletAdapter] Signature verification failed:", error);
      return false; // Return false on error
    }
  }

  private emitEvent(eventName: WalletEvent | string, payload: any): void {
    console.log(`[MockedWalletAdapter] Emitting ${eventName} event with:`, payload);
    const listeners = this.eventListeners.get(eventName);
    listeners?.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[MockedWalletAdapter] Error in ${eventName} event handler:`, error);
      }
    });
  }

  /**
   * Registers an event listener for the specified event.
   *
   * @param event - The event to listen for.
   * @param callback - The callback function to be invoked when the event is triggered.
   */
  on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    console.log(`[MockedWalletAdapter] Listener added for ${event}`);
  }

  /**
   * Removes a previously registered event listener for the specified event.
   *
   * @param event - The event for which the listener should be removed.
   * @param callback - The callback function that was registered as the listener.
   */
  off(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      console.log(`[MockedWalletAdapter] Listener removed for ${event}`);
    }
  }



  /** Network Management */
  /**
   * Retrieves the network information from the provider.
   * 
   * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
   * @throws If the provider is not set.
   */
  async getNetwork(): Promise<{ chainId: string | number; name?: string }> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("MockedWalletAdapter not connected to a provider.");
    }
    try {
      const network = await this.provider.getNetwork();
      // Ethers v6 Network object has bigint chainId
      return { chainId: network.chainId.toString(), name: network.name };
    } catch (error) {
      console.error("[MockedWalletAdapter] Error getting network:", error);
      throw error;
    }
  }

  /**
  * Sets the provider for the wallet and connects the wallet to the new provider if it exists.
  *
  * @param provider - The provider to set for the wallet.
  */
  async setProvider(config: ProviderConfig): Promise<void> {
    if (!this.initialized || !this.wallet) {
      throw new Error("MockedWalletAdapter must be initialized before setting provider.");
    }
    console.log("[MockedWalletAdapter] Setting provider with config:", config);

    if (!config.chainId) {
      throw new Error("chainId is required in ProviderConfig");
    }
    if (!config.rpcUrl || !(config.rpcUrl.startsWith('http://') || config.rpcUrl.startsWith('https://'))) {
      throw new Error("A valid HTTP/HTTPS rpcUrl is required in ProviderConfig");
    }

    const oldChainId = this.provider ? (await this.getNetwork()).chainId : null;

    try {
      // Create and connect provider
      const newProvider = new JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true });
      // Quick check to ensure provider is working
      const network = await newProvider.getNetwork();

      // Convert both chainIds for comparison
      const networkChainIdStr = network.chainId.toString();
      const configChainIdStr = config.chainId!.toString();
      const configChainIdHex = configChainIdStr.startsWith('0x') ? configChainIdStr : `0x${parseInt(configChainIdStr).toString(16)}`;
      const configChainIdDec = configChainIdStr.startsWith('0x') ? parseInt(configChainIdStr, 16).toString() : configChainIdStr;

      if (networkChainIdStr !== configChainIdHex && networkChainIdStr !== configChainIdDec) {
        throw new Error(`Provider connected to wrong chainId (${networkChainIdStr}), expected ${config.chainId}`);
      }

      this.provider = newProvider;
      this.currentTicker = config.ticker || 'ETH'; // Update ticker
      this.wallet = this.wallet.connect(this.provider); // Connect wallet instance

      console.log(`[MockedWalletAdapter] Successfully connected to provider for chain ${network.chainId}`);
      this.emitEvent(WalletEvent.connect, { chainId: network.chainId.toString() });

      // Emit chainChanged if the chainId actually changed
      const newChainId = network.chainId.toString();
      if (oldChainId !== null && oldChainId.toString() !== newChainId) {
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      } else if (oldChainId === null) {
        // Emit chainChanged if it's the first connection
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      }

    } catch (error) {
      console.error("[MockedWalletAdapter] Failed to set provider:", error);
      this.provider = undefined; // Ensure provider is unset on failure
      if (this.wallet) this.wallet = this.wallet.connect(null);
      this.currentTicker = 'ETH'; // Reset ticker
      this.emitEvent(WalletEvent.disconnect, null); // Emit disconnect on failure
      throw error; // Re-throw
    }
  }

  /** Transactions & Signing */
  async sendTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.isConnected() || !this.wallet) {
      throw new Error("MockedWalletAdapter not connected.");
    }
    console.log("[MockedWalletAdapter] Sending transaction:", tx);
    try {
      // Prepare transaction like EvmWalletAdapter
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        // Convert value string (ETH) to Wei bigint
        value: (typeof tx.value === 'string' && tx.value.includes('.')) ? ethers.parseEther(tx.value) : tx.value,
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        nonce: tx.options?.nonce ?? await this.wallet.getNonce(),
        gasLimit: tx.options?.gasLimit, // Use gasLimit from options
        gasPrice: tx.options?.gasPrice, // Use gasPrice from options
        maxFeePerGas: tx.options?.maxFeePerGas, // Use maxFeePerGas from options
        maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas, 
        chainId: tx.options?.chainId ?? (await this.getNetwork()).chainId,
      };

      // Warn if essential gas parameters are missing
      if (txRequest.gasLimit === undefined) {
        console.warn("[MockedWalletAdapter] Missing 'gasLimit' in transaction options. Transaction might fail.");
      }

      if (txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined) {
        console.warn("[MockedWalletAdapter] Missing 'gasPrice' or 'maxFeePerGas'/'maxPriorityFeePerGas' in transaction options. Transaction might fail.");
      }

      Object.keys(txRequest).forEach(key => txRequest[key as keyof ethers.TransactionRequest] === undefined && delete txRequest[key as keyof ethers.TransactionRequest]);

      const response: TransactionResponse = await this.wallet.sendTransaction(txRequest);
      console.log(`[MockedWalletAdapter] Transaction sent with hash: ${response.hash}`);
      return response.hash;
    } catch (error) {
      console.error("[MockedWalletAdapter] Send transaction failed:", error);
      throw error;
    }
  }

  async signTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("MockedWalletAdapter not initialized.");
    }
    console.log("[MockedWalletAdapter] Signing transaction:", tx);
    try {
      // Prepare transaction request (similar to sendTransaction but without sending)
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        // Convert value string (ETH) to Wei bigint
        value: (typeof tx.value === 'string' && tx.value.includes('.')) ? ethers.parseEther(tx.value) : tx.value,
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        nonce: tx.options?.nonce ?? (this.provider ? await this.wallet.getNonce() : 0), // Use nonce if connected, else 0
        gasLimit: tx.options?.gasLimit, // Use gasLimit from options
        gasPrice: tx.options?.gasPrice, // Use gasPrice from options
        maxFeePerGas: tx.options?.maxFeePerGas, // Use maxFeePerGas from options
        maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas,
        chainId: tx.options?.chainId ?? (this.provider ? (await this.getNetwork()).chainId : undefined), // Use chainId if connected
      };

      // Warn if essential gas parameters are missing
      if (txRequest.gasLimit === undefined) {
        console.warn("[MockedWalletAdapter] Missing 'gasLimit' in transaction options for signing. Transaction might be invalid.");
      }
      if (txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined) {
        console.warn("[MockedWalletAdapter] Missing 'gasPrice' or 'maxFeePerGas'/'maxPriorityFeePerGas' in transaction options for signing. Transaction might be invalid.");
      }
      if (txRequest.nonce === undefined) {
        console.warn("[MockedWalletAdapter] Missing 'nonce' in transaction options for signing (and provider not connected to fetch). Transaction might be invalid.");
      }

      // Remove undefined fields
      Object.keys(txRequest).forEach(key => txRequest[key as keyof ethers.TransactionRequest] === undefined && delete txRequest[key as keyof ethers.TransactionRequest]);

      const signedTx = await this.wallet.signTransaction(txRequest);
      console.log("[MockedWalletAdapter] Transaction signed.");
      return signedTx;
    } catch (error) {
      console.error("[MockedWalletAdapter] Sign transaction failed:", error);
      throw error;
    }
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("MockedWalletAdapter not initialized.");
    }
    console.log("[MockedWalletAdapter] Signing message:", message);
    try {
      const signature = await this.wallet.signMessage(message);
      console.log("[MockedWalletAdapter] Message signed.");
      return signature;
    } catch (error) {
      console.error("[MockedWalletAdapter] Sign message failed:", error);
      throw error;
    }
  }
  
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not available to get transaction receipt.");
    }
    try {
      console.log(`[MockedWalletAdapter] Getting receipt for tx: ${txHash}`);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      console.log(`[MockedWalletAdapter] Receipt status for ${txHash}: ${receipt ? receipt.status : 'null'}`);
      return receipt;
    } catch (error) {
      console.error(`[MockedWalletAdapter] Failed to get receipt for ${txHash}:`, error);
      throw error;
    }
  }

  async signTypedData(data: EIP712TypedData): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("MockedWalletAdapter not initialized.");
    }
    console.log("[MockedWalletAdapter] Signing typed data:", data);
    try {
      // Ethers v6 requires domain and types separately
      const { domain, types, value } = data;
      // Remove EIP712Domain type from types for ethers.js
      const { EIP712Domain, ...restTypes } = types;
      const signature = await this.wallet.signTypedData(domain, restTypes, value);
      console.log("[MockedWalletAdapter] Typed data signed.");
      return signature;
    } catch (error) {
      console.error("[MockedWalletAdapter] Sign typed data failed:", error);
      throw error;
    }
  }
  
   async estimateGas(tx: GenericTransactionData): Promise<bigint> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not available to estimate gas.");
    }
    try {
      const txForEstimate: ethers.TransactionRequest = {
        to: tx.to,
        from: this.wallet!.address,
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        value:  tx.value,
        ...(tx.options || {}) // Include options, but remove gas/nonce fields below
      };
      
      delete txForEstimate.nonce;
      delete txForEstimate.gasPrice;
      delete txForEstimate.maxFeePerGas;
      delete txForEstimate.maxPriorityFeePerGas;
      delete txForEstimate.gasLimit;

      console.log("[MockedWalletAdapter] Estimating gas for:", txForEstimate);
      const estimate = await this.provider.estimateGas(txForEstimate);
      console.log(`[MockedWalletAdapter] Gas estimate: ${estimate.toString()}`);
      return estimate;
    } catch (error) {
      console.error("[MockedWalletAdapter] Estimate gas failed:", error);
      throw error;
    }
  }

}