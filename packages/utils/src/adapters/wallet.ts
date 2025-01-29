import { ethers, HDNodeWallet, JsonRpcProvider, Provider } from "ethers";
// Adjust import paths as needed

export class MockedWalletAdapter {
  private wallet: HDNodeWallet;
  private provider?: JsonRpcProvider;

  constructor(provider?: Provider) {
    this.wallet = ethers.Wallet.createRandom();

    if (provider) {
      this.setProvider(provider);
    }

    // Debug instance creation
    console.log("5. MockedWalletAdapter methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(this)));
  }

  setProvider(provider: any): void {
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
    // Mocked logic
    return true;
  }

  async requestAccounts(): Promise<string[]> {
    // Mocked logic: same address
    return [this.wallet.address];
  }

  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  on(event: any, callback: (...args: any[]) => void): void {
    // No-op for mocked adapter
  }

  off(event: any, callback: (...args: any[]) => void): void {
    // No-op for mocked adapter
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    // Mocked logic: Ethereum Mainnet
    return { chainId: "0x1", name: "homestead" };
  }

  async switchNetwork(_chainId: string): Promise<boolean> {
    // Mocked logic: do nothing
    return true;
  }

  async sendTransaction(tx: any): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set. Call setProvider first.");
    }

    try {
      const transaction = {
        to: tx.to,
        value: tx.value ? ethers.parseEther(tx.value) : 0n,
        data: tx.data || '0x'
      };

      const response = await this.wallet.sendTransaction(transaction);
      return response.hash;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  async signTransaction(tx: any): Promise<string> {
    // Create a populated transaction, then sign (but do not send).
    const populatedTx = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data,
      gasLimit: 21000 // mock
    };
    return this.wallet.signTransaction(populatedTx);
  }

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  // Existing methods
  getWallet() {
    return this.wallet;
  }

  getAddress() {
    return this.wallet.address;
  }

  getPrivateKey() {
    return this.wallet.privateKey;
  }
}