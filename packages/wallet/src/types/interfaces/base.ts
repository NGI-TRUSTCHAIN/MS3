import { WalletEvent } from "../enums";
import { TransactionData } from "../types";

// TODO: Add ESTE WALLET TIENE QUE SER GENERICO Y NO ESPECIFICO DE EVM, ASEGURARSE.
export interface ICoreWallet {
  /** General Initialization */
  initialize(args?:any): Promise<any>;
  // Initialization state
  isInitialized(): boolean;

  /** Wallet Metadata */
  getWalletName(): string;
  getWalletVersion(): string;
  isConnected(): boolean;

  /** Account Management */
  requestAccounts(): Promise<string[]>;
  getPrivateKey(): Promise<string>;
  getAccounts(): Promise<string[]>;
  on(event: WalletEvent, callback: (...args: any[]) => void): void;
  off(event: WalletEvent, callback: (...args: any[]) => void): void;

  /** Network Management */
  getNetwork(): Promise<{ chainId: string; name?: string }>;
  setProvider(provider: any): void;
  // switchNetwork removed from core interface

  /** Transactions & Signing */
  sendTransaction(tx: TransactionData): Promise<string>;
  signTransaction(tx: TransactionData): Promise<string>;
  signMessage(message: string): Promise<string>;
}

export interface IWalletOptions {
  adapterName: string,
  neededFeature?: string,
  provider?: any,
  options?: any
}
