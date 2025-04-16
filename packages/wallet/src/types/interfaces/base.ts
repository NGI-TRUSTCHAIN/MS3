import { ChainNamespaceType } from "@web3auth/base";
import { WalletEvent } from "../enums/index.js";
import { AssetBalance, ProviderConfig, GenericTransactionData } from "../types/base.js";

// TODO: Add ESTE WALLET TIENE QUE SER GENERICO Y NO ESPECIFICO DE EVM, ASEGURARSE.
export interface ICoreWallet {
  /** General Initialization */
  initialize(args?: any): Promise<void>; // Keep args flexible for adapter config
  isInitialized(): boolean;
  disconnect(): void;

  /** Wallet Metadata */
  getWalletName(): string;
  getWalletVersion(): string;
  isConnected(): boolean;

  /** Account Management */
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  /** Fetches the native asset balance for the specified account. */
  getBalance(account?: string): Promise<AssetBalance>;
  /** Verifies a signature against a message and the expected signer address. */
  verifySignature(message: string | Uint8Array, signature: string, address: string): Promise<boolean>;
  on(event: WalletEvent | string, callback: (...args: any[]) => void): void; // Allow string for custom events
  off(event: WalletEvent | string, callback: (...args: any[]) => void): void;

  /** Network Management */
  getNetwork(): Promise<{ chainId: string | number; name?: string }>; // Keep chainId flexible
  /** Sets or switches the network provider using a standard configuration object. */
  setProvider(config: ProviderConfig): Promise<void>;

  /** Transactions & Signing */
  /** Sends a transaction using generic data format. Returns a transaction identifier (e.g., hash). */
  sendTransaction(tx: GenericTransactionData): Promise<string>;
  /** Signs a transaction using generic data format. Returns the signed transaction data. */
  signTransaction(tx: GenericTransactionData): Promise<string>; // Return type might need generalization (string | Uint8Array | object) ? Let's keep string for now.
  /** Signs an arbitrary message. */
  signMessage(message: string | Uint8Array): Promise<string>; // Allow binary messages
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