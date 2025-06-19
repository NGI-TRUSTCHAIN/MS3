import { Web3AuthNoModal } from "@web3auth/no-modal";
import { ChainNamespaceType, CustomChainConfig, IBaseProvider, WALLET_ADAPTERS } from "@web3auth/base";
import { ethers, TransactionReceipt } from "ethers";
import { WalletEvent, IEVMWallet, AssetBalance, GenericTransactionData, EIP712TypedData, EstimatedFeeData } from "../../types/index.js";
import { AdapterArguments, AdapterError, NetworkConfig, WalletErrorCode } from "@m3s/common";
import { AuthAdapter, LoginConfig } from "@web3auth/auth-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { EIP712Validator } from "../../helpers/signatures.js";


/**
 * Configuration specific to the Web3AuthWalletAdapter.
 * This structure is expected within the `options` field of `IWalletOptions`
 * when creating the adapter via `createWallet`.
 */
export interface IWeb3AuthWalletOptionsV1 {
  web3authConfig: {
    /** Your Web3Auth Plug and Play Client ID */
    clientId: string;
    /** Web3Auth Network ("sapphire_mainnet", "sapphire_devnet", "mainnet", "cyan", "aqua", "testnet") */
    web3AuthNetwork: string;
    /** Configuration for the blockchain */
    chainConfig: CustomChainConfig
    /** Configuration for the login provider (e.g., Google, Facebook) */
    loginConfig: LoginConfig
    // Add other Web3Auth specific configurations if necessary
    privateKeyProvider?: IBaseProvider<any>
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
  public readonly name: string;
  public readonly version: string;

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
    this.name = args.name;
    this.version = args.version;

    this.config = args;
  }

  /**
   * Factory method to create an instance of Web3AuthWalletAdapter.
   * @param {args} args - The configuration arguments for the Web3AuthWalletAdapter.
   * @returns {Promise<Web3AuthWalletAdapter>} A promise that resolves to the created adapter instance.
   */
  static async create(args: args): Promise<Web3AuthWalletAdapter> {
    const instance = new Web3AuthWalletAdapter(args);
    await instance.initialize();
    return instance;
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

    // Additional validation for the new loginConfig structure
    if (!opts.web3authConfig.loginConfig || typeof opts.web3authConfig.loginConfig !== 'object' || Object.keys(opts.web3authConfig.loginConfig).length === 0) {
      throw new AdapterError("web3authConfig.loginConfig must be a non-empty object.", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'initialize',
        details: { path: 'options.web3authConfig.loginConfig' }
      });
    }

    for (const providerName in opts.web3authConfig.loginConfig) {
      const providerConfig = opts.web3authConfig.loginConfig[providerName];
      if (!providerConfig || !providerConfig.verifier || !providerConfig.typeOfLogin) {
        throw new AdapterError(`Invalid configuration for loginProvider "${providerName}" in web3authConfig.loginConfig. It must include "verifier" and "typeOfLogin".`, {
          code: WalletErrorCode.InvalidInput,
          methodName: 'initialize',
          details: { path: `options.web3authConfig.loginConfig.${providerName}` }
        });
      }
    }

