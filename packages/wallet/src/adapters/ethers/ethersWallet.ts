import { ethers, Provider, Wallet as EthersWallet, JsonRpcProvider, TransactionResponse, isHexString, TransactionReceipt } from "ethers";
import { WalletEvent, IEVMWallet, AssetBalance, GenericTransactionData, EIP712TypedData, EstimatedFeeData } from "@m3s/wallet";
import { AdapterArguments, AdapterError, NetworkConfig, WalletErrorCode } from "@m3s/common";
import { EIP712Validator } from "../../helpers/signatures.js";

/**
 * Specific options for EVM-based wallet adapters.
 */
export interface IEthersWalletOptionsV1 {
  privateKey?: string;
  provider?: any;
}

interface args extends AdapterArguments<IEthersWalletOptionsV1> { }

export class EvmWalletAdapter implements IEVMWallet {
  public readonly name: string;
  public readonly version: string;

  private wallet!: EthersWallet;
  private provider?: Provider;
  private config: args;
  public initialized: boolean = false;
  private _connected: boolean = false; // Explicit connection state flag
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  /** General Initialization */

  /**
     * Creates an instance of the EvmWalletAdapter.
     * @private - Use EvmWalletAdapter.create() instead
     */
  private constructor(args: args, processedPrivateKey?: string) {
    this.name = args.name;
    this.version = args.version;
    this.config = args;

    // ✅ If processedPrivateKey is provided, create wallet immediately in constructor
    if (processedPrivateKey) {
      this.wallet = new EthersWallet(processedPrivateKey);
      console.debug("[EvmWalletAdapter Constructor] Wallet created with processed private key.");
      // ✅ processedPrivateKey parameter goes out of scope after constructor
    }

    // ✅ Move ALL provider setup logic to initialize() method
    // Constructor now only handles basic setup and wallet creation
  }


  /**
   * Creates a new instance of EvmWalletAdapter.
   * @param {args} args - The arguments required to create the EvmWalletAdapter instance.
   * @returns {Promise<EvmWalletAdapter>} A promise that resolves to the newly created EvmWalletAdapter instance.
   */
  static async create(args: args): Promise<EvmWalletAdapter> {
    // ✅ Process and validate private key in create() method
    let processedPrivateKey: string;

    if (args.options?.privateKey && typeof args.options.privateKey === 'string' && args.options.privateKey.trim() !== '') {
      if (isHexString(args.options.privateKey, 32)) {
        processedPrivateKey = args.options.privateKey;
        console.debug("[EvmWalletAdapter.create] Using provided valid private key.");
      } else {
        throw new AdapterError("Invalid private key format provided. Must be a 0x-prefixed 64-character hex string.", {
          code: WalletErrorCode.InvalidInput,
          methodName: 'create',
          details: { optionPath: 'options.privateKey', reason: 'Invalid format. Expected a 0x-prefixed 64-character hexadecimal string.' }
        });
      }
    } else {
      console.warn('[EvmWalletAdapter.create] No private key provided in options, or it was empty. Generating a random one internally.');
      const randomWallet = ethers.Wallet.createRandom();
      processedPrivateKey = randomWallet.privateKey;
      console.debug(`[EvmWalletAdapter.create] Generated new random wallet internally. Address: ${randomWallet.address}`);
    }

    // ✅ Pass processed private key to constructor, then call initialize
    const adapter = new EvmWalletAdapter(args, processedPrivateKey);
    // ✅ processedPrivateKey is now out of scope and can be garbage collected

    await adapter.initialize(); // ✅ Keep the same initialize() signature!
    return adapter;
  }

  /**
  * Initializes the wallet instance if it has not been initialized yet.
  * ✅ UNCHANGED - Same signature as ICoreWallet interface!
  * @returns {Promise<void>} A promise that resolves when the initialization is complete.
  */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // ✅ Wallet is already created in constructor, just set up provider
      if (!this.wallet) {
        throw new Error("Wallet instance not created in constructor");
      }

      console.debug("[EvmWalletAdapter Initialize] Setting up provider connections...");

