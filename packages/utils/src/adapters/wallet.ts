import { ethers, HDNodeWallet, Provider } from "ethers";
// Adjust import paths as needed

export class MockedWalletAdapter {
  private wallet: HDNodeWallet;
  private provider?: Provider;

  constructor(provider?: Provider) {
    this.wallet = ethers.Wallet.createRandom();

    if (provider) {
      this.setProvider(provider);
    }

    // Debug instance creation
    console.log("5. MockedWalletAdapter methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(this)));
  }

  setProvider(provider: Provider) {
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
      // Ensure we have a connected wallet with provider
      const signer = this.wallet.connect(this.provider);
      
      // Get nonce
      const nonce = await this.provider.getTransactionCount(signer.address);

      // Build transaction
      const transaction = {
        to: tx.to,
        value: tx.value ? ethers.parseEther(tx.value) : 0n,
        data: tx.data || '0x',
        nonce: nonce,
        gasLimit: 21000n, // Basic ETH transfer
        chainId: (await this.provider.getNetwork()).chainId
      };

      // Send transaction
      const response = await signer.sendTransaction(transaction);
      console.log('Transaction sent:', response.hash);
      
      return response.hash;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error; // Re-throw to handle in caller
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