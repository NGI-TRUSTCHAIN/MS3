import { ethers, Provider, Wallet as EthersWallet } from "ethers";
import { EVMWallet } from "../types/interfaces/EVM";

type TransactionData = { from: string; to: string; value: string; data?: string };

export class EvmWalletAdapter implements EVMWallet{
  private wallet: EthersWallet;
  private provider?: Provider;
  private privateKey: string;

  constructor(privateKey?: string, provider?: Provider) {
    if (!privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
      this.wallet = new EthersWallet(this.privateKey);
    } else {
      this.privateKey = privateKey;
      this.wallet = new EthersWallet(privateKey);
    }
    if (provider) {
      this.setProvider(provider);
    }
    console.log("EvmWalletAdapter created. PrivateKey:", this.privateKey);
  }

  async initialize(): Promise<void> {
    // For EVM, initialization is immediate.
    return;
  }
  
  setProvider(provider: Provider): void {
    this.provider = provider;
    (this.wallet as any) = this.wallet.connect(provider)
  }

  // CoreWallet methods

  getWalletName(): string {
    return "EvmWalletAdapter";
  }

  getWalletVersion(): string {
    return "1.0.0";
  }

  isConnected(): boolean {
    return !!this.provider;
  }

  async requestAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  on(event: string, callback: (...args: any[]) => void): void {
    console.warn("Event handling not implemented in EvmWalletAdapter");
  }

  off(event: string, callback: (...args: any[]) => void): void {
    console.warn("Event handling not implemented in EvmWalletAdapter");
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }
    const network = await this.provider.getNetwork();
    return { chainId: String(network.chainId), name: network.name };
  }

  async switchNetwork(_chainId: string): Promise<boolean> {
    return true;
  }

  async signTransaction(tx: any): Promise<string> {
    if (!this.wallet || !this.provider) {
      throw new Error("Wallet or provider not available. Please connect first.");
    }
    // Convert fractional ETH value if needed
    if (typeof tx.value === 'string' && tx.value.includes('.')) {
      tx = { ...tx, value: ethers.parseEther(tx.value).toString() };
    }
    return await this.wallet.signTransaction(tx);
  }

  async sendTransaction(tx: any): Promise<string> {
    if (!this.wallet || !this.provider) {
      throw new Error("Wallet or provider not available. Please connect first.");
    }
    // Convert fractional ETH value if needed
    if (typeof tx.value === 'string' && tx.value.includes('.')) {
      tx = { ...tx, value: ethers.parseEther(tx.value).toString() };
    }
    const response = await this.wallet.sendTransaction(tx);
    return response.hash;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not available.");
    return await this.wallet.signMessage(message);
  }

  // Optionally implement signTypedData if needed
  async signTypedData(data: { domain: any; types: any; value: any }, version?: string): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not available.");
    return await this.wallet.signTypedData(data.domain, data.types, data.value);
  }

  // Additional EVM extension methods
  async getGasPrice(): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }
    const feeData = await this.provider.getFeeData();
    if (!feeData.gasPrice) {
      throw new Error("gasPrice not available");
    }
    return feeData.gasPrice.toString();
  }

  async estimateGas(tx: TransactionData): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }
    const estimate = await this.provider.estimateGas({
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x"
    });
    return estimate.toString();
  }

  getPrivateKey(): string {
    return this.privateKey;
  }
}