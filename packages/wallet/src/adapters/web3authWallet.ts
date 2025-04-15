import { Web3AuthNoModal } from "@web3auth/no-modal";
import { ChainNamespaceType, WALLET_ADAPTERS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers, TransactionReceipt } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { AssetBalance, EIP712TypedData, GenericTransactionData, IEVMWallet, WalletEvent } from "../types/index.js";

/**
 * Configuration specific to the Web3AuthWalletAdapter.
 * This structure is expected within the `options` field of `IWalletOptions`
 * when creating the adapter via `createWallet`.
 */
export interface Web3AuthAdapterOptions {
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
 * Web3AuthWalletAdapter configuration arguments.
 */
interface args {
  adapterName: string;
  options: Web3AuthAdapterOptions// Use the specific type
};



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
    console.log("Web3Auth adapter received args:", JSON.stringify(args, null, 2));
    this.config = args;
  }

  /**
   * Factory method to create an instance of Web3AuthWalletAdapter.
   * @param {args} args - The configuration arguments for the Web3AuthWalletAdapter.
   * @returns {Promise<Web3AuthWalletAdapter>} A promise that resolves to the created adapter instance.
   */
  static async create(args: args): Promise<Web3AuthWalletAdapter> {
    console.log("Creating Web3AuthWalletAdapter...", args);
    const adapter = new Web3AuthWalletAdapter(args);
    // Initialization happens separately now via initialize() method
    return adapter;
  }

  /**
   * Initialize the Web3AuthNoModal instance with the provided configuration.
   * @throws Error if initialization fails or chainConfig is missing.
   */
  async initialize(config?: any): Promise<void> {
    if (this.initialized) return;

    const { clientId, web3AuthNetwork, chainConfig } = this.config.options.web3authConfig;
    if (!chainConfig) {
      throw new Error("Invalid provider Config, Please provide chainConfig");
    }

    try {
      const privateKeyProvider = new EthereumPrivateKeyProvider({
        config: { chainConfig: chainConfig as any }
      });

      this.web3auth = new Web3AuthNoModal({
        clientId: clientId,
        web3AuthNetwork: web3AuthNetwork as any,
        chainConfig: chainConfig as any,
        privateKeyProvider,
        ...config // Allow extending with additional config
      });

      const authAdapter = new AuthAdapter({
        adapterSettings: {
          clientId: clientId,
          loginConfig: this.config.options.web3authConfig.loginConfig as any
        }
      });

      this.web3auth.configureAdapter(authAdapter);
      await this.web3auth.init();
      this.initialized = true;
    } catch (error: unknown) {
      console.error("Error initializing Web3Auth:", error);
      throw error;
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
      console.log("[Web3AuthWalletAdapter] Logged out.");
    }
    // Reset state partially, keep config
    this.web3auth = null; // Allow re-initialization
    this.initialized = false;
    this.eventListeners.clear();
    console.log("[Web3AuthWalletAdapter] Disconnected.");
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
      throw new Error("Web3Auth not initialized");
    }

    try {
      if (this.web3auth.connected) {
        const accounts = await this.getAccounts(); // Use internal getAccounts
        console.log("[Web3AuthWalletAdapter] Already connected, returning accounts:", accounts);

        this.emitEvent(WalletEvent.accountsChanged, accounts);
        return accounts;
      }

      // Login flow
      console.log("[Web3AuthWalletAdapter] Not connected, triggering login flow...");
      const loginProvider = this.config.options.web3authConfig.loginConfig.loginProvider;
      await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider }); // Use AUTH adapter

      if (!this.web3auth.connected || !this.web3auth.provider) {
        throw new Error("Failed to connect to Web3Auth or provider unavailable after login.");
      }
      console.log("[Web3AuthWalletAdapter] Connection successful.");

      // Get accounts after connection
      const accounts = await this.web3auth.provider.request({
        method: "eth_accounts"
      }) as string[];

      console.log("[Web3AuthWalletAdapter] Accounts obtained after login:", accounts);
      // this.accounts = accounts;
      this.emitEvent(WalletEvent.accountsChanged, accounts);
      return accounts;
    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Error requesting accounts:", error);
      throw error;
    }
  }

  /**
   * Gets the private key from Web3Auth
   * @returns Promise resolving to the private key
   * @throws Error if wallet is not connected or private key is unavailable
   */
  async getPrivateKey(): Promise<string> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new Error("Not connected to Web3Auth or provider unavailable.");
    }

    try {
      // Use the standard EIP-1193 method if available, otherwise specific Web3Auth method
      const privateKey = await this.web3auth.provider.request({
        method: "eth_private_key" // Check if Web3Auth provider supports this standard method
      });
      if (!privateKey) {
        throw new Error("Private key method not supported or returned null.");
      }
      return privateKey as string;
    } catch (error: unknown) {
      console.error("Error getting private key:", error);
      // Consider mapping to a specific WalletErrorCode
      throw new Error("Unable to get private key from Web3Auth");
    }
  }

  /**
 * Gets the current accounts without triggering login flow
 * @returns Promise resolving to an array of account addresses
 */
  async getAccounts(): Promise<string[]> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      // Return empty array if not connected, don't throw
      console.log("[Web3AuthWalletAdapter] getAccounts called while not connected.");
      return [];
    }

    try {
      const accounts = await this.web3auth.provider.request({ method: "eth_accounts" }) as string[];
      console.log("[Web3AuthWalletAdapter] getAccounts result:", accounts);
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
      throw new Error("Not connected to Web3Auth or provider unavailable.");
    }

    try {
      const provider = this.getProvider(); // Use helper
      const address = account || (await this.getAccounts())[0];
      if (!address) {
        throw new Error("No account available to fetch balance.");
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
      console.error("[Web3AuthWalletAdapter] Error getting balance:", error);
      throw new Error(`Failed to get balance: ${(error as Error).message || error}`);
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
      console.log(`[Web3AuthWalletAdapter] Signature verification result for ${address}: ${result}`);
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
    console.log(`[Web3AuthWalletAdapter] Emitting ${eventName} event with:`, payload);
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
    console.log(`[Web3AuthWalletAdapter] Listener added for ${event}`);
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
      console.log(`[Web3AuthWalletAdapter] Listener removed for ${event}`);
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
    console.log("[Web3AuthWalletAdapter] Getting network");
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new Error("Not connected to Web3Auth or provider unavailable.");
    }
    try {
      const provider = this.getProvider();
      const network = await provider.getNetwork();
      console.log("[Web3AuthWalletAdapter] getNetwork result:", network);
      // Return chainId as string or number based on ICoreWallet definition
      return {
        chainId: network.chainId.toString(), // Or keep as bigint/number if interface allows
        name: network.name
      };
    } catch (error:unknown) {
      console.error("[Web3AuthWalletAdapter] Error getting network:", error);
      throw new Error(`Failed to get network: ${(error as Error).message || error}`);
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
  async setProvider(config: any): Promise<void> {
    console.log("[Web3AuthWalletAdapter] Setting provider with:", config);
    if (!this.initialized || !this.web3auth) {
      throw new Error("Web3Auth not initialized. Call initialize() first.");
    }


    // Validate required property
    if (!config.chainId) {
      throw new Error("chainId is required in ProviderConfig for Web3Auth");
    }
    try {
      console.log(`[Web3AuthWalletAdapter] Switching to chain ${config.chainId}`);

      // Try to switch to the chain directly
      // Try switching first
      try {
        await this.web3auth.switchChain({ chainId: config.chainId });
        console.log(`[Web3AuthWalletAdapter] Switched chain successfully.`);
      } catch (switchError: any) {
        console.warn(`[Web3AuthWalletAdapter] Failed to switch chain directly (${switchError.message}), attempting to add chain...`);
        // If switch fails (chain not added), try adding it.
        // We need the full chain config details from the input ProviderConfig.
        if (!config.rpcUrl || !config.displayName || !config.blockExplorer || !config.ticker || !config.tickerName) {
          throw new Error("Full chain details (rpcUrl, displayName, etc.) required in ProviderConfig to add chain.");
        }
        const chainToAdd = {
          chainId: config.chainId,
          chainNamespace: this.config.options.web3authConfig.chainConfig.chainNamespace || "eip155", // Use existing or default
          rpcTarget: config.rpcUrl,
          displayName: config.displayName,
          blockExplorer: config.blockExplorer,
          ticker: config.ticker,
          tickerName: config.tickerName,
        };
        console.log("[Web3AuthWalletAdapter] Adding chain:", chainToAdd);
        await this.web3auth.addChain(chainToAdd as any); // Cast needed
        // Now try switching again after adding
        await this.web3auth.switchChain({ chainId: config.chainId });
        console.log(`[Web3AuthWalletAdapter] Added and switched chain successfully.`);
      }

      // Force Web3Auth to refresh its provider state
      if (this.web3auth.provider) {
        await this.web3auth.provider.request({ method: "eth_chainId" });
        await this.web3auth.provider.request({ method: "eth_accounts" });
      }

       // Emit chainChanged event
       const network = await this.getNetwork(); // Get updated network info
       this.emitEvent(WalletEvent.chainChanged, network.chainId); // Emit the actual chainId
 
       // Optional: Verify connection and balance on new chain
       const accounts = await this.getAccounts();
       if (accounts.length > 0) {
         const balance = await this.getBalance(accounts[0]); // Use AssetBalance return type
         console.log(`[Web3AuthWalletAdapter] Account ${accounts[0]} balance on new chain ${network.chainId}: ${balance.formattedAmount} ${balance.symbol}`);
       }

    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Error switching chain:", error);
      throw error;
    }
  }

  /***************************/
  /** Transactions & Signing */
  /***************************/

  private async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    const signer = await this.getSigner();
    const address = await signer.getAddress();

    // Basic structure from GenericTransactionData
    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      from: address, // Set 'from' for clarity and some provider requirements
      data: String(tx.data) || undefined,
      value: (typeof tx.value === 'string' && tx.value.length > 0) ? ethers.parseUnits(tx.value, 'ether') : tx.value, // Assume 'ether' if string, needs refinement for other decimals
      // Merge adapter-specific options if they match ethers.TransactionRequest fields
      ...(tx.options || {})
    };

    // Populate missing fields if not provided in options (e.g., nonce, gas)
    if (txRequest.nonce === undefined) {
      txRequest.nonce = await signer.getNonce();
    }
    // Gas handling: Prioritize options, then estimate
    if (txRequest.gasLimit === undefined && tx.options?.gasLimit === undefined) {
        // Use estimateGas internally - requires TransactionData or adaptation
        // For now, let's skip auto-estimation in sendTransaction and require it in options or estimateGas call
        // txRequest.gasLimit = await this.estimateGas(tx as TransactionData); // Requires casting or changing estimateGas input
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
      throw new Error("Not connected to Web3Auth.");
    }

    try {
      const signer = await this.getSigner();
      const txRequest = await this.prepareTransactionRequest(tx); // Use helper

      console.log(`[Web3AuthWalletAdapter] Sending transaction:`, txRequest);
      const response = await signer.sendTransaction(txRequest);
      console.log(`[Web3AuthWalletAdapter] Transaction sent with hash: ${response.hash}`);
      return response.hash;

    } catch (error: unknown) {
      console.error("[Web3AuthWalletAdapter] Transaction error:", error);
      // Add more detailed error logging if possible
      if ((error as any).info?.error) {
        console.error("[Web3AuthWalletAdapter] Provider error details:", (error as any).info.error);
      }
      // Consider mapping to WalletErrorCode
      throw error;
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
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const signer = await this.getSigner();
      // Note: ethers v6 signTransaction expects a fully populated tx.
      // prepareTransactionRequest helps populate nonce, gas etc.
      const txRequest = await this.prepareTransactionRequest(tx);

      console.log(`[Web3AuthWalletAdapter] Signing transaction:`, txRequest);
      // signTransaction is often not available/reliable via browser providers/Web3Auth
      // Check if signer actually supports it.
      if (typeof (signer as any).signTransaction !== 'function') {
          throw new Error("signTransaction method not supported by the current signer/provider.");
      }
      const signedTx = await (signer as any).signTransaction(txRequest);
      console.log(`[Web3AuthWalletAdapter] Transaction signed.`);
      return signedTx;
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Sign transaction error:", error);
        throw error;
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
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const signer = await this.getSigner();
      console.log(`[Web3AuthWalletAdapter] Signing message...`);
      const signature = await signer.signMessage(message);
      console.log(`[Web3AuthWalletAdapter] Message signed.`);
      return signature;
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Sign message error:", error);
        throw error;
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
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const signer = await this.getSigner();
      console.log(`[Web3AuthWalletAdapter] Signing typed data...`, data);
      // Ensure the primary data field is named 'message' as per our EIP712TypedData interface
      const signature = await signer.signTypedData(data.domain, data.types, data.value);
      console.log(`[Web3AuthWalletAdapter] Typed data signed.`);
      return signature;
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Sign typed data error:", error);
        throw error;
    }
  }

  /**
  * Gets the current gas price
  * @returns Promise resolving to the gas price as a string
  * @throws Error if wallet is not connected or gas price is unavailable
  */
  async getGasPrice(): Promise<bigint> { // Return bigint as per ethers v6
    if (!this.isConnected()) {
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const provider = this.getProvider();
      const feeData = await provider.getFeeData();
      if (!feeData.gasPrice) {
        throw new Error("gasPrice not available from provider.");
      }
      return feeData.gasPrice;
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Get gas price error:", error);
        throw error;
    }
  }

  /**
   * Estimates gas for a transaction
   * @param tx The transaction to estimate gas for
   * @returns Promise resolving to the estimated gas as a string
   * @throws Error if wallet is not connected
   */
  async estimateGas(tx: GenericTransactionData): Promise<bigint> { // Return bigint
    if (!this.isConnected()) {
      throw new Error("Not connected to Web3Auth.");
    }

    try {
      const provider = this.getProvider();
      // Convert TransactionData to ethers.TransactionRequest if needed
      const txParams: ethers.TransactionRequest = {
        to: tx.to,
        value: (typeof tx.value === 'string' && tx.value.length > 0) ? ethers.parseUnits(tx.value, 'ether') : tx.value, // Assume ether
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined, // Handle Uint8Array
        ...(tx.options || {})
      };
      // Remove fields estimateGas might not want
      delete txParams.nonce;
      delete txParams.gasPrice;
      delete txParams.maxFeePerGas;
      delete txParams.maxPriorityFeePerGas;
      delete txParams.gasLimit;

      console.log(`[Web3AuthWalletAdapter] Estimating gas for:`, txParams);
      const gasEstimate = await provider.estimateGas(txParams);
      console.log(`[Web3AuthWalletAdapter] Gas estimate: ${gasEstimate.toString()}`);
      return gasEstimate;
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Estimate gas error:", error);
        throw error;
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
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const provider = this.getProvider();
      console.log(`[Web3AuthWalletAdapter] Getting receipt for tx: ${txHash}`);
      const receipt = await provider.getTransactionReceipt(txHash);
      console.log(`[Web3AuthWalletAdapter] Receipt result:`, receipt);
      return receipt; // Can be null if not mined
    } catch (error: unknown) {
        console.error("[Web3AuthWalletAdapter] Get transaction receipt error:", error);
        throw error;
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
      throw new Error("Not connected to Web3Auth.");
    }
    try {
      const provider = this.getProvider();
      const targetAccount = account || (await this.getAccounts())[0];
      if (!targetAccount) {
        throw new Error("No account available to fetch token balance.");
      }

      const erc20Abi = abi || ["function balanceOf(address) view returns (uint256)"];
      const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);

      console.log(`[Web3AuthWalletAdapter] Getting token balance for ${tokenAddress} on account ${targetAccount}`);
      const balance = await contract.balanceOf(targetAccount);
      console.log(`[Web3AuthWalletAdapter] Token balance result: ${balance.toString()}`);
      return balance.toString(); // Return raw balance string
    } catch (error: unknown) {
        console.error(`[Web3AuthWalletAdapter] Get token balance error for ${tokenAddress}:`, error);
        throw error;
    }
  }
}