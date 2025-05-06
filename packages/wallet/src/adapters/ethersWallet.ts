import { ethers, Provider, Wallet as EthersWallet, JsonRpcProvider, TransactionResponse } from "ethers";
import { TransactionReceipt } from "ethers";
import { AssetBalance, GenericTransactionData, IWalletOptions, ProviderConfig, WalletEvent, EIP712TypedData, IEVMWallet } from "@m3s/common";

// Define always the constructor arguments in a type.
interface args extends IWalletOptions {
  adapterName: 'ethers';
  options?: {
    privateKey?: string;
  };
  provider?: { // Assuming provider config comes in this shape from createWallet
    rpcTarget: string;
    [key: string]: any; // Allow other properties
  };
}


export class EvmWalletAdapter implements IEVMWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();
  private readonly name: string;

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
  private constructor(args: args) {
    // console.debug("Creating EvmWalletAdapter with args:", args);

    if (!args.options || !args.options.privateKey) {
      throw new Error("Private key is required in options for EvmWalletAdapter");
    }

    if (args.options?.privateKey && args.options.privateKey.startsWith('0x')) {
      this.privateKey = args.options.privateKey;
      // console.debug("EvmWalletAdapter: Using provided private key.");
    } else {
      const randomWallet = ethers.Wallet.createRandom();
      this.privateKey = randomWallet.privateKey;
      // console.debug("EvmWalletAdapter: No valid private key provided, generated a new random wallet.");
    }

    this.name = args.adapterName; // Store the adapter name

    // Handle initial provider if provided in args
    if (args.provider) {
      if (args.provider instanceof JsonRpcProvider) {
        this.provider = args.provider;
        // console.debug("EvmWalletAdapter: Initial provider instance provided.");
      } else if (typeof args.provider === 'object' && args.provider.rpcUrl) {
        // console.debug("EvmWalletAdapter: Initial provider configuration provided. Creating provider instance.");
        this.provider = new JsonRpcProvider(args.provider.rpcUrl);
      } else {
        console.warn("EvmWalletAdapter: Invalid initial provider configuration provided.");
      }
    } else {
      // console.debug("EvmWalletAdapter: No initial provider configuration provided.");
    }
    // console.debug("EvmWalletAdapter created.");
  }

  /**
   * Creates a new instance of EvmWalletAdapter.
   *
   * @param {args} args - The arguments required to create the EvmWalletAdapter instance.
   * @returns {Promise<EvmWalletAdapter>} A promise that resolves to the newly created EvmWalletAdapter instance.
   */
  static async create(args: args): Promise<EvmWalletAdapter> {
    // console.debug("Creating EvmWalletAdapter with args:", args);
    // Validate adapterName if necessary
    // if (args.adapterName !== 'ethers') {
    //   console.warn(`EvmWalletAdapter created with unexpected adapterName: 
    //     ${JSON.stringify(args, null, 2)}`);
    // }
    const adapter = new EvmWalletAdapter(args);
    return adapter;
  }

  /**
   * Initializes the wallet instance if it has not been initialized yet.
   * 
   * This method sets up the wallet using the provided private key and connects it to the provider if available.
   * It ensures that the wallet is only initialized once.
   * 
   * @returns {Promise<void>} A promise that resolves when the initialization is complete.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      // console.debug("EvmWalletAdapter already initialized.");
      return;
    }

    try {
      this.wallet = new EthersWallet(this.privateKey);
      if (this.provider) {
        this.wallet = this.wallet.connect(this.provider);
        // console.debug("EvmWalletAdapter: Wallet connected to provider during initialization.");
      } else {
        // console.debug("EvmWalletAdapter: Wallet initialized without provider.");
      }
      this.initialized = true;
      // console.debug("EvmWalletAdapter initialized successfully.");
    } catch (error) {
      console.error("EvmWalletAdapter initialization failed:", error);
      this.initialized = false; // Ensure state reflects failure
      throw error; // Re-throw the error
    }
  }

  /**
   * Checks if the wallet has been initialized.
   *
   * @returns {boolean} True if the wallet is initialized, otherwise false.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Disconnects the wallet by clearing the provider and wallet instance.
   * This method does not clean up event listeners or other resources.
   */
  disconnect(): void {
    // console.debug("EvmWalletAdapter disconnecting...");
    this.provider = undefined;
    // Ensure wallet is disconnected from provider if it exists
    if (this.wallet) {
      this.wallet = this.wallet.connect(null);
    }
    // Keep private key, reset initialized state
    this.initialized = false; // Mark as not initialized
    this.eventListeners.clear(); // Clear event listeners
    // console.debug("EvmWalletAdapter disconnected.");
    this.emitEvent(WalletEvent.disconnect, null); // Emit disconnect event
  }

  /** Wallet Metadata */

  /**
   * Retrieves the name of the wallet adapter.
   *
   * @returns {string} The name of the wallet adapter.
   */
  getWalletName(): string {
    return this.name; // Return the stored name
  }

  /**
   * Retrieves the version of the wallet.
   *
   * @returns {string} The version of the wallet as a string.
   */
  getWalletVersion(): string {
    // Potentially use ethers version?
    return ethers.version;
  }

  /**
   * Checks if the wallet is connected to a provider.
   *
   * @returns {boolean} `true` if the wallet is connected to a provider, otherwise `false`.
   */
  isConnected(): boolean {
    const connected = !!this.wallet && !!this.provider && this.initialized;
    return connected;
  }

  /** Account Management */

  /**
   * Requests the list of accounts associated with the wallet.
   * 
   * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
   * 
   * @emits WalletEvent.accountsChanged - Emitted when accounts are requested.
   */
  async requestAccounts(): Promise<string[]> {
    if (!this.initialized || !this.wallet) {
      throw new Error("Wallet not initialized. Call initialize() first.");
    }
    const accounts = [this.wallet.address];
    this.emitEvent(WalletEvent.accountsChanged, accounts);
    return accounts;
  }

  /**
   * Retrieves the list of accounts associated with the wallet.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
   */
  async getAccounts(): Promise<string[]> {
    if (!this.wallet) {
      console.error("[EvmWalletAdapter:getAccounts] FAILED: this.wallet is not set.");
      return [];
    }
    if (!this.provider) {
      console.warn("[EvmWalletAdapter:getAccounts] WARNING: this.provider is not set (needed for isConnected).");
      // Depending on strictness, you might return [] here, but let's see if getAddress works without provider check
    }
    if (!this.initialized) {
      console.error("[EvmWalletAdapter:getAccounts] FAILED: Adapter not initialized.");
      return [];
    }

    try {
      console.log("[EvmWalletAdapter:getAccounts] Attempting: await this.wallet.getAddress()");
      const address = await this.wallet.getAddress();
      console.log("[EvmWalletAdapter:getAccounts] SUCCESS: Retrieved address:", address);
      return [address];
    } catch (error) {
      console.error("[EvmWalletAdapter:getAccounts] ERROR calling this.wallet.getAddress():", error);
      return [];
    }

  }

  /**
   * Retrieves the balance of the specified account.
   *
   * @param {string} [account] - The account address to retrieve the balance for. Defaults to the wallet's address.
   * @returns {Promise<string>} A promise that resolves to the balance as a string.
   */
  async getBalance(account?: string): Promise<AssetBalance> {
    if (!this.isConnected() || !this.provider) { // Check isConnected which implies initialized and provider
      throw new Error("Provider not set or wallet not connected.");
    }
    const address = account || (await this.getAccounts())[0]; // Ensure getAccounts is awaited
    if (!address) {
      throw new Error("No account available to fetch balance.");
    }
    try {
      const balanceWei = await this.provider.getBalance(address);
      const network = await this.provider.getNetwork(); // <<< Get network info
      const networkWithCurrency = network as ethers.Network & { nativeCurrency?: { decimals: number; symbol: string } };
      const decimals = networkWithCurrency.nativeCurrency?.decimals ?? 18;
      const symbol = networkWithCurrency.nativeCurrency?.symbol ?? 'ETH';

      return {
        amount: balanceWei.toString(),
        decimals: decimals,
        symbol: symbol,
        formattedAmount: ethers.formatUnits(balanceWei, decimals)
      };
    } catch (error) {
      console.error(`[EvmWalletAdapter] Error getting balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Verifies a signature against a message and the expected signer address.
   * @param message The message that was signed (string or Uint8Array).
   * @param signature The signature to verify.
   * @param address The expected address of the signer.
   * @returns A promise that resolves to `true` if the signature is valid and matches the address, otherwise `false`.
   */
  async verifySignature(message: string | Uint8Array, signature: string, address: string): Promise<boolean> {
    if (!address) {
      throw new Error("Address parameter is required for verification.");
    }
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const result = recoveredAddress.toLowerCase() === address.toLowerCase();
      // console.debug(`[EvmWalletAdapter] Signature verification result for ${address}: ${result}`);
      return result;
    } catch (error) {
      console.error("[EvmWalletAdapter] Signature verification failed:", error);
      return false; // Return false on error
    }
  }

  /**
   * Emits an event with the specified name and payload
   * @param eventName The name of the event to emit
   * @param payload The payload to pass to the event listeners
   */
  private emitEvent(eventName: WalletEvent | string, payload: any): void {
    // console.debug(`[EvmWalletAdapter] Emitting ${eventName} event with:`, payload);
    const listeners = this.eventListeners.get(eventName);
    listeners?.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[EvmWalletAdapter] Error in ${eventName} event handler:`, error);
      }
    });
  }

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
  on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    // console.debug(`[EvmWalletAdapter] Listener added for ${event}`);
    // Specific logic for provider events like 'network' could be added here if needed
  }

  /**
   * Removes a specific callback function for a given event.
   *
   * @param event - The name of the event to remove the callback from.
   * @param callback - The callback function to be removed.
   */
  off(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      // console.debug(`[EvmWalletAdapter] Listener removed for ${event}`);
    }
  }

  /** Network Management */

  /**
   * Retrieves the network information from the provider.
   *
   * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
   * @throws Will throw an error if the provider is not set.
   */
  async getNetwork(): Promise<{ chainId: string | number; name?: string }> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not set or wallet not connected.");
    }
    try {
      const network = await this.provider.getNetwork();
      // console.debug("[EvmWalletAdapter] getNetwork result:", network);
      const chainId = `0x${network.chainId.toString(16)}`;

      return { chainId, name: network.name }; // Return string chainId
    } catch (error: any) {
      console.error("[EvmWalletAdapter] Error in getNetwork:", error);
      throw new Error("Failed to get network: " + error.message);
    }
  }

  private timeout<T>(ms: number, promise: Promise<T>, urlForError: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout connecting to ${urlForError} after ${ms}ms`));
      }, ms);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Sets the provider for the wallet and reconnects the wallet with the new provider if it is already connected.
   *
   * @param provider - The new provider to set for the wallet.
   */
  async setProvider(config: ProviderConfig): Promise<void> {

    // console.debug('info', "[EvmWalletAdapter] Setting provider with config:", { chainId: config.chainId, name: config.displayName, rpcUrls: config.rpcUrls || [config.rpcUrl] });

    if (!config.chainId) {
      throw new Error("chainId is required in ProviderConfig");
    }

    // Determine the list of RPC URLs to try
    let urlsToTry: string[] = [];
    if (Array.isArray(config.rpcUrls) && config.rpcUrls.length > 0) {
      urlsToTry = config.rpcUrls.filter(url => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
    } else if (typeof config.rpcUrl === 'string' && (config.rpcUrl.startsWith('http://') || config.rpcUrl.startsWith('https://'))) {
      urlsToTry = [config.rpcUrl];
      // console.debug(`[EvmWalletAdapter] Using single rpcUrl: ${config.rpcUrl}`);
    }

    if (urlsToTry.length === 0) {
      throw new Error("No valid HTTP/HTTPS RPC URLs provided in ProviderConfig");
    }

    let connectedProvider: JsonRpcProvider | null = null;
    let connectionError: Error | null = null;
    const oldChainId = this.provider ? (await this.getNetwork()).chainId : null;

    const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds timeout per RPC URL attempt

    for (const url of urlsToTry) {
      // console.debug(`[EvmWalletAdapter] Attempting to connect to RPC: ${url}`);
      try {
        // Define the async connection check logic for this URL
        const checkConnection = async (): Promise<JsonRpcProvider> => {
          // Create provider instance for the current URL
          // staticNetwork: true might slightly speed up checks, keep it for now
          const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
          // Verify connection and chain ID by fetching network details
          const network = await provider.getNetwork(); // This implicitly checks connectivity

          // Convert both chainIds to string for comparison
          const networkChainIdStr = network.chainId.toString();
          const configChainIdStr = config.chainId!.toString();
          const configChainIdHex = configChainIdStr.startsWith('0x') ? configChainIdStr : `0x${parseInt(configChainIdStr).toString(16)}`;
          const configChainIdDec = configChainIdStr.startsWith('0x') ? parseInt(configChainIdStr, 16).toString() : configChainIdStr;

          if (networkChainIdStr !== configChainIdHex && networkChainIdStr !== configChainIdDec) {
            // Throw specific error for chain ID mismatch
            throw new Error(`RPC URL ${url} returned wrong chainId (${networkChainIdStr}), expected ${config.chainId}`);
          }
          // If successful, return the provider instance
          return provider;
        };

        // Race the connection check against the timeout
        connectedProvider = await this.timeout(CONNECTION_TIMEOUT_MS, checkConnection(), url);

        // If timeout didn't reject and checkConnection didn't throw, we are connected
        // console.debug(`[EvmWalletAdapter] Successfully connected to RPC: ${url} with matching chainId`);
        connectionError = null; // Reset error on success
        break; // Exit loop on successful connection

      } catch (error: any) {
        // Log specific errors clearly
        if (error.message.startsWith('Timeout connecting to')) {
          // console.debug(`[EvmWalletAdapter] Timeout connecting to RPC ${url}: ${error.message}`);
        } else if (error.message.includes('returned wrong chainId')) {
          // Log chain ID mismatch from the error thrown in checkConnection
          // console.debug(`[EvmWalletAdapter] Chain ID mismatch for RPC ${url}: ${error.message}`);
        } else {
          // Log other connection errors (like 429, DNS errors, etc.)
          // console.debug(`[EvmWalletAdapter] Failed to connect to RPC ${url}: ${error.message}`);
        }
        connectionError = error; // Store the last error to potentially throw later
        connectedProvider = null; // Ensure provider is null on error
      }
    }

    if (!connectedProvider) {
      console.error("[EvmWalletAdapter] Failed to connect to any provided RPC URL.", connectionError);
      // Disconnect if previously connected
      if (this.provider) {
        this.provider = undefined;
        if (this.wallet) this.wallet = this.wallet.connect(null);
        this.emitEvent(WalletEvent.disconnect, null);
      }
      throw new Error(`Failed to connect to any provided RPC URL. Last error: ${connectionError?.message || 'Unknown connection error'}`);
    }

    // Successfully connected to one of the URLs
    this.provider = connectedProvider;

    // Reconnect wallet if initialized
    if (this.initialized && this.wallet) {
      this.wallet = this.wallet.connect(this.provider);
      // console.debug("[EvmWalletAdapter] Wallet instance reconnected to new provider");
      // FIX: Use WalletEvent.connected
      this.emitEvent(WalletEvent.connect, null);

      // Emit chainChanged if the chainId actually changed
      const newChainId = (await this.provider.getNetwork()).chainId.toString();
      if (oldChainId !== null && oldChainId.toString() !== newChainId) {
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      }
    } else if (!this.initialized) {
      // console.debug("[EvmWalletAdapter] Provider set, wallet will connect during initialize()");
      // Emit chainChanged if it's the very first provider being set
      if (oldChainId === null) {
        const newChainId = (await this.provider.getNetwork()).chainId.toString();
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      }
    }
  }

  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    if (!this.initialized || !this.wallet) {
      throw new Error("Wallet not initialized.");
    }

    // console.debug(`[EvmWalletAdapter:prepare] Received tx.value: ${tx.value} (type: ${typeof tx.value})`);
    let chainIdBigInt: bigint | undefined;
    try {
      // Use provider if available, otherwise rely on options
      chainIdBigInt = tx.options?.chainId ?? (this.provider ? (await this.provider.getNetwork()).chainId : undefined);
    } catch (e) {
      console.warn("[EvmWalletAdapter:prepare] Error getting chainId from provider, relying on options if present.");
      chainIdBigInt = tx.options?.chainId;
    }

    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value, // Assume tx.value is already correct format (bigint wei)
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      chainId: chainIdBigInt, // Use fetched/provided chainId
      nonce: tx.options?.nonce,
      gasLimit: tx.options?.gasLimit,
      gasPrice: tx.options?.gasPrice,
      maxFeePerGas: tx.options?.maxFeePerGas,
      maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas,
    };

    Object.keys(txRequest).forEach(key => txRequest[key as keyof ethers.TransactionRequest] === undefined && delete txRequest[key as keyof ethers.TransactionRequest]);
    // console.debug(`[EvmWalletAdapter:prepare] Returning txRequest.value: ${txRequest.value} (type: ${typeof txRequest.value})`);

    return txRequest;
  }

  /**
   * Sends a transaction using the initialized wallet.
   *
   * @param tx - The transaction object to be sent.
   * @returns A promise that resolves to the transaction hash as a string.
   * @throws Will throw an error if the wallet, provider, or initialization is not properly set up.
   */
  async sendTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.isConnected() || !this.wallet) {
      throw new Error("EvmWalletAdapter not connected or initialized.");
    }
    try {
      // console.debug(`[EvmWalletAdapter:sendTransaction] Received tx.value: ${tx.value} (type: ${typeof tx.value})`);

      const txRequest = await this.prepareTransactionRequest(tx);
      // <<< START ADD LOGGING >>>
      // console.debug(`[EvmWalletAdapter] Prepared Tx Request for sendTransaction:`, {
      //   to: txRequest.to,
      //   value: txRequest.value?.toString(),
      //   data: txRequest.data,
      //   nonce: txRequest.nonce,
      //   gasLimit: txRequest.gasLimit?.toString(),
      //   gasPrice: txRequest.gasPrice?.toString(), // Log legacy gasPrice if present
      //   maxFeePerGas: txRequest.maxFeePerGas?.toString(),
      //   maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas?.toString(),
      //   chainId: txRequest.chainId?.toString(),
      // });
      // console.debug(`[EvmWalletAdapter:sendTransaction] Sending with txRequest.value: ${txRequest.value} (type: ${typeof txRequest.value})`);

      // console.debug(`[EvmWalletAdapter] Sending transaction via ethers signer...`);
      const response: TransactionResponse = await this.wallet.sendTransaction(txRequest); // <<< Ethers handles nonce if txRequest.nonce is undefined
      // console.debug(`[EvmWalletAdapter] Transaction sent response hash: ${response.hash}`);

      return response.hash;
    } catch (error: any) {
      console.error("[EvmWalletAdapter] Send transaction error:", error);
      if (error.info?.error) {
        console.error("[EvmWalletAdapter] Provider error details:", error.info.error);
      }
      throw error;
    }
  }

  /**
   * Signs a transaction using the wallet.
   *
   * @param tx - The transaction object to be signed.
   * @returns A promise that resolves to the signed transaction as a string.
   * @throws Will throw an error if the wallet is not initialized, the provider is not set, or the wallet is not available.
   */
  async signTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("Wallet not initialized.");
    }
    try {
      // prepareTransactionRequest populates necessary fields like nonce/gas if possible
      const txRequest = await this.prepareTransactionRequest(tx);
      // console.debug("[EvmWalletAdapter] Signing transaction:", txRequest);
      return await this.wallet.signTransaction(txRequest);
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign transaction failed:", error);
      throw error;
    }
  }

  /**
   * Signs a given message using the wallet.
   *
   * @param message - The message to be signed.
   * @returns A promise that resolves to the signed message as a string.
   * @throws Will throw an error if the wallet is not initialized.
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("Wallet not initialized.");
    }
    try {
      // console.debug("[EvmWalletAdapter] Signing message...");
      const signature = await this.wallet.signMessage(message);
      // console.debug("[EvmWalletAdapter] Message signed.");
      return signature;
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign message failed:", error);
      throw error;
    }
  }


  /** EVM-Specific Features */

  /**
   * Signs typed data using the wallet.
   *
   * @param data - The data to be signed, including the domain, types, and value.
   * @param version - (Optional) The version of the signing method to use.
   * @returns A promise that resolves to the signed data as a string.
   * @throws Will throw an error if the wallet is not initialized.
   */
  async signTypedData(data: EIP712TypedData): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new Error("Wallet not initialized.");
    }
    try {
      // console.debug("[EvmWalletAdapter] Signing typed data:", data);
      // ethers v6 signTypedData takes domain, types, and the primary message object (named 'message' in our type)
      const signature = await this.wallet.signTypedData(data.domain, data.types, data.value);
      // console.debug("[EvmWalletAdapter] Typed data signed.");
      return signature;
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign typed data failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves the current gas price from the provider.
   *
   * @returns {Promise<string>} A promise that resolves to the gas price as a string.
   * @throws {Error} If the gas price is not available.
   */
  async getGasPrice(): Promise<bigint> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not set or wallet not connected.");
    }
    try {
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) {
        throw new Error("gasPrice not available from provider.");
      }
      return feeData.gasPrice;
    } catch (error) {
      console.error("[EvmWalletAdapter] Get gas price failed:", error);
      throw error;
    }
  }

  /**
   * Estimates the gas required for a given transaction.
   *
   * @param tx - The transaction data containing the recipient address, value, and optional data.
   * @returns A promise that resolves to the estimated gas as a string.
   */
  async estimateGas(tx: GenericTransactionData): Promise<bigint> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not set or wallet not connected.");
    }

    // console.debug(`[EvmWalletAdapter:estimateGas] Received tx.value: ${tx.value} (type: ${typeof tx.value})`);

    try {
      // Use prepareTransactionRequest to build a structure suitable for estimateGas,
      // but exclude fields that might cause issues (like nonce if we want provider's estimate)
      const txForEstimate: ethers.TransactionRequest = {
        to: tx.to,
        from: this.wallet.address, // 'from' is often needed
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        value: tx.value,
        ...(tx.options || {})
      };

      // console.debug(`[EvmWalletAdapter:estimateGas] Using txForEstimate.value: ${txForEstimate.value} (type: ${typeof txForEstimate.value})`);

      // Remove fields that estimateGas might not want/need or that we want the provider to determine
      delete txForEstimate.nonce;
      delete txForEstimate.gasPrice;
      delete txForEstimate.maxFeePerGas;
      delete txForEstimate.maxPriorityFeePerGas;
      delete txForEstimate.gasLimit; // Remove gasLimit to get an estimate

      // console.debug("[EvmWalletAdapter] Estimating gas for:", txForEstimate);
      const estimate = await this.provider.estimateGas(txForEstimate);
      // console.debug(`[EvmWalletAdapter] Gas estimate: ${estimate.toString()}`);
      return estimate;
    } catch (error) {
      console.error("[EvmWalletAdapter] Estimate gas failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves the transaction receipt for a given transaction hash.
   *
   * @param txHash - The hash of the transaction to retrieve the receipt for.
   * @returns A promise that resolves to the transaction receipt.
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not set or wallet not connected.");
    }
    try {
      // console.debug(`[EvmWalletAdapter] Getting receipt for tx: ${txHash}`);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      // console.debug(`[EvmWalletAdapter] Receipt result:`, receipt);
      return receipt; // Can be null
    } catch (error) {
      console.error(`[EvmWalletAdapter] Get transaction receipt error for ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves the token balance for a given token address and account.
   *
   * @param tokenAddress - The address of the token contract.
   * @param account - The account address to retrieve the balance for. Defaults to the wallet's address.
   * @returns A promise that resolves to the token balance as a string.
   */
  async getTokenBalance(tokenAddress: string, account?: string): Promise<string> {
    if (!this.isConnected() || !this.provider) {
      throw new Error("Provider not set or wallet not connected.");
    }
    const targetAccount = account || this.wallet.address;

    // Minimal ABI for balanceOf
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

    try {
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      // console.debug(`[EvmWalletAdapter] Getting token balance for ${tokenAddress} on account ${targetAccount}`);
      const balance = await tokenContract.balanceOf(targetAccount);
      // console.debug(`[EvmWalletAdapter] Token balance result: ${balance.toString()}`);
      return balance.toString(); // Return raw balance string
    } catch (error: any) {
      console.error(`[EvmWalletAdapter] Get token balance error for ${tokenAddress}:`, error);
      throw new Error(`Failed to get token balance: ${error.message || error}`);
    }
  }

}