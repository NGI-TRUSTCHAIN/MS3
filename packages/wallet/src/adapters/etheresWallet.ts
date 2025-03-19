import { ethers, Provider, Wallet as EthersWallet } from "ethers";
import { EVMWallet } from "../types/interfaces/EVM";
import { TransactionData, WalletEvent } from "../types";

// Define always the constructor arguments in a type.
interface args {
  privateKey?: string,
  provider?: Provider
}
export class EvmWalletAdapter implements EVMWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  /**
  * Checks if the adapter is initialized and throws if not
  * @throws Error if adapter is not initialized
  */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Adapter not initialized. Call initialize() first.");
    }
  }

  /**
   * Checks if provider is set and throws if not
   * @throws Error if provider is not set
   */
  protected ensureProvider(): void {
    if (!this.provider) {
      throw new Error("Provider not set. Call setProvider() first.");
    }
  }

  /**
   * Checks if wallet is available and throws if not
   * @throws Error if wallet is not available
   */
  protected ensureWallet(): void {
    if (!this.wallet) {
      throw new Error("Wallet not available.");
    }
  }

  /**
 * Static factory method for creating and initializing an adapter in one step
 * @param args Configuration parameters
 * @returns A fully initialized EvmWalletAdapter instance
 */
  static async create(args: args): Promise<EvmWalletAdapter> {
    const adapter = new EvmWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  private constructor(args: args) {
    const { privateKey, provider: optionsProvider } = args;
    // Handle both old and new parameter styles

    if (!privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
    } else {
      this.privateKey = privateKey;
    }

    if (optionsProvider) {
      this.provider = optionsProvider;
    }

    console.log("EvmWalletAdapter created. PrivateKey:", this.privateKey);
  }

  // Helper method to process transaction values consistently
  private processTransactionValue(tx: TransactionData): TransactionData {
    if (typeof tx.value === 'string' && tx.value.includes('.')) {
      return { ...tx, value: ethers.parseEther(tx.value).toString() };
    }
    return tx;
  }

  /**
    * Initialize the wallet adapter
    * @returns The adapter instance for chaining
    */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.wallet = new EthersWallet(this.privateKey);
    
    if (this.provider) {
      this.wallet = this.wallet.connect(this.provider);
    }
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setProvider(provider: Provider): void {
    this.provider = provider;

    // Reconnect the wallet with the new provider
    if (this.wallet) {
      this.wallet = this.wallet.connect(provider);
    }
  }

  getWalletName(): string {
    return "EvmWalletAdapter";
  }

  getWalletVersion(): string {
    return "1.0.0";
  }

  isConnected(): boolean {
    return !!this.provider && !!this.wallet?.provider;
  }

   // Update any methods that should emit events
   async requestAccounts(): Promise<string[]> {
    const accounts = [this.wallet.address];
    // When accounts are requested, emit accountsChanged event
    this.emitEvent(WalletEvent.accountsChanged, accounts);
    return accounts;
  }

  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  on(event: string, callback: (payload: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    // Setup provider event listeners (if applicable)
    if (this.provider && 'on' in this.provider) {
      if (event === WalletEvent.chainChanged) {
        // Map chainChanged event from provider to our format
        this.provider.on('network', (newNetwork: any) => {
          this.emitEvent(WalletEvent.chainChanged, String(newNetwork.chainId));
        });
      }
    }
  }

  // Helper method to emit events
  private emitEvent(event: string, payload: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }
  
  off(event: string, callback: (payload: unknown) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    this.ensureProvider();

    const network = await this.provider!.getNetwork();
    return { chainId: String(network.chainId), name: network.name };
  }

  async signTransaction(tx: any): Promise<string> {
    this.ensureInitialized();
    this.ensureProvider();
    this.ensureWallet();

    const processedTx = this.processTransactionValue(tx);
    return await this.wallet.signTransaction(processedTx);
  }

  async sendTransaction(tx: any): Promise<string> {
    this.ensureInitialized();
    this.ensureProvider();
    this.ensureWallet();

    const processedTx = this.processTransactionValue(tx);
    const response = await this.wallet.sendTransaction(processedTx);
    return response.hash;
  }

  async signMessage(message: string): Promise<string> {
    this.ensureWallet();

    return await this.wallet.signMessage(message);
  }

  // Optionally implement signTypedData if needed
  async signTypedData(data: { domain: any; types: any; value: any }, version?: string): Promise<string> {
    this.ensureWallet();
    return await this.wallet.signTypedData(data.domain, data.types, data.value);
  }

  // Additional EVM extension methods
  async getGasPrice(): Promise<string> {
    this.ensureInitialized();
    this.ensureProvider();

    const feeData = await this.provider!.getFeeData();
    if (!feeData.gasPrice) {
      throw new Error("gasPrice not available");
    }
    return feeData.gasPrice.toString();
  }

  async estimateGas(tx: TransactionData): Promise<string> {
    this.ensureInitialized();
    this.ensureProvider();
    const estimate = await this.provider!.estimateGas({
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value.toString()) : 0n,
      data: tx.data || "0x"
    });
    return estimate.toString();
  }

  async getPrivateKey(): Promise<string> {
    return this.privateKey;
  }
}