    try {
      let privateKeyProviderInstance = opts.web3authConfig.privateKeyProvider;
      if (!privateKeyProviderInstance) {
        // If no privateKeyProvider is supplied by the user, create a default one.
        // This is necessary because Web3AuthNoModal (especially with AuthAdapter)
        // seems to require it internally for certain operations like key export flags.
        // console.debug("[Web3AuthWalletAdapter] No privateKeyProvider in options.web3authConfig, creating default EthereumPrivateKeyProvider.");
        privateKeyProviderInstance = new EthereumPrivateKeyProvider({
          config: {
            chainConfig: { // Pass the chainConfig to the private key provider
              chainNamespace: opts.web3authConfig.chainConfig.chainNamespace as ChainNamespaceType,
              chainId: opts.web3authConfig.chainConfig.chainId, // Ensure this is hex string e.g. "0x1"
              rpcTarget: opts.web3authConfig.chainConfig.rpcTarget,
              displayName: opts.web3authConfig.chainConfig.displayName,
              blockExplorerUrl: opts.web3authConfig.chainConfig.blockExplorerUrl,
              ticker: opts.web3authConfig.chainConfig.ticker,
              tickerName: opts.web3authConfig.chainConfig.tickerName,
            }
          }
        });
      }

      this.web3auth = new Web3AuthNoModal({
        clientId: opts.web3authConfig.clientId,
        web3AuthNetwork: opts.web3authConfig.web3AuthNetwork as any, // Cast if type is broader
        chainConfig: { // This chainConfig is for Web3AuthNoModal itself
          chainNamespace: opts.web3authConfig.chainConfig.chainNamespace as ChainNamespaceType,
          chainId: opts.web3authConfig.chainConfig.chainId,
          rpcTarget: opts.web3authConfig.chainConfig.rpcTarget,
          displayName: opts.web3authConfig.chainConfig.displayName,
          blockExplorerUrl: opts.web3authConfig.chainConfig.blockExplorerUrl,
          ticker: opts.web3authConfig.chainConfig.ticker,
          tickerName: opts.web3authConfig.chainConfig.tickerName,
        },
        privateKeyProvider: privateKeyProviderInstance, // Use the (user-provided or default) provider
        enableLogging: true, // Recommended for debugging
      });

      const authAdapter: any = new AuthAdapter({
        adapterSettings: {
          loginConfig: this.config.options.web3authConfig.loginConfig,
        }
      });

      this.web3auth.configureAdapter(authAdapter);

      await this.web3auth.init();
      this.initialized = true;
    } catch (error: unknown) {
      console.error('Web3AuthWalletAdapter-AuthAdapter setup --->>', error)
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


  /**
   * Checks both initialization and Web3Auth connection status
   * @returns True if the wallet is connected, otherwise false
   */
  isConnected(): boolean { // ✅ FIXED: Return boolean, not Promise
    const connected = this.initialized && !!this.web3auth?.connected;
    console.debug(`[Web3AuthWalletAdapter] isConnected: initialized=${this.initialized}, web3auth.connected=${!!this.web3auth?.connected} -> ${connected}`);
    return connected;
  }

  /***********************/
  /** Account Management */
  /***********************/

  /**
     * Requests user accounts and triggers Web3Auth login flow if not already connected
     * @returns Promise resolving to an array of account addresses
     * @throws Error if connection fails or provider is not available
     */
  async getAccounts(): Promise<string[]> {
    if (!this.initialized || !this.web3auth) {
      throw new AdapterError("Wallet not initialized. Call initialize() first.", {
        code: WalletErrorCode.AdapterNotInitialized,
        methodName: 'requestAccounts'
      });
    }

    try {
      if (this.web3auth.connected && this.web3auth.provider) {
        const accounts = await this.web3auth.provider.request({ method: "eth_accounts" }) as string[];
        // If already connected, ensure connect event was emitted or re-emit if necessary
        // For simplicity, we can assume if it's connected, events were handled.
        // However, emitting accountsChanged is good.
        this.emitEvent(WalletEvent.accountsChanged, accounts);
        return accounts;
      }

      const loginConfigObject = this.config.options.web3authConfig.loginConfig;
      const availableLoginProviders = Object.keys(loginConfigObject);

      if (availableLoginProviders.length === 0) {
        throw new AdapterError("No login providers configured in web3authConfig.loginConfig.", {
          code: WalletErrorCode.MissingConfig,
          methodName: 'requestAccounts',
          details: { path: 'options.web3authConfig.loginConfig' }
        });
      }

      // Use the first configured login provider as the one to connect with.
      // This assumes that if multiple are configured, the first one is the desired default,
      // or that typically only one will be configured for a direct connection attempt.
      const loginProviderToUse = availableLoginProviders[0] as any; // Cast to any, or ideally to LOGIN_PROVIDER_TYPE if you have it imported

      // console.debug(`[Web3AuthWalletAdapter] Attempting to connect with loginProvider: ${loginProviderToUse}`);
      await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider: loginProviderToUse });

      if (!this.web3auth.connected || !this.web3auth.provider) {
        throw new AdapterError("Failed to connect to Web3Auth or provider unavailable after login.", {
          code: WalletErrorCode.ConnectionFailed,
          methodName: 'requestAccounts'
        });
      }

      // Provider is now available, and this.web3auth.connected is true
      const accounts = await this.web3auth.provider.request({
        method: "eth_accounts"
      }) as string[];

      // Get network information now that provider is available
      // Use a try-catch for getNetwork as it might also throw if something is amiss
      let chainIdToEmit: string | number = this.config.options.web3authConfig.chainConfig.chainId; // Fallback
      try {
        const networkInfo = await this.getNetwork(); // this.getNetwork() itself checks isConnected and provider
        chainIdToEmit = networkInfo.chainId;
      } catch (networkErr: any) {
        console.warn(`[Web3AuthWalletAdapter] Could not get network info after connect: ${networkErr.message}. Using initial chainId for event.`);
      }

      this.emitEvent(WalletEvent.connect, { chainId: chainIdToEmit }); // EMIT CONNECT EVENT
      this.emitEvent(WalletEvent.accountsChanged, accounts);
      return accounts;
    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Error requesting accounts:", error);
      // It's better to rethrow the original error or an AdapterError wrapping it
      if (error instanceof AdapterError) throw error;
      throw new AdapterError("Failed to request accounts.", { cause: error, code: WalletErrorCode.ConnectionFailed, methodName: 'requestAccounts' });
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
      const provider = this.getProvider();
      const address = account || (await this.getAccounts())[0];
      if (!address) {
        throw new AdapterError("No account available to fetch balance.", {
          code: WalletErrorCode.AccountUnavailable,
          methodName: 'getBalance'
        });
      }

      const balanceWei = await provider.getBalance(address);

      // ✅ NEW: Get rich network info with currency details  
      const networkConfig = await this.getNetwork(); // This now returns NetworkConfig with ticker!

      return {
        amount: balanceWei.toString(),
        decimals: 18, // Most networks use 18 for native currency
        symbol: networkConfig.ticker || 'ETH', // ✅ Use ticker from NetworkConfig
        formattedAmount: ethers.formatUnits(balanceWei, 18)
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
  * Verifies the signature of a message or EIP-712 typed data
  * @param message The message to verify (string/Uint8Array for regular messages, EIP712TypedData for typed data)
  * @param signature The signature to verify against
  * @param address The expected signer address
  * @returns Promise resolving to true if the signature is valid, otherwise false
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
          console.warn("[Web3AuthWalletAdapter] EIP-712 signature has unexpected format for verifySignature");
          return false;
        }
        return EIP712Validator.verifySignature(message, signature, address);
      } else {
        if (!EIP712Validator.isValidSignatureFormat(signature)) {
          console.warn("[Web3AuthWalletAdapter] Regular message signature has unexpected format for verifySignature");
          return false;
        }
        try {
          recoveredAddress = ethers.verifyMessage(message as string | Uint8Array, signature);
          return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error: any) {
          console.warn(`[Web3AuthWalletAdapter] ethers.verifyMessage failed: ${error.message}`);
          return false;
        }
      }
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      console.error("[Web3AuthWalletAdapter] Unexpected error during signature verification:", error);
      return false;
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
  // async getNetwork(): Promise<{ chainId: string; name?: string }> {
  //   // console.debug("[Web3AuthWalletAdapter] Getting network");
  //   if (!this.isConnected() || !this.web3auth?.provider) {
  //     throw new AdapterError("Not connected to Web3Auth or provider unavailable.", {
  //       code: WalletErrorCode.WalletNotConnected,
  //       methodName: 'getNetwork'
  //     });
  //   }
  //   try {
  //     const provider = this.getProvider();
  //     const network = await provider.getNetwork();
  //     // console.debug("[Web3AuthWalletAdapter] getNetwork result:", network);
  //     // Return chainId as string or number based on ICoreWallet definition
  //     return {
  //       chainId: network.chainId.toString(), // Or keep as bigint/number if interface allows
  //       name: network.name
  //     };
  //   } catch (error: unknown) {
  //     console.error(`[Web3AuthWalletAdapter: getNetwork] Error getting network:`, error);
  //     if (error instanceof AdapterError) {
  //       throw error;
  //     }

