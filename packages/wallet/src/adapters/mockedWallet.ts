import { ethers, Wallet as EthersWallet, Provider } from "ethers";
import { ICoreWallet, WalletEvent } from "../types";

interface args {
  privateKey?: string,
  provider?: Provider
}

export class MockedWalletAdapter implements ICoreWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
 * Static factory method for creating and initializing an adapter in one step
 * @param args Configuration parameters
 * @returns A fully initialized EvmWalletAdapter instance
 */
  static async create(args: args): Promise<MockedWalletAdapter> {
    const adapter = new MockedWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  private constructor(args: args) {
    const { privateKey, provider } = args;
    // Handle both old and new parameter styles

    if (!privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
    } else {
      this.privateKey = privateKey;
    }

    if (provider) {
      this.provider = provider;
    }

    console.log("EvmWalletAdapter created. PrivateKey:", this.privateKey);
  }

  /**
    * Initialize the wallet adapter
    * @returns The adapter instance for chaining
    */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.wallet = new ethers.Wallet(this.privateKey);
    
    if (this.provider) {
      this.wallet = this.wallet.connect(this.provider);
    }
    this.initialized = true;
  }


  setProvider(provider: Provider): void {
    this.provider = provider;
    // Add defensive check
    if (this.wallet) {
      this.wallet = this.wallet.connect(provider);
    }
  }
  // CoreWallet-like methods
  getWalletName(): string {
    return "MockedWalletAdapter";
  }

  getWalletVersion(): string {
    return "1.0.0";
  }

  isConnected(): boolean {
    return !!this.provider && !!this.wallet?.provider;
  }

  // Update request accounts to emit event
  async requestAccounts(): Promise<string[]> {
    const accounts = [this.wallet.address];
    this.emitEvent(WalletEvent.accountsChanged, accounts);
    return accounts;
  }

  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
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

  on(event: any, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: any, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }
    const network = await this.provider.getNetwork();
    return { chainId: String(network.chainId), name: network.name };
  }

  async sendTransaction(tx: any): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set. Call setProvider() first.");
    }
    if (!tx.to) {
      throw new Error("Transaction object missing 'to' address");
    }
    // Convert value if fractional string provided.
    const txValue =
      typeof tx.value === "string" && tx.value.includes(".")
        ? ethers.parseEther(tx.value).toString()
        : tx.value;
    const response = await this.wallet.sendTransaction({
      to: tx.to,
      value: txValue,
      data: tx.data || "0x",
    });
    return response.hash;
  }

  async signTransaction(tx: any): Promise<string> {
    const populatedTx = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x",
      gasLimit: 21000n
    };
    return await this.wallet.signTransaction(populatedTx);
  }

  async signMessage(message: string): Promise<string> {
    return await this.wallet.signMessage(message);
  }

  // Expose the private key
  async getPrivateKey(): Promise<string> {
    return this.privateKey;
  }
}