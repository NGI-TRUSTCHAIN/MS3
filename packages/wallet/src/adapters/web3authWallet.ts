import { Web3AuthNoModal } from "@web3auth/no-modal";
import { WALLET_ADAPTERS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers, BrowserProvider, TransactionReceipt } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { WalletEvent, IEVMWallet, TypedData, TransactionData } from "../types";

interface args {
  adapterName: string;
  options: {
    web3authConfig: {
      clientId: string,
      web3AuthNetwork: string,
      chainConfig: {
        chainNamespace: string,
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
  private provider: any = null;
  private ethersProvider: BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private accounts: string[] = [];
  private initialized = false;
  private config: args;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  /** General Initialization */

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
  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log("Web3Auth initializing with config:", JSON.stringify(this.config, null, 2));

    // Extract configuration
    const { clientId, web3AuthNetwork, chainConfig } = this.config.options.web3authConfig;

    if (!chainConfig) {
      throw new Error("Invalid provider Config, Please provide chainConfig");
    }

    try {
      // Create the private key provider with proper chain config
      const privateKeyProvider = new EthereumPrivateKeyProvider({
        config: { chainConfig: chainConfig as any }
      });

      console.log("Initializing Web3AuthNoModal...");
      this.web3auth = new Web3AuthNoModal({
        clientId: clientId,
        web3AuthNetwork: web3AuthNetwork as any,
        chainConfig: chainConfig as any,
        privateKeyProvider
      });

      // Configure the openlogin adapter
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
      this.accounts = [];
      this.ethersProvider = null;
      this.signer = null;
    }
  }


  /** Wallet Metadata */

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

  /** Account Management */

  /**
     * Requests user accounts and triggers Web3Auth login flow if not already connected
     * @returns Promise resolving to an array of account addresses
     * @throws Error if connection fails or provider is not available
     */
  async requestAccounts(): Promise<string[]> {
    if (!this.initialized || !this.web3auth) {
      throw new Error("Web3Auth not initialized");
    }

    // If already connected and have accounts, return them
    if (this.web3auth.connected && this.accounts.length > 0) {
      return this.accounts;
    }

    try {
      // Connect using Web3Auth's connectTo method with the login provider
      const loginProvider = this.config.options.web3authConfig.loginConfig.loginProvider;
      console.log(`Connecting to Web3Auth with ${loginProvider}`);

      await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, {
        loginProvider
      });

      if (!this.web3auth.connected) {
        throw new Error("Failed to connect to Web3Auth");
      }

      // Get the Ethereum address using the provider's request method
      const provider = this.web3auth.provider;
      if (!provider) {
        throw new Error("Provider not available after login");
      }

      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      this.accounts = accounts;

      // Set up ethers provider for other operations
      this.ethersProvider = new ethers.BrowserProvider(provider);
      this.signer = await this.ethersProvider.getSigner();

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
    // If we don't have accounts yet, request them
    if (!this.accounts.length && this.web3auth?.connected) {
      const provider = this.web3auth.provider;
      if (!provider) {
        return [];
      }
      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      this.accounts = accounts;
      return accounts;
    }
    return this.accounts;
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

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    const accounts = await this.getAccounts();
    const address = account || accounts[0];
    const balance = await this.ethersProvider.getBalance(address);
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

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    const accounts = await this.getAccounts();
    const address = accounts[0];
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
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

    // Set up provider event listeners when available
    if (this.web3auth?.provider && 'on' in this.web3auth.provider) {
      if (event === WalletEvent.accountsChanged) {
        this.web3auth.provider.on('accountsChanged', (accounts: string[]) => {
          this.accounts = accounts;
          callback(accounts);
        });
      }

      if (event === WalletEvent.chainChanged) {
        this.web3auth.provider.on('chainChanged', (chainId: string) => {
          callback(chainId);
        });
      }
    }
  }

  /**
   * Removes an event listener
   * @param event The event to remove the listener from
   * @param callback The callback function to remove
   */
  off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }

    // Remove provider event listeners if applicable
    if (this.web3auth?.provider && 'removeListener' in this.web3auth.provider) {
      if (event === WalletEvent.accountsChanged || event === WalletEvent.chainChanged) {
        (this.web3auth.provider as any).removeListener(event, callback);
      }
    }
  }

  /** Network Management */

  /**
 * Gets network information
 * @returns Promise resolving to an object with chainId and optional name properties
 * @throws Error if provider is not available
 */
  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.web3auth?.provider) {
      throw new Error("Provider not available");
    }

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider);
    }

    const network = await this.ethersProvider.getNetwork();
    return {
      chainId: network.chainId.toString(),
      name: network.name
    };
  }

  /**
   * Sets the provider for the wallet
   * @param provider The provider to set
   */
  setProvider(provider: BrowserProvider): void {
    this.ethersProvider = provider;
  }


  /** Transactions & Signing */

  /**
     * Sends a transaction
     * @param tx The transaction to send
     * @returns Promise resolving to the transaction hash
     * @throws Error if wallet is not connected
     */
  async sendTransaction(tx: any): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    if (!this.signer) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
      this.signer = await this.ethersProvider.getSigner();
    }

    const transaction = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x"
    };

    const response = await this.signer.sendTransaction(transaction);
    return response.hash;
  }

  /**
   * Signs a transaction without sending it
   * @param tx The transaction to sign
   * @returns Promise resolving to the signed transaction as a hex string
   * @throws Error if wallet is not connected
   */
  async signTransaction(tx: any): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    if (!this.signer) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
      this.signer = await this.ethersProvider.getSigner();
    }

    const transaction = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x",
      gasLimit: 21000n
    };

    return await this.signer.signTransaction(transaction);
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

    if (!this.signer) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
      this.signer = await this.ethersProvider.getSigner();
    }

    return await this.signer.signMessage(message);
  }

  /** EVM-Specific Features */

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

    if (!this.signer) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
      this.signer = await this.ethersProvider.getSigner();
    }

    return await this.signer.signTypedData(data.domain, data.types, data.value);
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

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    const feeData = await this.ethersProvider.getFeeData();
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

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    const gasEstimate = await this.ethersProvider.estimateGas({
      to: tx.to,
      value: tx.value ? ethers.parseEther(String(tx.value)) : 0n,
      data: tx.data || "0x"
    });

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

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    return await this.ethersProvider.getTransactionReceipt(txHash) as TransactionReceipt;
  }

  /**
   * Gets the token balance for an ERC20 token
   * @param tokenAddress The token contract address
   * @param account Optional account address, uses connected account if not specified
   * @returns Promise resolving to the token balance as a string
   * @throws Error if wallet is not connected
   */
  async getTokenBalance(tokenAddress: string, account?: string): Promise<string> {
    if (!this.web3auth?.connected) {
      throw new Error("Not connected to Web3Auth");
    }

    if (!this.ethersProvider) {
      this.ethersProvider = new ethers.BrowserProvider(this.web3auth.provider as any);
    }

    // Get the account to check balance for
    if (!account) {
      if (this.accounts.length === 0) {
        await this.getAccounts();
      }
      account = this.accounts[0];
    }

    if (!account) {
      throw new Error("No account available");
    }

    // ERC20 standard ABI for balanceOf
    const abi = [
      "function balanceOf(address owner) view returns (uint256)"
    ];

    const contract = new ethers.Contract(tokenAddress, abi, this.ethersProvider);
    const balance = await contract.balanceOf(account);
    return balance.toString();
  }
}