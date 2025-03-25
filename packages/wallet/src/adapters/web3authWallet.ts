import { Web3AuthNoModal } from "@web3auth/no-modal";
import { ChainNamespaceType, WALLET_ADAPTERS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers, TransactionReceipt } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { IEVMWallet, TransactionData, TypedData, WalletEvent } from "../types/index.js";

interface args {
  adapterName: string;
  options: {
    web3authConfig: {
      clientId: string,
      web3AuthNetwork: string,
      chainConfig: {
        chainNamespace: ChainNamespaceType,
        chainId: string,
        rpcTarget: string,
        displayName: string,
        blockExplorer: string,
        ticker: string,
        tickerName: string
      },
      loginConfig: {
        loginProvider: string
      }
    }
  }
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
    await adapter.initialize();
    return adapter;
  }

  /**
   * Initialize the Web3AuthNoModal instance with the provided configuration.
   * @throws Error if initialization fails or chainConfig is missing
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
    } catch (error) {
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
    if (this.web3auth) {
      await this.web3auth.logout();
    }
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
    return "1.0.0";
  }

  /**
   * Checks if the wallet is connected
   * @returns True if the wallet is connected, otherwise false
   */
  isConnected(): boolean {
    return !!this.web3auth?.connected;
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
        const provider = this.web3auth.provider;
        if (!provider) {
          throw new Error("Provider not available despite being connected");
        }

        const accounts = await provider.request({ method: "eth_accounts" }) as string[];
        // this.accounts = accounts;
        this.emitEvent(WalletEvent.accountsChanged, accounts);
        return accounts;
      }

      // Login flow
      const loginProvider = this.config.options.web3authConfig.loginConfig.loginProvider;
      await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });

      if (!this.web3auth.connected) {
        throw new Error("Failed to connect to Web3Auth");
      }

      const accounts = await this.web3auth.provider!.request({
        method: "eth_accounts"
      }) as string[];

      // this.accounts = accounts;
      this.emitEvent(WalletEvent.accountsChanged, accounts);
      return accounts;
    } catch (error) {
      console.error("Error requesting accounts:", error);
      throw error;
    }
  }

  /**
   * Gets the private key from Web3Auth
   * @returns Promise resolving to the private key
   * @throws Error if wallet is not connected or private key is unavailable
   */
  async getPrivateKey(): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    try {
      const privateKey = await this.web3auth.provider!.request({
        method: "eth_private_key"
      });

      return privateKey as string;
    } catch (error) {
      console.error("Error getting private key:", error);
      throw new Error("Unable to get private key from Web3Auth");
    }
  }

  /**
 * Gets the current accounts without triggering login flow
 * @returns Promise resolving to an array of account addresses
 */
  async getAccounts(): Promise<string[]> {

    const provider = this.web3auth!.provider;

    if (!provider) {
      return [];
    }

    const accounts = await provider.request({ method: "eth_accounts" }) as string[];
    return accounts;

  }

  /**
   * Gets the balance of the specified account
   * @param account The account address (optional, defaults to the first account)
   * @returns Promise resolving to the balance in ether
   * @throws Error if wallet is not connected or balance retrieval fails
   * */
  async getBalance(account?: string): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);
    const accounts = await this.getAccounts();
    const address = account || accounts[0];
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Verifies the signature of a message
   * @param message The message to verify
   * @param signature The signature to verify against
   * @returns Promise resolving to true if the signature is valid, otherwise false
   */
  async verifySignature(message: string, signature: string): Promise<boolean> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);
    const accounts = await this.getAccounts();
    const address = accounts[0];
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  }

  /**
   * Emits an event with the specified name and payload
   * @param eventName The name of the event to emit
   * @param payload The payload to pass to the event listeners
   */
  private emitEvent(eventName: WalletEvent, payload: any): void {
    console.log(`[Web3AuthWalletAdapter] Emitting ${eventName} event with:`, payload);

    const listeners = this.eventListeners.get(eventName);
    if (listeners && listeners.size > 0) {
      console.log(`[Web3AuthWalletAdapter] Found ${listeners.size} listeners for ${eventName}`);
      listeners.forEach(callback => {
        try {
          callback(payload);
          console.log(`[Web3AuthWalletAdapter] Successfully called listener for ${eventName}`);
        } catch (error) {
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
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // IMPORTANT: For Web3Auth, we need to listen directly on our emitEvent calls
    // since the provider doesn't reliably emit these events
    console.log(`Setting up provider event listener for ${event}`);

    // No need to set up provider listeners, we'll emit events manually
    // in our methods like requestAccounts and setProvider
  }

  /**
   * Removes an event listener
   * @param event The event to remove the listener from
   * @param callback The callback function to remove
   */
  off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
      console.log(`[Web3AuthWalletAdapter] Removed listener for ${event}`);
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
    if (!this.web3auth?.provider) {
      throw new Error("Provider not available");
    }
    const provider = new ethers.BrowserProvider(this.web3auth.provider);
    const network = await provider.getNetwork();
    console.log("[Web3AuthWalletAdapter] Network result:", network);
    return {
      chainId: network.chainId.toString(),
      name: network.name
    };
  }

  /**
 * Gets a fresh provider from the current Web3Auth instance
 * @returns A new provider using the current Web3Auth state
 */
  private getProvider(): ethers.BrowserProvider {
    if (!this.web3auth?.provider) {
      throw new Error("Web3Auth provider not available");
    }
    return new ethers.BrowserProvider(this.web3auth.provider as any);
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
      throw new Error("Web3Auth not initialized");
    }

    // Validate required property
    if (!config.chainId) {
      throw new Error("chainId is required in provider config");
    }

    try {
      console.log(`[Web3AuthWalletAdapter] Switching to chain ${config.chainId}`);
  
      // Try to switch to the chain directly
      try {
        await this.web3auth.switchChain({ chainId: config.chainId });
      } catch (error) {
        console.log("[Web3AuthWalletAdapter] Chain not found, adding it first");
        // Add the chain if it doesn't exist
        await this.web3auth.addChain(config);
        await this.web3auth.switchChain({ chainId: config.chainId });
      }
  
      // Force Web3Auth to refresh its provider state
      if (this.web3auth.provider) {
        await this.web3auth.provider.request({ method: "eth_chainId" });
        await this.web3auth.provider.request({ method: "eth_accounts" });
      }
  
      const network = await this.getNetwork();
      console.log(`[Web3AuthWalletAdapter] Successfully switched to chain ${network.chainId} (${network.name})`);
  
      // Account balance check
      const accounts = await this.getAccounts();
      if (accounts.length > 0) {
        const balance = await this.getBalance(accounts[0]);
        console.log(`[Web3AuthWalletAdapter] Account ${accounts[0]} balance on new chain: ${balance} ETH`);
      }
  
      this.emitEvent(WalletEvent.chainChanged, config.chainId);
    } catch (error) {
      console.error("[Web3AuthWalletAdapter] Error switching chain:", error);
      throw error;
    }
  }

  /***************************/
  /** Transactions & Signing */
  /***************************/

  /**
   * Sends a transaction
   * @param tx The transaction to send
   * @returns Promise resolving to the transaction hash
   * @throws Error if wallet is not connected
   */
  async sendTransaction(tx: TransactionData): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    // Force provider state refresh before getting signer
    if (this.web3auth.provider) {
      await this.web3auth.provider.request({ method: "eth_chainId" });
      await this.web3auth.provider.request({ method: "eth_accounts" });
    }

    // Get fresh signer and address
    const signer = await this.getSigner();
    const address = await signer.getAddress();

    // Get diagnostic info using helper methods
    try {
      const network = await this.getNetwork();

      // Get balance directly from provider for consistency
      const rawBalance = await this.web3auth.provider!.request({
        method: "eth_getBalance",
        params: [address, "latest"]
      }) as string;
      const balance = ethers.formatEther(rawBalance);

      console.log(`[Web3AuthWalletAdapter] Network: ${network.name} (${network.chainId})`);
      console.log(`[Web3AuthWalletAdapter] Account: ${address}`);
      console.log(`[Web3AuthWalletAdapter] Balance: ${balance} ETH`);

      // Create transaction object with proper value handling
      const txRequest = { ...tx };

      if (txRequest.value && typeof txRequest.value === 'string') {
        txRequest.value = ethers.parseEther(txRequest.value);
      }

      if (!txRequest.data) txRequest.data = "0x";

      // Get explicit gas information for better error diagnosis
      const gasPrice = await signer.provider!.getFeeData().then(data => data.gasPrice || null);
      const gasLimit = tx.gasLimit || await this.estimateGas(tx).catch(() => "21000");

      const txCost = {
        gasPrice: gasPrice ? gasPrice.toString() : "unknown",
        gasLimit: gasLimit,
        value: txRequest.value ? txRequest.value.toString() : "0",
        totalCost: gasPrice && txRequest.value
          ? (BigInt(gasPrice.toString()) * BigInt(gasLimit) + BigInt(txRequest.value.toString())).toString()
          : "unknown",
        hasEnoughFunds: gasPrice && rawBalance
          ? BigInt(rawBalance) >= (BigInt(gasPrice.toString()) * BigInt(gasLimit) + BigInt(txRequest.value?.toString() || "0"))
          : "unknown"
      };

      console.log(`[Web3AuthWalletAdapter] Transaction cost estimate:`, txCost);

      // Send the transaction
      console.log(`[Web3AuthWalletAdapter] Sending transaction:`, txRequest);
      const response = await signer.sendTransaction(txRequest);

      console.log(`[Web3AuthWalletAdapter] Transaction sent with hash: ${response.hash}`);
      return response.hash;
    } catch (error: any) {
      console.error("[Web3AuthWalletAdapter] Transaction error:", error);

      if (error.info?.error) {
        console.error("[Web3AuthWalletAdapter] Provider error details:", error.info.error);
      }

      if (error.message && error.message.includes("insufficient funds") && this.web3auth.provider) {
        // Try to get the real balance one more time to help diagnose
        try {
          const rawBalance = await this.web3auth.provider.request({
            method: "eth_getBalance",
            params: [address, "latest"]
          }) as string;
          console.error(`[Web3AuthWalletAdapter] Confirmed balance at failure: ${ethers.formatEther(rawBalance)} ETH`);
        } catch (e) {
          console.error("[Web3AuthWalletAdapter] Failed to get balance for error diagnosis");
        }
      }

      throw error;
    }
  }

  /**
   * Signs a transaction without sending it
   * @param tx The transaction to sign
   * @returns Promise resolving to the signed transaction as a hex string
   * @throws Error if wallet is not connected
   */
  async signTransaction(tx: TransactionData): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const signer = await this.getSigner();
    const transaction = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(String(tx.value)) : 0n,
      data: tx.data || "0x",
      gasLimit: 21000n
    };
    return await signer.signTransaction(transaction);
  }

  /**
 * Gets a fresh signer from the current Web3Auth provider
 * @returns A promise resolving to a new signer
 */
  private async getSigner(): Promise<ethers.Signer> {
    const provider = this.getProvider();
    return await provider.getSigner();
  }

  /**
   * Signs a message
   * @param message The message to sign
   * @returns Promise resolving to the signature
   * @throws Error if wallet is not connected
   */
  async signMessage(message: string): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const signer = await this.getSigner();
    return await signer.signMessage(message);
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
  async signTypedData(data: TypedData): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const signer = await this.getSigner();
    return await signer.signTypedData(data.domain, data.types, data.value);
  }

  /**
  * Gets the current gas price
  * @returns Promise resolving to the gas price as a string
  * @throws Error if wallet is not connected or gas price is unavailable
  */
  async getGasPrice(): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);
    const feeData = await provider.getFeeData();
    if (!feeData.gasPrice) {
      throw new Error("gasPrice not available");
    }
    return feeData.gasPrice.toString();
  }

  /**
   * Estimates gas for a transaction
   * @param tx The transaction to estimate gas for
   * @returns Promise resolving to the estimated gas as a string
   * @throws Error if wallet is not connected
   */
  async estimateGas(tx: TransactionData): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);

    // Forward the transaction directly, only setting defaults for required fields
    const txParams = {
      ...tx,
      to: tx.to,
      value: tx.value ? (
        typeof tx.value === 'string' ?
          ethers.parseEther(String(tx.value)) :
          tx.value
      ) : 0n,
      data: tx.data || "0x"
    };

    const gasEstimate = await provider.estimateGas(txParams);
    return gasEstimate.toString();
  }

  /**
  * Gets the transaction receipt for a transaction hash
  * @param txHash The transaction hash
  * @returns Promise resolving to the transaction receipt
  * @throws Error if wallet is not connected
  */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }
    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);
    return await provider.getTransactionReceipt(txHash) as TransactionReceipt;
  }

  /**
   * Gets the token balance for an ERC20 token
   * @param tokenAddress The token contract address
   * @param account Optional account address, uses connected account if not specified
   * @returns Promise resolving to the token balance as a string
   * @throws Error if wallet is not connected
   */
  async getTokenBalance(
    tokenAddress: string,
    account?: string,
    abi?: string[]
  ): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    const provider = new ethers.BrowserProvider(this.web3auth.provider as any);

    if (!account) {
      const accounts = await this.getAccounts();

      if (accounts.length === 0) {
        await this.getAccounts();
      }

      account = accounts[0];
    }

    if (!account) {
      throw new Error("No account available");
    }

    const erc20Abi = abi || [
      "function balanceOf(address) view returns (uint256)"
    ];

    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const balance = await contract.balanceOf(account);
    return balance.toString();
  }
}