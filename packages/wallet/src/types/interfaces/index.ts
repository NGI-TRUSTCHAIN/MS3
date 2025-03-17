import { WalletEvent, TransactionData } from "../types";

// TODO: Add ESTE WALLET TIENE QUE SER GENERICO Y NO ESPECIFICO DE EVM, ASEGURARSE.
export interface CoreWallet {
  /** General Initialization */
  initialize(args?:any): Promise<void>;

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



