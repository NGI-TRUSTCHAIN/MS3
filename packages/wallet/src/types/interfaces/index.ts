import { WalletEvent, TransactionData } from "../types";

export interface CoreWallet {
  /** Wallet Metadata */
  getWalletName(): string;
  getWalletVersion(): string;
  isConnected(): boolean;

  /** Account Management */
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  on(event: WalletEvent, callback: (...args: any[]) => void): void;
  off(event: WalletEvent, callback: (...args: any[]) => void): void;

  /** Network Management */
  getNetwork(): Promise<{ chainId: string; name?: string }>;
  switchNetwork(chainId: string): Promise<boolean>;

  /** Transactions & Signing */
  sendTransaction(tx: TransactionData): Promise<string>;
  signTransaction(tx: TransactionData): Promise<string>;
  signMessage(message: string): Promise<string>;
}

////////////////////////////////////////////////////////
// PRIVATE FEATURES (would be in privateFeatures.ts)
////////////////////////////////////////////////////////
export interface PrivateFeaturesWallet {
  hasPrivateFeature(featureName: string): boolean;
  invokePrivateFeature(featureName: string, ...args: any[]): Promise<any>;
}



