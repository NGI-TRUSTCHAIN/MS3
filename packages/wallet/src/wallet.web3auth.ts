import { BaseWallet } from "./wallet.core";
import { Web3AuthWalletAdapter, Web3AuthConfig } from "./adapters";

export interface Web3AuthWalletOptions {
  // All configuration options required by the adapter.
  web3authConfig: Web3AuthConfig;
}

export class Web3AuthWallet extends BaseWallet {
  protected adapter: Web3AuthWalletAdapter;

  constructor(
    adapterName: string,
    neededFeature?: string,
    provider?: any,
    options?: Web3AuthWalletOptions
  ) {
    if (adapterName !== "web3auth") {
      throw new Error("Web3AuthWallet requires adapterName 'web3auth'");
    }
    if (!options || !options.web3authConfig) {
      throw new Error("Web3Auth configuration is required for Web3AuthWallet");
    }
    super(adapterName, neededFeature, provider, options);
    this.adapter = new Web3AuthWalletAdapter(options.web3authConfig);
    if (provider) this.adapter.setProvider(provider);
  }

  async requestAccounts(): Promise<string[]> {
    return await this.adapter.requestAccounts();
  }

  async getAccounts(): Promise<string[]> {
    return await this.adapter.getAccounts();
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    return await this.adapter.getNetwork();
  }

  async switchNetwork(chainId: string): Promise<boolean> {
    return await this.adapter.switchNetwork(chainId);
  }

  async sendTransaction(tx: any): Promise<string> {
    return await this.adapter.sendTransaction(tx);
  }

  async signTransaction(tx: any): Promise<string> {
    return await this.adapter.signTransaction(tx);
  }

  async signMessage(message: string): Promise<string> {
    return await this.adapter.signMessage(message);
  }

  async signTypedData(data: { domain: any; types: any; value: any }): Promise<string> {
    return await this.adapter.signTypedData(data);
  }

  async disconnect(): Promise<void> {
    return await this.adapter.disconnect();
  }
}