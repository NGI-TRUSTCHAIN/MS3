import { ethers, Provider, Wallet as EthersWallet, JsonRpcProvider, TransactionResponse, isHexString } from "ethers";
import { TransactionReceipt } from "ethers";
import { WalletEvent, IEVMWallet, AssetBalance, GenericTransactionData, EIP712TypedData, EstimatedFeeData } from "../types/index.js";
import { AdapterArguments, AdapterError, NetworkConfig, WalletErrorCode } from "@m3s/common";

/**
 * Specific options for EVM-based wallet adapters.
 */
export interface IEthersWalletOptionsV1  {
  privateKey?: string;
  provider?: any;
}

interface args extends AdapterArguments<IEthersWalletOptionsV1 > { }

export class EvmWalletAdapter implements IEVMWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private _connected: boolean = false; // Explicit connection state flag
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();
  private readonly adapterName: string = "ethers"

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
    this.adapterName = args.adapterName; // Store the adapter name first

    // Check if a private key string was actually provided and is not empty
    if (args.options?.privateKey && typeof args.options.privateKey === 'string' && args.options.privateKey.trim() !== '') {
      // A private key string was provided. Now validate its format.
      // ethers.isHexString(value, length) checks if it's a hex string of a specific byte length.
      // A 32-byte private key is a 64-character hex string, plus '0x'.
      if (isHexString(args.options.privateKey, 32)) {
        // The key was provided and the format was correct, we use it.
        this.privateKey = args.options.privateKey;
        // console.debug("[EvmWalletAdapter] Using provided valid private key.");
      } else {
        // The provided private key is invalid.
        // console.error('[EvmWalletAdapter] Invalid private key format provided.');
        throw new AdapterError("Invalid private key format provided. Must be a 0x-prefixed 64-character hex string.", {
          code: WalletErrorCode.InvalidInput,
          methodName: 'constructor',
          details: { optionPath: 'options.privateKey', reason: 'Invalid format. Expected a 0x-prefixed 64-character hexadecimal string.' }
        });
      }
    } else {
      // No private key was provided (it's undefined, null, or an empty/whitespace string).
      // Generate a random one internally. This key will not be retrievable by the user from the adapter.
      console.warn('[EvmWalletAdapter] No private key provided in options, or it was empty. Generating a random one internally.');
      const randomWallet = ethers.Wallet.createRandom();
      this.privateKey = randomWallet.privateKey;
      // console.debug(`[EvmWalletAdapter] Generated new random wallet internally. Address: ${randomWallet.address}`);
    }

    // Handle initial provider if provided in args.options.provider
    // This part of the logic for provider setup remains the same as your existing code.
    if (args.options?.provider) { // Check if args.options itself exists
      if (args.options.provider instanceof JsonRpcProvider) {
        this.provider = args.options.provider;
        // console.debug("EvmWalletAdapter: Using provided ethers Provider instance from options.provider.");
      } else if (typeof args.options.provider === 'object' && (args.options.provider as NetworkConfig).rpcUrls?.[0]) {
        // Attempt to create a provider from NetworkConfig-like object if rpcUrls is present
        const netConfig = args.options.provider as NetworkConfig; // Cast for clarity
        try {
          this.provider = new JsonRpcProvider(netConfig.rpcUrls[0]);
          // console.debug(`EvmWalletAdapter: Created JsonRpcProvider from options.provider.rpcUrls[0]: ${netConfig.rpcUrls[0]}`);
        } catch (e) {
          console.warn(`[EvmWalletAdapter] Failed to create JsonRpcProvider from options.provider.rpcUrls. Ensure it's a valid RPC URL. Error: ${(e as Error).message}`);
          this.provider = undefined; // Ensure provider is undefined if creation fails
        }
      } else if (typeof args.options.provider === 'object' && (args.options.provider as any).rpcUrl && typeof (args.options.provider as any).rpcUrl === 'string') {
        // Fallback for a simple object with just rpcUrl, like your original code had
        // console.debug("EvmWalletAdapter: Initial provider configuration (rpcUrl string) provided. Creating provider instance.");
        try {
          this.provider = new JsonRpcProvider((args.options.provider as any).rpcUrl);
        } catch (e) {
          console.warn(`[EvmWalletAdapter] Failed to create JsonRpcProvider from options.provider.rpcUrl string. Ensure it's a valid RPC URL. Error: ${(e as Error).message}`);
          this.provider = undefined;
        }
      }
      else {
        console.warn("EvmWalletAdapter: options.provider was provided but is not a recognized ethers Provider instance, a valid NetworkConfig with rpcUrls, or an object with an rpcUrl string. Provider not set.");
        this.provider = undefined; // Ensure provider is undefined if not valid
      }
    } else {
      // console.debug("EvmWalletAdapter: No initial provider configuration provided in options.provider.");
      this.provider = undefined; // Explicitly set to undefined if no provider option
    }
    // console.debug("EvmWalletAdapter constructor finished.");
  }


  /**
   * Creates a new instance of EvmWalletAdapter.
   *
   * @param {args} args - The arguments required to create the EvmWalletAdapter instance.
   * @returns {Promise<EvmWalletAdapter>} A promise that resolves to the newly created EvmWalletAdapter instance.
   */
  static async create(args: args): Promise<EvmWalletAdapter> {
    const adapter = new EvmWalletAdapter(args);
    await adapter.initialize();
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
      // console.debug("[EvmWalletAdapter Initialize] Wallet instantiated with private key.");

      // If a provider was set up in the constructor from options.provider (string RPC URL)
      if (this.provider) {
        // console.debug("[EvmWalletAdapter Initialize] Provider was pre-configured, attempting to connect wallet.");
        try {
          // Attempt to get network to confirm provider is valid before connecting wallet
          await this.provider.getNetwork();
          this.wallet = this.wallet.connect(this.provider);
          this._connected = true;
          // console.debug("[EvmWalletAdapter Initialize] Wallet connected to pre-configured provider.");
        } catch (e: any) {
          console.warn(`[EvmWalletAdapter Initialize] Pre-configured provider failed connection test: ${e.message}. Wallet will be initialized without provider.`);
          this.provider = undefined; // Clear invalid provider
          this._connected = false;
        }
      } else {
        this._connected = false; // No provider, so not connected
        // console.debug("EvmWalletAdapter: Wallet initialized without provider. Use setProvider() to connect.");
      }
      this.initialized = true;
      // console.debug("EvmWalletAdapter initialized successfully.");
    } catch (error: any) {
      console.error("EvmWalletAdapter initialization failed:", error);
      this.initialized = false;
      this._connected = false;
      throw new AdapterError("EvmWalletAdapter initialization failed", {
        cause: error,
        code: WalletErrorCode.InitializationFailed,
        methodName: 'initialize'
      });
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
    if (this.wallet) {
      this.wallet = this.wallet.connect(null);
    }
    this.initialized = false;
    this._connected = false; // Explicitly set connected to false
    this.eventListeners.clear();
    // console.debug("EvmWalletAdapter disconnected.");
    this.emitEvent(WalletEvent.disconnect, null);
  }

  /** Wallet Metadata */

  /**
   * Retrieves the name of the wallet adapter.
   *
   * @returns {string} The name of the wallet adapter.
   */
  getWalletName(): string {
    return this.adapterName; // Return the stored name
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
    // Relies on the explicitly managed _connected flag, plus provider existence, initialization,
    // and the wallet instance itself having an associated provider.
    const connected =
      this._connected &&         // Adapter believes it's connected
      !!this.provider &&         // Adapter has a provider instance
      this.initialized &&        // Adapter has been initialized
      !!this.wallet &&           // Adapter has a wallet instance
      !!this.wallet.provider;    // The ethers.js Wallet instance is connected to a provider

    console.debug(`[EvmWalletAdapter] isConnected: _connected=${this._connected}, provider=${!!this.provider}, initialized=${this.initialized}, wallet=${!!this.wallet}, wallet.provider=${!!this.wallet?.provider} -> ${connected}`);
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
      throw new AdapterError("Wallet not initialized. Call initialize() first.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'requestAccounts'
      });
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
      throw new AdapterError("Wallet instance not available.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'getAccounts',
        details: { message: "this.wallet is not set." }
      });
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
      const address = await this.wallet.getAddress();
      return [address];
    } catch (error) {
      console.error("[EvmWalletAdapter:getAccounts] ERROR calling this.wallet.getAddress():", error);
      throw new AdapterError("Failed to get wallet address.", {
        cause: error,
        code: WalletErrorCode.AccountUnavailable,
        methodName: 'getAccounts'
      });
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
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getBalance'
      });
    }
    const address = account || (await this.getAccounts())[0]; // Ensure getAccounts is awaited
    if (!address) {
      throw new AdapterError("No account available to fetch balance.", {
        code: WalletErrorCode.AccountUnavailable,
        methodName: 'getBalance'
      });
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
      throw new AdapterError(`Failed to get balance for ${address}: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError, // Or a more specific balance error if defined
        methodName: 'getBalance'
      });
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
      throw new AdapterError("Address parameter is required for verification.", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'verifySignature',
        details: { parameter: 'address' }
      });
    }
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const result = recoveredAddress.toLowerCase() === address.toLowerCase();
      // console.debug(`[EvmWalletAdapter] Signature verification result for ${address}: ${result}`);
      return result;
    } catch (error) {
      console.error("[EvmWalletAdapter] Signature verification failed:", error);
      throw new AdapterError("Signature verification failed.", {
        cause: error,
        code: WalletErrorCode.SignatureFailed,
        methodName: 'verifySignature'
      });
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
   * ```
   */
  on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
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
    }
  }

  /** Network Management */

  /**
    * Retrieves the network information from the provider.
    *
    * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
    * @throws Will throw an error if the provider is not set or wallet is not truly connected.
    */
  async getNetwork(): Promise<{ chainId: string | number; name?: string }> {

    if (!this.isConnected() || !this.provider) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getNetwork'
      });
    }

    try {
      const network = await this.provider.getNetwork();
      const chainId = `0x${network.chainId.toString(16)}`;
      return { chainId, name: network.name };
    } catch (error: any) {
      console.error("[EvmWalletAdapter] Error in getNetwork:", error);
      throw new AdapterError("Failed to get network information: " + (error as Error).message, {
        cause: error,
        code: WalletErrorCode.NetworkError,
        methodName: 'getNetwork'
      });
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
  async setProvider(config: NetworkConfig): Promise<void> {
    if (!config.chainId) {
      throw new AdapterError("chainId is required in NetworkConfig", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'setProvider',
        details: { parameter: 'config.chainId', reason: 'ChainId is mandatory.' }
      });
    }

    let urlsToTry: string[] = [];
    if (Array.isArray(config.rpcUrls) && config.rpcUrls.length > 0) {
      urlsToTry = config.rpcUrls.filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));
    }

    if (urlsToTry.length === 0) {
      this._connected = false; // Ensure disconnected state
      this.provider = undefined;
      throw new AdapterError("No valid HTTP/HTTPS RPC URLs provided in NetworkConfig for the new network", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'setProvider',
        details: { parameter: 'config.rpcUrls', reason: 'At least one valid HTTP/HTTPS RPC URL is required.' }
      });
    }

    const previousProvider = this.provider;
    const previousConnectedState = this._connected;
    let oldChainId: string | number | null = null;

    if (this.isConnected() && this.provider) {
      try {
        const currentNetwork = await this.provider.getNetwork();
        oldChainId = currentNetwork.chainId.toString();
      } catch (e) {
        oldChainId = null;
      }
    }

    // Tentatively set to false/undefined until a new connection is confirmed
    this._connected = false;
    this.provider = undefined;

    let connectedProvider: JsonRpcProvider | null = null;
    let connectionError: Error | null = null;
    const CONNECTION_TIMEOUT_MS = 10000;

    for (const url of urlsToTry) {
      try {
        const checkConnection = async (): Promise<JsonRpcProvider> => {
          const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
          const network = await provider.getNetwork();
          const networkChainIdStr = network.chainId.toString();
          const configChainIdStr = config.chainId!.toString();

          const configChainIdHex = configChainIdStr.startsWith('0x') ? configChainIdStr.toLowerCase() : `0x${parseInt(configChainIdStr, 10).toString(16).toLowerCase()}`;
          const configChainIdDec = configChainIdStr.startsWith('0x') ? parseInt(configChainIdStr, 16).toString() : configChainIdStr;

          if (networkChainIdStr !== configChainIdHex && networkChainIdStr !== configChainIdDec) {
            throw new Error(`RPC URL ${url} returned wrong chainId (${networkChainIdStr}), expected ${config.chainId}`);
          }
          return provider;
        };

        connectedProvider = await this.timeout(CONNECTION_TIMEOUT_MS, checkConnection(), url);
        connectionError = null;
        break;
      } catch (error: any) {
        connectionError = error;
        connectedProvider = null;
      }
    }

    if (!connectedProvider) {
      // Restore previous state since connection to new provider failed
      this.provider = previousProvider;
      this._connected = previousConnectedState;

      // Ensure the ethers.js wallet instance reflects the restored provider state
      if (this.wallet) {
        this.wallet = this.wallet.connect(this.provider as Provider); // Connects to previousProvider or null if previousProvider was null
      }

      console.error("[EvmWalletAdapter] Failed to connect to any provided RPC URL for the new config. Previous state restored if available.", connectionError);
      throw new AdapterError(`Failed to connect to any provided RPC URL. Last error: ${(connectionError as Error)?.message || 'Unknown connection error'}`, {
        code: WalletErrorCode.ConnectionFailed,
        methodName: 'setProvider',
        cause: connectionError
      });
    }

    // If connection to new provider was successful:
    this.provider = connectedProvider;
    this._connected = true;

    if (this.initialized && this.wallet) {
      this.wallet = this.wallet.connect(this.provider);
      this.emitEvent(WalletEvent.connect, null);

      const newNetwork = await this.provider.getNetwork();
      const newChainId = newNetwork.chainId.toString();
      if (oldChainId !== null && oldChainId !== newChainId) {
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      } else if (oldChainId === null && newChainId) {
        this.emitEvent(WalletEvent.chainChanged, newChainId);
      }
    } else if (!this.initialized && this.provider) {
      const newNetwork = await this.provider.getNetwork();
      this.emitEvent(WalletEvent.chainChanged, newNetwork.chainId.toString());
    }
  }

  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    if (!this.initialized || !this.wallet) {
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'prepareTransactionRequest'
      });
    }
    if (!this.provider && (!tx.options?.chainId || !tx.options?.nonce || (!tx.options?.gasPrice && !tx.options?.maxFeePerGas))) {
      // If provider is missing, we can't fetch chainId, nonce, or feeData if not in options.
      // This scenario is less likely if isConnected() is checked before calling, which implies a provider.
      console.warn("[EvmWalletAdapter:prepare] Provider not available. Transaction preparation will rely solely on tx.options.");
    }

    let chainIdBigInt: bigint | undefined;
    if (tx.options?.chainId) {
      chainIdBigInt = BigInt(tx.options.chainId);
    } else if (this.provider) {
      try {
        chainIdBigInt = (await this.provider.getNetwork()).chainId;
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting chainId from provider, relying on options if present.", e);
      }
    }

    let nonce: number | undefined;
    if (tx.options?.nonce !== undefined) {
      nonce = tx.options.nonce;
    } else if (this.wallet) {
      try {
        nonce = await this.wallet.getNonce();
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting nonce from wallet, relying on options if present.", e);
      }
    }

    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value,
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      chainId: chainIdBigInt,
      nonce: nonce,
      gasLimit: tx.options?.gasLimit ? BigInt(tx.options.gasLimit) : undefined,
      gasPrice: tx.options?.gasPrice ? BigInt(tx.options.gasPrice) : undefined,
      maxFeePerGas: tx.options?.maxFeePerGas ? BigInt(tx.options.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? BigInt(tx.options.maxPriorityFeePerGas) : undefined,
      ...(tx.options?.type !== undefined && { type: tx.options.type }),
    };

    // Populate fee data if not provided in options and provider is available
    if (this.provider && txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined) {
      try {
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          txRequest.maxFeePerGas = feeData.maxFeePerGas;
          txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
          // console.debug('[EvmWalletAdapter:prepareTransactionRequest] Using EIP-1559 fees.');
        } else if (feeData.gasPrice) {
          txRequest.gasPrice = feeData.gasPrice;
          // console.debug('[EvmWalletAdapter:prepareTransactionRequest] Using legacy gasPrice.');
        }
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting fee data from provider.", e);
      }
    }

    if (this.provider && txRequest.gasLimit === undefined) {
      try {
        // console.debug('[EvmWalletAdapter:prepareTransactionRequest] gasLimit not provided, attempting to estimate with provider...');
        // Create a temporary request for estimation, ensuring 'from' is set if provider needs it
        const estimateRequest = { ...txRequest };
        if (!estimateRequest.from && this.wallet) {
          estimateRequest.from = this.wallet.address;
        }
        // Remove chainId for estimation if it causes issues with some providers,
        // as estimateGas usually doesn't require it directly.
        // const { chainId: _, ...reqWithoutChainId } = estimateRequest;

        // Ensure 'to' is valid or undefined, not null.
        if (estimateRequest.to === null) delete estimateRequest.to;


        // console.debug('[EvmWalletAdapter:prepareTransactionRequest] Estimating gas with request:', estimateRequest);
        txRequest.gasLimit = await this.provider.estimateGas(estimateRequest as ethers.TransactionRequest); // Cast needed as 'from' might be added
        // console.debug(`[EvmWalletAdapter:prepareTransactionRequest] Estimated gasLimit: ${txRequest.gasLimit}`);
      } catch (gasEstimateError: any) {
        console.warn(`[EvmWalletAdapter:prepareTransactionRequest] Failed to estimate gas with provider: ${gasEstimateError.message}. Transaction might fail if gasLimit is not set manually.`);
        // If estimation fails, txRequest.gasLimit remains undefined, which is acceptable.
        // Ethers will try to estimate again when sending if provider supports it.
      }
    }

    Object.keys(txRequest).forEach(key => (txRequest as any)[key] === undefined && delete (txRequest as any)[key]);

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
      throw new AdapterError("Wallet not connected or signer unavailable.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'sendTransaction'
      });
    }
    try {
      const txRequest = await this.prepareTransactionRequest(tx);
      const response: TransactionResponse = await this.wallet.sendTransaction(txRequest);

      return response.hash;
    } catch (error: any) {
      console.error(`[EvmWalletAdapter] sendTransaction failed:`, error);
      throw new AdapterError(`Failed to send transaction: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.TransactionFailed,
        methodName: 'sendTransaction',
        details: error.info || error.data
      });
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
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'signTransaction'
      });
    }
    try {
      const txRequest = await this.prepareTransactionRequest(tx);
      return await this.wallet.signTransaction(txRequest);
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign transaction failed:", error);
      throw new AdapterError(`Failed to sign transaction: ${(error as Error).message}`, {
        cause: error as Error,
        code: WalletErrorCode.SignatureFailed,
        methodName: 'signTransaction'
      });
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
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'signMessage'
      });
    }
    try {
      // console.debug("[EvmWalletAdapter] Signing message...");
      const signature = await this.wallet.signMessage(message);
      // console.debug("[EvmWalletAdapter] Message signed.");
      return signature;
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign message failed:", error);
      throw new AdapterError(`Failed to sign message: ${(error as Error).message}`, {
        cause: error as Error,
        code: WalletErrorCode.SignatureFailed,
        methodName: 'signMessage'
      });
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
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'signTypedData'
      });
    }
    try {
      // console.debug("[EvmWalletAdapter] Signing typed data:", data);
      // ethers v6 signTypedData takes domain, types, and the primary message object (named 'message' in our type)
      const signature = await this.wallet.signTypedData(data.domain, data.types, data.value);
      // console.debug("[EvmWalletAdapter] Typed data signed.");
      return signature;
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign typed data failed:", error);
      throw new AdapterError(`Failed to sign typed data: ${(error as Error).message}`, {
        cause: error as Error,
        code: WalletErrorCode.SignatureFailed,
        methodName: 'signTypedData'
      });
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
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getGasPrice'
      });
    }
    try {
      const feeData = await this.provider.getFeeData();
      if (feeData.gasPrice) {
        return feeData.gasPrice;
      }
      // Fallback or error if only EIP-1559 fees are available and legacy gasPrice is requested
      throw new AdapterError("Gas price not available from provider (likely EIP-1559 network without legacy gasPrice).", {
        code: WalletErrorCode.NetworkError, // Or a more specific code
        methodName: 'getGasPrice',
        details: { message: "Provider's getFeeData() did not return gasPrice." }
      });
    } catch (error: any) {
      console.error("[EthersWalletAdapter] Get gas price failed:", error);
      throw new AdapterError("Failed to get gas price: " + (error as Error).message, {
        cause: error,
        code: WalletErrorCode.NetworkError,
        methodName: 'getGasPrice'
      });
    }
  }

  /**
   * Estimates the gas required for a given transaction.
   *
   * @param tx - The transaction data containing the recipient address, value, and optional data.
   * @returns A promise that resolves to the estimated gas as a string.
   */
  async estimateGas(tx: GenericTransactionData): Promise<EstimatedFeeData> {
    if (!this.isConnected() || !this.provider) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'estimateGas'
      });
    }

    try {
      const txForEstimate: ethers.TransactionRequest = {
        to: tx.to,
        from: this.wallet?.address, // 'from' is often needed for accurate estimation
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        value: tx.value, // Directly use string value if provided, ethers will handle it
      };

      // Provider's estimateGas
      const gasLimit = await this.provider.estimateGas(txForEstimate);

      // Provider's fee data
      const feeData = await this.provider.getFeeData();

      return {
        gasLimit: gasLimit,
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      };
    } catch (error: any) {
      console.error(`[EvmWalletAdapter] estimateGas failed:`, error);
      const message = error.shortMessage || error.message || "Unknown error during gas estimation";
      let errorCode = WalletErrorCode.GasEstimationFailed;
      if (typeof message === 'string' && message.toLowerCase().includes('insufficient funds')) {
        errorCode = WalletErrorCode.InsufficientFunds;
      }
      throw new AdapterError(`Failed to estimate gas: ${message}`, {
        cause: error,
        code: errorCode,
        methodName: 'estimateGas',
        details: error.info || error.data
      });
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
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getTransactionReceipt'
      });
    }
    try {
      // console.debug(`[EvmWalletAdapter] Getting receipt for tx: ${txHash}`);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      // console.debug(`[EvmWalletAdapter] Receipt result:`, receipt);
      return receipt; // Can be null
    } catch (error) {
      console.error(`[EvmWalletAdapter] Get transaction receipt error for ${txHash}:`, error);
      throw new AdapterError(`Failed to get transaction receipt: ${(error as Error).message}`, {
        cause: error as Error,
        code: WalletErrorCode.TransactionReceiptFailed,
        methodName: 'getTransactionReceipt'
      });
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
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getTokenBalance'
      });
    }
    const targetAccount = account || (this.wallet ? this.wallet.address : undefined);

    if (!targetAccount) {
      throw new AdapterError("Target account for getTokenBalance could not be determined.", {
        code: WalletErrorCode.AccountUnavailable,
        methodName: 'getTokenBalance'
      });
    }
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);

    try {
      // console.debug(`[EvmWalletAdapter] Getting token balance for ${tokenAddress} on account ${targetAccount}`);
      const balance = await contract.balanceOf(targetAccount);
      // console.debug(`[EvmWalletAdapter] Token balance: ${balance.toString()}`);
      return balance.toString();
    } catch (error: any) {
      console.error(`[EvmWalletAdapter] getTokenBalance for ${tokenAddress} on account ${targetAccount} failed:`, error);
      throw new AdapterError(`Failed to get token balance: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.TokenBalanceFailed,
        methodName: 'getTokenBalance'
      });
    }
  }

}