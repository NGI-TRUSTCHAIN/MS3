import { ethers, HDNodeWallet } from "ethers";
// Adjust import paths as needed

export class MockedWalletAdapter {
  private wallet: HDNodeWallet;

  constructor() {
    this.wallet = ethers.Wallet.createRandom();
    // Debug instance creation
    console.log("5. MockedWalletAdapter methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(this)));
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
    // Minimal example of sending a transaction with ethers
    const response = await this.wallet.sendTransaction({
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data
    });
    return response.hash;
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