  //     const message = error instanceof Error ? error.message : String(error);

  //     throw new AdapterError(`Failed to get network: ${message}`, {
  //       cause: error,
  //       code: WalletErrorCode.NetworkError,
  //       methodName: 'getNetwork'
  //     });
  //   }
  // }

  // web3authWallet.ts - Enhanced getNetwork method
  // ✅ FIXED: Return NetworkConfig consistently  
  async getNetwork(): Promise<NetworkConfig> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new AdapterError("Not connected to Web3Auth or provider unavailable.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'getNetwork'
      });
    }

    try {
      const provider = this.getProvider();
      const network = await provider.getNetwork();
      const chainId = `0x${network.chainId.toString(16)}`;

      // ✅ Start with Web3Auth config as base
      const web3authChainConfig = this.config.options.web3authConfig.chainConfig;

      let networkConfig: NetworkConfig = {
        chainId,
        name: network.name || web3authChainConfig.displayName || `Chain ${chainId}`,
        displayName: web3authChainConfig.displayName || network.name || `Chain ${chainId}`,
        rpcUrls: web3authChainConfig.rpcTarget ? [web3authChainConfig.rpcTarget] : [], // ✅ FIXED: Array
        blockExplorerUrl: web3authChainConfig.blockExplorerUrl,
        ticker: web3authChainConfig.ticker || 'ETH',
        tickerName: web3authChainConfig.tickerName || web3authChainConfig.ticker || 'Ethereum'
      };

      // ✅ Try to enhance with NetworkHelper data
      try {
        const { NetworkHelper } = await import('@m3s/common');
        const networkHelper = NetworkHelper.getInstance();
        await networkHelper.ensureInitialized();

        const cachedConfig = await networkHelper.fetchChainListNetwork(chainId);
        if (cachedConfig) {
          // ✅ FIXED: Merge NetworkConfig properly
          networkConfig = {
            ...cachedConfig,
            // Keep Web3Auth RPC as primary
            rpcUrls: networkConfig.rpcUrls.length > 0 ?
              [...networkConfig.rpcUrls, ...cachedConfig.rpcUrls.filter(url => !networkConfig.rpcUrls.includes(url))] :
              cachedConfig.rpcUrls,
            // Keep Web3Auth display name if available
            displayName: networkConfig.displayName || cachedConfig.displayName,
            // Keep Web3Auth block explorer if available
            blockExplorerUrl: networkConfig.blockExplorerUrl || cachedConfig.blockExplorerUrl
          };
        }
      } catch (helperError) {
        console.warn("[Web3AuthWalletAdapter] Could not enhance with NetworkHelper data:", helperError);
        // Continue with Web3Auth config only
      }

      return networkConfig;
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
      if (
        switchError.code === -32000 || // Standard RPC error for "Invalid input" or method not found, sometimes used by providers
        switchError.code === 4902 || // EIP-1193: Unrecognized chain ID
        (typeof switchError.message === 'string' &&
          (
            switchError.message.includes("Unrecognized chain ID") ||
            switchError.message.includes("Chain config has not been added") || // Add this condition
            switchError.message.toLowerCase().includes("chain not found") // Broader check for similar issues
          )
        )
      ) {
        try {
          const chainToAdd = {
            chainId: newChainIdHex,
            chainNamespace: this.config.options.web3authConfig.chainConfig.chainNamespace || "eip155" as ChainNamespaceType,
            displayName: config.displayName || config.name || 'Custom Network',
            rpcTarget: config.rpcUrls[0], // Use the first RPC URL from NetworkConfig
            blockExplorerUrl: config.blockExplorerUrl, // Web3Auth expects singular blockExplorerUrl
            ticker: config.ticker || 'ETH', // Default ticker if not provided
            tickerName: config.tickerName || config.ticker || 'Ethereum', // Default tickerName
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

  private parseValueToWei(value: string | number | bigint): string {
    if (!value || value === '0') return '0';

    try {
      if (typeof value === 'bigint') return value.toString();
      if (typeof value === 'number') value = value.toString();

      // ✅ FIX: Better decimal detection
      if (typeof value === 'string' && value.includes('.')) {
        return ethers.parseEther(value).toString();
      }

      // ✅ FIX: Better small number detection
      const numValue = parseFloat(value as string);
      if (numValue < 1000 && !value.toString().includes('e')) { // Avoid scientific notation
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

  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    const signer = await this.getSigner();
    const provider = this.getProvider();

    // Basic structure from GenericTransactionData
    const txRequest: ethers.TransactionRequest = {
      // from: signer.address, // Not strictly needed as signer populates it
      to: tx.to,
      value: tx.value ? this.parseValueToWei(tx.value) : undefined, // ✅ FIX THIS LINE
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      nonce: tx.options?.nonce, // Will be populated by signer if undefined
      gasLimit: tx.options?.gasLimit ? BigInt(tx.options.gasLimit) : undefined,
      gasPrice: tx.options?.gasPrice ? BigInt(tx.options.gasPrice) : undefined,
      maxFeePerGas: tx.options?.maxFeePerGas ? BigInt(tx.options.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? BigInt(tx.options.maxPriorityFeePerGas) : undefined,
      chainId: tx.options?.chainId ? BigInt(tx.options.chainId) : undefined, // Will be populated by signer
      ...(tx.options?.type !== undefined && { type: tx.options.type }),
    };

    // Populate missing fields if not provided in options (e.g., nonce, gas)
    if (txRequest.nonce === undefined) {
      // console.debug("[Web3AuthWalletAdapter] Populating nonce for prepared tx.");
      txRequest.nonce = await signer.getNonce('pending');
    }

    // Gas handling: Prioritize options, then estimate
    if (txRequest.gasLimit === undefined && tx.options?.gasLimit === undefined) {
      if (!txRequest.data || txRequest.data === "0x") {
        // For simple ETH transfers, set default gasLimit.
        txRequest.gasLimit = BigInt(21000);
      } else {
        // ✅ FIXED: Better gas estimation fallback for contract interactions
        try {
          const estimatedGas = await provider.estimateGas(txRequest);
          txRequest.gasLimit = estimatedGas;
        } catch (e: any) {
          console.warn(`[Web3AuthWalletAdapter] Gas estimation failed:`, e.message);

          // ✅ FIXED: Intelligent fallback based on transaction type
          if (!txRequest.to) {
            // Contract deployment - needs much more gas
            txRequest.gasLimit = BigInt(5000000); // 5M gas for deployments
            console.warn(`[Web3AuthWalletAdapter] Using deployment fallback gas: 5M`);
          } else if (txRequest.data && txRequest.data !== "0x") {
            // Contract interaction - analyze call data for better estimation
            const dataLength = txRequest.data.length;
            if (dataLength > 1000) {
              // Complex contract call (like batch operations)
              txRequest.gasLimit = BigInt(1000000); // 1M gas
              console.warn(`[Web3AuthWalletAdapter] Using complex call fallback gas: 1M`);
            } else {
              // Simple contract call (like ERC20 transfer, NFT mint, burn)
              txRequest.gasLimit = BigInt(300000); // 300K gas  
              console.warn(`[Web3AuthWalletAdapter] Using simple call fallback gas: 300K`);
            }
          } else {
            // Simple ETH transfer
            txRequest.gasLimit = BigInt(21000);
            console.warn(`[Web3AuthWalletAdapter] Using ETH transfer fallback gas: 21K`);
          }
        }
      }
    }

    if (txRequest.gasPrice === undefined && txRequest.maxFeePerGas === undefined &&
      tx.options?.gasPrice === undefined && tx.options?.maxFeePerGas === undefined) {
      // console.debug("[Web3AuthWalletAdapter] No explicit fee data in options, signer will populate.");
      // Ethers.js signer.sendTransaction or signer.signTransaction will call provider.getFeeData()
    }


    // Remove undefined fields to prevent issues with some signers/providers
    Object.keys(txRequest).forEach(key => (txRequest as any)[key] === undefined && delete (txRequest as any)[key]);
    // console.debug("[Web3AuthWalletAdapter] Prepared TX for Web3Auth:", JSON.stringify(txRequest, (k, v) => typeof v === 'bigint' ? v.toString() : v));
    return txRequest;
  }

  async callContract(to: string, data: string): Promise<string> {
    if (!this.isConnected() || !this.getProvider()) {
      throw new AdapterError("Provider not set or wallet not connected.", {
        code: WalletErrorCode.WalletNotConnected,
        methodName: 'callContract'
      });
    }

    try {
      const result = await this.getProvider().call({
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
      const err = error as any;
      console.error(`[Web3AuthWalletAdapter: signTransaction] Error signing transaction:`, err, err?.payload ? `Payload: ${JSON.stringify(err.payload)}` : '');
      const message = err.shortMessage || err.message || String(err);
      let code = WalletErrorCode.SignatureFailed;
      if (err.code === -32603 || (typeof message === 'string' && message.includes("non-contract address"))) {
        // Potentially map this specific error if it persists despite changes
        code = WalletErrorCode.InvalidInput; // Or a more specific error
      }
      throw new AdapterError(`Failed to sign transaction: ${message}`, {
        cause: err,
        code: code,
        methodName: 'signTransaction',
        details: { originalError: err, payload: err.payload }
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
      // ✅ ALWAYS validate structure and types first
      EIP712Validator.validateStructure(data);
      EIP712Validator.validateTypes(data.types);

      // ✅ Only validate domain/network if connected
      const network = await this.getNetwork();
      EIP712Validator.validateDomain(data.domain, network.chainId.toString());

      const signer = await this.getSigner();
      console.debug("[Web3AuthWalletAdapter] Signing EIP-712 typed data:", data);
      const signature = await signer.signTypedData(data.domain, data.types, data.value);

      // ✅ Use centralized signature verification
      const signerAddress = await signer.getAddress();
      if (!EIP712Validator.verifySignature(data, signature, signerAddress)) {
        throw new AdapterError("EIP-712 signature verification failed immediately after signing", {
          code: WalletErrorCode.SignatureFailed,
          methodName: 'signTypedData'
        });
      }

      console.debug("[Web3AuthWalletAdapter] EIP-712 typed data signed and verified.");
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
}