      // ✅ Move ALL provider setup logic here from constructor
      if (this.config.options?.provider) {
        console.log(`[EvmWalletAdapter Initialize] Received options.provider:`, this.config.options.provider);

        if (this.config.options.provider instanceof JsonRpcProvider) {
          this.provider = this.config.options.provider;
          console.log("[EvmWalletAdapter Initialize] Using provided ethers JsonRpcProvider instance.");
        } else if (typeof this.config.options.provider === 'object' && (this.config.options.provider as NetworkConfig).rpcUrls) {
          const netConfig = this.config.options.provider as NetworkConfig;
          const rpcUrl = netConfig.rpcUrls[0];

          console.log(`[EvmWalletAdapter Initialize] Attempting to use rpcUrls[0]: '${rpcUrl}' from config.`);

          if (rpcUrl && typeof rpcUrl === 'string' && rpcUrl.trim() !== '') {
            try {
              this.provider = new JsonRpcProvider(rpcUrl);
              console.log(`[EvmWalletAdapter Initialize] Successfully created JsonRpcProvider with URL: ${rpcUrl}`);
            } catch (e: any) {
              console.error(`[EvmWalletAdapter Initialize] Failed to create JsonRpcProvider from config.rpcUrls[0] ('${rpcUrl}'). Error: ${e.message}`);
              this.provider = undefined;
            }
          } else {
            console.warn(`[EvmWalletAdapter Initialize] config.rpcUrls[0] is invalid: '${rpcUrl}'. Provider not set.`);
            this.provider = undefined;
          }
        } else if (typeof this.config.options.provider === 'object' && (this.config.options.provider as any).rpcUrl) {
          const rpcUrl = (this.config.options.provider as any).rpcUrl;
          console.log(`[EvmWalletAdapter Initialize] Attempting to use rpcUrl: '${rpcUrl}' from config (fallback structure).`);
          try {
            this.provider = new JsonRpcProvider(rpcUrl);
            console.log(`[EvmWalletAdapter Initialize] Successfully created JsonRpcProvider with URL (fallback): ${rpcUrl}`);
          } catch (e: any) {
            console.error(`[EvmWalletAdapter Initialize] Failed to create JsonRpcProvider from config.rpcUrl ('${rpcUrl}'). Error: ${e.message}`);
            this.provider = undefined;
          }
        } else {
          console.warn("[EvmWalletAdapter Initialize] config.provider was provided but is not a recognized structure. Provider not set.");
          this.provider = undefined;
        }
      } else {
        console.warn("[EvmWalletAdapter Initialize] No config.provider provided. Provider not set.");
        this.provider = undefined;
      }

      // ✅ Provider connection logic
      if (this.provider) {
        const providerUrl = (this.provider as any)?.connection?.url || 'N/A';
        console.log(`[EvmWalletAdapter Initialize] Provider instance exists. Attempting to connect wallet. Provider URL: ${providerUrl}`);
        try {
          const network = await this.provider.getNetwork();
          console.log(`[EvmWalletAdapter Initialize] provider.getNetwork() successful. Network: ${network.name}, ChainID: ${network.chainId}`);
          this.wallet = this.wallet.connect(this.provider);
          this._connected = true;
          console.log(`[EvmWalletAdapter Initialize] Successfully connected wallet to provider. _connected: ${this._connected}`);
        } catch (e: any) {
          console.error(`[EvmWalletAdapter Initialize] Provider connection failed. Error: ${e.message}. Provider URL: ${providerUrl}`);
          this.provider = undefined;
          this._connected = false;
          if (this.wallet) {
            this.wallet = this.wallet.connect(null);
            console.log('[EvmWalletAdapter Initialize] Set wallet.provider to null after provider failure.');
          }
        }
      } else {
        console.warn("[EvmWalletAdapter Initialize] No provider available. _connected will be false.");
        this._connected = false;
        if (this.wallet) {
          this.wallet = this.wallet.connect(null);
          console.log('[EvmWalletAdapter Initialize] Set wallet.provider to null as no initial provider.');
        }
      }

      this.initialized = true;
      console.debug("EvmWalletAdapter initialized successfully.");
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

