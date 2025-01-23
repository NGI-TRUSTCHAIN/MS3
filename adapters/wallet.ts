import { ethers, HDNodeWallet } from "ethers";

export class MockedWalletAdapter {
  private wallet: HDNodeWallet;

  constructor() {
    // Generate a random wallet instance
    this.wallet = ethers.Wallet.createRandom();
  }

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