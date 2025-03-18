import { ethers, HDNodeWallet, Provider } from "ethers";
import { ICoreWallet } from "../types/interfaces";

interface args {
  privateKey?: string,
  provider?: Provider
}

export class MockedWalletAdapter implements ICoreWallet {
  private wallet: HDNodeWallet;
  private provider?: Provider;
  private privateKey: string;

  constructor(args: args) {
    const { privateKey, provider } = args;

    if (!privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
      this.wallet = new ethers.Wallet(this.privateKey) as unknown as HDNodeWallet;
    } else {
      this.privateKey = privateKey;
      this.wallet = new ethers.Wallet(privateKey) as unknown as HDNodeWallet;
    }

    if (provider) {
      this.setProvider(provider);
    }

  }

  async initialize(): Promise<void> {
    // For EVM, initialization is immediate.
    return;
  }

  setProvider(provider: Provider): void {
    this.provider = provider;
    this.wallet = this.wallet.connect(provider);
  }

  // CoreWallet-like methods
  getWalletName(): string {
    return "MockedWalletAdapter";
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

  on(event: any, callback: (...args: any[]) => void): void {
    console.warn("Event handling not implemented in MockedWalletAdapter");
  }

  off(event: any, callback: (...args: any[]) => void): void {
    console.warn("Event handling not implemented in MockedWalletAdapter");
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
  getPrivateKey(): string {
    return this.privateKey;
  }
}