  /**
   * Checks if the wallet is connected to a provider.
   *
   * @returns {boolean} `true` if the wallet is connected to a provider, otherwise `false`.
   */
  isConnected(): boolean { // ✅ FIXED: Return boolean, not Promise
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
  * Retrieves the list of accounts associated with the wallet.
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
    }
    if (!this.initialized) {
      console.error("[EvmWalletAdapter:getAccounts] FAILED: Adapter not initialized.");
      return [];
    }

    try {
      const address = await this.wallet.getAddress();
      const accounts = [address];

      this.emitEvent(WalletEvent.accountsChanged, accounts);

      return accounts;
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
    if (!this.isConnected() || !this.provider) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getBalance'
      });
    }

    const address = account || (await this.getAccounts())[0];
    if (!address) {
      throw new AdapterError("No account available to fetch balance.", {
        code: WalletErrorCode.AccountUnavailable,
        methodName: 'getBalance'
      });
    }

    try {
      const balanceWei = await this.provider.getBalance(address);

      // ✅ NEW: Get rich network info with currency details
      const networkConfig = await this.getNetwork(); // This now returns NetworkConfig with ticker!

      return {
        amount: balanceWei.toString(),
        decimals: 18, // Most networks use 18 for native currency
        symbol: networkConfig.ticker || 'ETH', // ✅ Use ticker from NetworkConfig
        formattedAmount: ethers.formatUnits(balanceWei, 18)
      };
    } catch (error) {
      console.error(`[EvmWalletAdapter] Error getting balance for ${address}:`, error);
      throw new AdapterError(`Failed to get balance for ${address}: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.NetworkError,
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
  async verifySignature(
    message: string | Uint8Array | EIP712TypedData,
    signature: string,
    address: string
  ): Promise<boolean> {
    if (!address) {
      throw new AdapterError("Address parameter is required for verification.", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'verifySignature',
        details: { parameter: 'address' }
      });
    }

    // ✅ ADD: Validate address format before proceeding
    if (!ethers.isAddress(address)) {
      throw new AdapterError("Invalid address format provided for verification.", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'verifySignature',
        details: { parameter: 'address', value: address }
      });
    }

    try {
      let recoveredAddress: string;

      if (typeof message === 'object' && 'domain' in message && 'types' in message && 'value' in message) {
        EIP712Validator.validateStructure(message);

        if (!EIP712Validator.isValidSignatureFormat(signature)) {
          console.warn("[EvmWalletAdapter] EIP-712 signature has unexpected format for verifySignature");
          return false;
        }
        return EIP712Validator.verifySignature(message, signature, address);
      } else {
        if (!EIP712Validator.isValidSignatureFormat(signature)) {
          console.warn("[EvmWalletAdapter] Regular message signature has unexpected format for verifySignature");
          return false;
        }
        try {
          recoveredAddress = ethers.verifyMessage(message as string | Uint8Array, signature);
          return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error: any) {
          console.warn(`[EvmWalletAdapter] ethers.verifyMessage failed: ${error.message}`);
          return false;
        }
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      console.error("[EvmWalletAdapter] Unexpected error during signature verification:", error);
      return false;
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

  async getNetwork(): Promise<NetworkConfig> {
    if (!this.isConnected() || !this.provider) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getNetwork'
      });
    }

    try {
      const network = await this.provider.getNetwork();
      const chainId = `0x${network.chainId.toString(16)}`;

      // ✅ Try to get rich data from NetworkHelper first
      let networkConfig: NetworkConfig;
      try {
        const { NetworkHelper } = await import('@m3s/common');
        const networkHelper = NetworkHelper.getInstance();
        await networkHelper.ensureInitialized();

        const cachedConfig = await networkHelper.fetchChainListNetwork(chainId);
        if (cachedConfig) {
          // ✅ FIXED: cachedConfig is already NetworkConfig
          networkConfig = cachedConfig;
        } else {
          // ✅ FIXED: Fallback to basic ethers data as NetworkConfig
          networkConfig = {
            chainId,
            name: network.name || `Chain ${chainId}`,
            displayName: network.name || `Chain ${chainId}`,
            rpcUrls: [(this.provider as any)?.connection?.url || ''].filter(Boolean),
            ticker: 'ETH',
            tickerName: 'Ethereum'
          };
        }
      } catch (helperError) {
        // ✅ FIXED: Fallback as NetworkConfig
        networkConfig = {
          chainId,
          name: network.name || `Chain ${chainId}`,
          displayName: network.name || `Chain ${chainId}`,
          rpcUrls: [(this.provider as any)?.connection?.url || ''].filter(Boolean),
          ticker: 'ETH',
          tickerName: 'Ethereum'
        };
      }

      return networkConfig;
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

  private parseValueToWei(value: string | number | bigint): string {
    if (!value || value === '0') return '0';

    try {
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'number') value = value.toString();

      // If contains decimal, treat as ETH and convert to Wei
      if (typeof value === 'string' && value.includes('.')) {
        return ethers.parseEther(value).toString();
      }

      // For integers, assume ETH if small number
      const numValue = parseFloat(value as string);
      if (numValue < 1000) {
        return ethers.parseEther(value as string).toString();
      }

      return value.toString();
    } catch (error) {
      throw new AdapterError(`Invalid value format: ${value}`, {
        code: WalletErrorCode.InvalidInput,
        methodName: 'parseValueToWei'
      });
    }
  }

  // private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
  //   if (!this.initialized || !this.wallet) {
  //     throw new AdapterError("Wallet not initialized.", {
  //       code: WalletErrorCode.AdapterNotInitialized,
  //       methodName: 'prepareTransactionRequest'
  //     });
  //   }
  //   if (!this.provider && (!tx.options?.chainId || !tx.options?.nonce || (!tx.options?.gasPrice && !tx.options?.maxFeePerGas))) {
  //     // If provider is missing, we can't fetch chainId, nonce, or feeData if not in options.
  //     // This scenario is less likely if isConnected() is checked before calling, which implies a provider.
  //     console.warn("[EvmWalletAdapter:prepare] Provider not available. Transaction preparation will rely solely on tx.options.");
  //   }

  //   let chainIdBigInt: bigint | undefined;
  //   if (tx.options?.chainId) {
  //     chainIdBigInt = BigInt(tx.options.chainId);
  //   } else if (this.provider) {
  //     try {
  //       chainIdBigInt = (await this.provider.getNetwork()).chainId;
  //     } catch (e) {
  //       console.warn("[EvmWalletAdapter:prepare] Error getting chainId from provider, relying on options if present.", e);
  //     }
  //   }

  //   let nonce: number | undefined;
  //   if (tx.options?.nonce !== undefined) {
  //     nonce = tx.options.nonce;
  //   } else if (this.wallet) {
  //     try {
  //       nonce = await this.wallet.getNonce('pending');
  //     } catch (e) {
  //       console.warn("[EvmWalletAdapter:prepare] Error getting nonce from wallet, relying on options if present.", e);
  //     }
  //   }

  //   const txRequest: ethers.TransactionRequest = {
  //     to: tx.to,
  //     value: tx.value ? this.parseValueToWei(tx.value) : undefined, // ✅ FIX THIS LINE
  //     data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
  //     chainId: chainIdBigInt,
  //     nonce: nonce,
  //     gasLimit: tx.options?.gasLimit ? BigInt(tx.options.gasLimit) : undefined,
  //     gasPrice: tx.options?.gasPrice ? BigInt(tx.options.gasPrice) : undefined,
  //     maxFeePerGas: tx.options?.maxFeePerGas ? BigInt(tx.options.maxFeePerGas) : undefined,
  //     maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? BigInt(tx.options.maxPriorityFeePerGas) : undefined,
  //     ...(tx.options?.type !== undefined && { type: tx.options.type }),
  //   };

  //   // Populate fee data if not provided in options and provider is available
  //   if (this.provider && txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined) {
  //     try {
  //       const feeData = await this.provider.getFeeData();
  //       if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
  //         txRequest.maxFeePerGas = feeData.maxFeePerGas;
  //         txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  //         // console.debug('[EvmWalletAdapter:prepareTransactionRequest] Using EIP-1559 fees.');
  //       } else if (feeData.gasPrice) {
  //         txRequest.gasPrice = feeData.gasPrice;
  //         // console.debug('[EvmWalletAdapter:prepareTransactionRequest] Using legacy gasPrice.');
  //       }
  //     } catch (e) {
  //       console.warn("[EvmWalletAdapter:prepare] Error getting fee data from provider.", e);
  //     }
  //   }

  //   console.debug('RAW TX - ESTIMATION FOR GAS INSIDE PREPARE TX REQUEST 1', tx)
  //   console.debug('FORMATED TX - ESTIMATION FOR GAS INSIDE PREPARE TX REQUEST 2', txRequest)
  //   console.debug('IF FLAGS - ESTIMATION FOR GAS INSIDE PREPARE TX REQUEST 3', this.provider,  txRequest.gasLimit)

  //   if (this.provider && txRequest.gasLimit === undefined) {
  //     try {
  //       if (!txRequest.data || txRequest.data === "0x") {
  //         txRequest.gasLimit = BigInt(21000);
  //       } else {
  //         const estimatedGas = await this.provider.estimateGas(txRequest);
  //         txRequest.gasLimit = estimatedGas;
  //       }
  //     } catch (gasEstimateError: any) {
  //       console.error(`[EvmWalletAdapter] Gas estimation failed:`, gasEstimateError);

  //       // ✅ ADD: Fail fast for contract deployments
  //       if (!txRequest.to) {
  //         throw new AdapterError(`Contract deployment gas estimation failed: ${gasEstimateError.message}. This usually indicates invalid bytecode or constructor parameters.`, {
  //           cause: gasEstimateError,
  //           code: WalletErrorCode.GasEstimationFailed,
  //           methodName: 'prepareTransactionRequest'
  //         });
  //       }

  //       // For other calls, set a reasonable fallback
  //       txRequest.gasLimit = BigInt(3000000);
  //     }
  //   }

  //   Object.keys(txRequest).forEach(key => (txRequest as any)[key] === undefined && delete (txRequest as any)[key]);

  //   return txRequest;
  // }

  // ✅ ADD: Clean, reusable gas estimation method
  
  private async estimateTransactionGas(txRequest: ethers.TransactionRequest): Promise<bigint> {
    if (!this.provider) {
      return BigInt(3000000); // Default fallback
    }

    try {
      // Simple checks first
      if (!txRequest.data || txRequest.data === "0x") {
        return BigInt(21000); // ETH transfer
      }

      // ✅ CRITICAL FIX: Add 'from' field for contract calls
      const estimateRequest = {
        ...txRequest,
        from: this.wallet?.address // Add the wallet address as 'from'
      };

      console.log('ESTIMATE GAS PROVIDER', this.provider)
      console.log('ESTIMATE GAS TX', estimateRequest)

      // For contract calls/deployments
      return await this.provider.estimateGas(estimateRequest);
    } catch (error) {
      console.warn(`[EvmWalletAdapter] Gas estimation failed, using fallback:`, error);

      // Fallback based on transaction type
      if (!txRequest.to) return BigInt(5000000);  // Contract deployment
      return BigInt(3000000); // Contract call
    }
  }

  // ✅ FIX: Simplified prepareTransactionRequest
  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    if (!this.initialized || !this.wallet) {
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'prepareTransactionRequest'
      });
    }

    // Get chainId
    let chainIdBigInt: bigint | undefined;
    if (tx.options?.chainId) {
      chainIdBigInt = BigInt(tx.options.chainId);
    } else if (this.provider) {
      try {
        chainIdBigInt = (await this.provider.getNetwork()).chainId;
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting chainId from provider", e);
      }
    }

    // Get nonce
    let nonce: number | undefined;
    if (tx.options?.nonce !== undefined) {
      nonce = tx.options.nonce;
    } else if (this.wallet) {
      try {
        nonce = await this.wallet.getNonce('pending');
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting nonce from wallet", e);
      }
    }

    // Build base transaction request
    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value ? this.parseValueToWei(tx.value) : undefined,
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      chainId: chainIdBigInt,
      nonce: nonce,
      gasLimit: tx.options?.gasLimit ? BigInt(tx.options.gasLimit) : undefined,
      gasPrice: tx.options?.gasPrice ? BigInt(tx.options.gasPrice) : undefined,
      maxFeePerGas: tx.options?.maxFeePerGas ? BigInt(tx.options.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? BigInt(tx.options.maxPriorityFeePerGas) : undefined,
      ...(tx.options?.type !== undefined && { type: tx.options.type }),
    };

    // Populate fee data if not provided
    if (this.provider && !txRequest.gasPrice && !txRequest.maxFeePerGas) {
      try {
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          txRequest.maxFeePerGas = feeData.maxFeePerGas;
          txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        } else if (feeData.gasPrice) {
          txRequest.gasPrice = feeData.gasPrice;
        }
      } catch (e) {
        console.warn("[EvmWalletAdapter:prepare] Error getting fee data", e);
      }
    }

    // ✅ FIX: Estimate gas if not provided
    if (!txRequest.gasLimit) {
      txRequest.gasLimit = await this.estimateTransactionGas(txRequest);
    }

    // Clean up undefined values
    Object.keys(txRequest).forEach(key =>
      (txRequest as any)[key] === undefined && delete (txRequest as any)[key]
    );

    return txRequest;
  }

  async callContract(to: string, data: string): Promise<string> {
    if (!this.isConnected() || !this.provider) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'callContract'
      });
    }

    try {
      const result = await this.provider.call({
        to,
        data
      });
      return result;
    } catch (error: any) {
      throw new AdapterError(`Contract call failed: ${error.message}`, {
        cause: error,
        code: WalletErrorCode.ContractCallFailed,
        methodName: 'callContract'
      });
    }
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
   * Signs typed data using the wallet with enhanced EIP-712 compliance.
   *
   * @param data - The data to be signed, including the domain, types, and value.
   * @returns A promise that resolves to the signed data as a string.
   * @throws Will throw an error if the wallet is not initialized or data is invalid.
   */
  async signTypedData(data: EIP712TypedData): Promise<string> {
    if (!this.initialized || !this.wallet) {
      throw new AdapterError("Wallet not initialized.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'signTypedData'
      });
    }

    try {
      // ✅ CRITICAL: Validate BEFORE any ethers calls
      console.debug("[EvmWalletAdapter] Validating EIP-712 structure...");
      EIP712Validator.validateStructure(data);

      console.debug("[EvmWalletAdapter] Validating EIP-712 types...");
      EIP712Validator.validateTypes(data.types);

      // ✅ Only validate domain/network if we have a provider
      if (this.provider) {
        console.debug("[EvmWalletAdapter] Validating EIP-712 domain...");
        const network = await this.provider.getNetwork();
        EIP712Validator.validateDomain(data.domain, network.chainId.toString());
      } else {
        console.warn("[EvmWalletAdapter] No provider available for domain validation");
      }

      console.debug("[EvmWalletAdapter] All validations passed. Signing EIP-712 typed data:", data);

      // ✅ ONLY call ethers after our validation passes
      const signature = await this.wallet.signTypedData(data.domain, data.types, data.value);

      // ✅ Use centralized signature verification
      const signerAddress = await this.wallet.getAddress();
      if (!EIP712Validator.verifySignature(data, signature, signerAddress)) {
        throw new AdapterError("EIP-712 signature verification failed immediately after signing", {
          code: WalletErrorCode.SignatureFailed,
          methodName: 'signTypedData'
        });
      }

      console.debug("[EvmWalletAdapter] EIP-712 typed data signed and verified.");
      return signature;
    } catch (error) {
      console.error("[EvmWalletAdapter] Sign typed data failed:", error);

      // ✅ CRITICAL: Re-throw AdapterError (from our validators) immediately
      if (error instanceof AdapterError) {
        console.debug("[EvmWalletAdapter] Re-throwing validation AdapterError:", error.message);
        throw error;
      }

      // ✅ For other errors (like ethers errors), wrap them
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

    console.debug('ESTIMATE GAS FOR THIS TX', JSON.parse(JSON.stringify(tx)))

    try {
      const txForEstimate: ethers.TransactionRequest = {
        to: tx.to,
        from: this.wallet?.address, // 'from' is often needed for accurate estimation
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        value: tx.value ? this.parseValueToWei(tx.value) : undefined, // ✅ FIX: Convert value to Wei
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
}