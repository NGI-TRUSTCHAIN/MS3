import { ChainNamespaceType } from "@web3auth/base";
import { WalletEvent } from "../enums/index.js";
import { TransactionData } from "../types/index.js";

// TODO: Add ESTE WALLET TIENE QUE SER GENERICO Y NO ESPECIFICO DE EVM, ASEGURARSE.
export interface ICoreWallet {
  /** General Initialization */
  initialize(args?: any): Promise<any>;
  isInitialized(): boolean;
  disconnect(): void; // Clean disconnect

  /** Wallet Metadata */
  getWalletName(): string;
  getWalletVersion(): string;
  isConnected(): boolean;

  /** Account Management */
  requestAccounts(): Promise<string[]>;
  getPrivateKey(): Promise<string>;
  getAccounts(): Promise<string[]>;
  getBalance(account?: string): Promise<string>; // Fetch account balance
  verifySignature(message: string, signature: string): Promise<boolean>; // Verify signature correctness
  on(event: WalletEvent, callback: (...args: any[]) => void): void;
  off(event: WalletEvent, callback: (...args: any[]) => void): void;

  /** Network Management */
  getNetwork(): Promise<{ chainId: string; name?: string }>;
  setProvider(provider: any): Promise<void>;

  /** Transactions & Signing */
  sendTransaction(tx: TransactionData): Promise<string>;
  signTransaction(tx: TransactionData): Promise<string>;
  signMessage(message: string): Promise<string>;
}

export interface IChainConfig {
  chainConfig: {
    chainNamespace: ChainNamespaceType,
    chainId: string,
    rpcTarget: string,
    displayName: string,
    blockExplorer: string,
    ticker: string,
    tickerName: string
  },
}
export interface IWalletOptions {
  adapterName: string,
  neededFeature?: string,
  provider?: any,
  options?: IWeb3AuthOptions | IEVMOptions
}

export interface IEVMOptions {
  privateKey?: string,
}

export interface IWeb3AuthOptions {
  web3authConfig: {
    clientId: string,
    web3AuthNetwork: string,
    chainConfig: {
      chainNamespace: ChainNamespaceType,
      chainId: string,
      rpcTarget: string,
      displayName: string,
      blockExplorer: string,
      ticker: string,
      tickerName: string
    },
    loginConfig: {
      loginProvider: string
    }
  }
}