import { ICoreWallet, IWalletOptions } from './types/interfaces';
import { TransactionData } from './types/types';
import * as fs from 'fs';
import * as path from 'path';
import { WalletEvent } from './types/enums';
import { createErrorHandlingProxy } from './errors';
import { WalletAdapterFactory } from './factories/walletAdapterFactory';
import { VersionRepository } from '@m3s/utils';

export class BaseWallet implements ICoreWallet {
  protected adapter: any;
  protected versionRepo: VersionRepository;
  protected walletVersion: string;
  protected provider?: any;

  constructor(params: IWalletOptions) {
    
    const { adapterName, neededFeature, provider, options } = params;

    this.walletVersion = this.getCurrentVersion();
    this.versionRepo = new VersionRepository();

    if (neededFeature && !this.checkFeatureSupport(neededFeature)) {
      throw new Error(`Wallet@${this.walletVersion} does not support the feature: ${neededFeature}`);
    }

    this.getInstance(adapterName, options);
    
    if (provider) {
      this.setProvider(provider);
    }

    return createErrorHandlingProxy(this);
  }

  async initialize(args?: any): Promise<void> {
    if (this.adapter.initialize) {
      await this.adapter.initialize(args);
    }
  }

  private getInstance(adapterName: string, options?: any): void {
    // TODO: Type options better.
    const walletFactory = new WalletAdapterFactory({ adapterName, ...options });
    this.adapter = walletFactory.instance;
    if (!this.adapter) {
      throw new Error(`Adapter "${adapterName}" initialization error.`);
    }
  }

  private getCurrentVersion(): string {
    // In a browser environment, avoid using fs
    if (typeof window !== 'undefined') {
      console.log("[BaseWallet] Browser environment detected; returning static wallet version.");
      return "1.0.0"; // or another appropriate version string
    }
    // In Node: read package.json to determine version
    const pkgJsonPath = path.join(__dirname, '../package.json');
    console.log("[BaseWallet] Reading wallet version from:", pkgJsonPath);
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      return pkg.version || "0.0.0";
    } catch (error) {
      console.error("[BaseWallet] Error reading version from package.json:", error);
      return "0.0.0";
    }
  }

  private checkFeatureSupport(feature: string): boolean {
    if (feature && !this.versionRepo.supportsFeature('wallet', this.walletVersion, feature)) {
      console.warn(`Wallet@${this.walletVersion} does not support the feature: ${feature}`);
    }
    return true;
  }

  setProvider(provider: any): void {
    if (!provider) {
      throw new Error("Provider cannot be null/undefined");
    }
    this.provider = provider;
    if (this.adapter?.setProvider) {
      this.adapter.setProvider(provider);
    }
  }

  getProvider(): any | undefined {
    return this.provider;
  }

  // CoreWallet delegate methods:
  getWalletName(): string {
    return this.adapter.getWalletName();
  }

  getWalletVersion(): string {
    return this.adapter.getWalletVersion();
  }

  getPrivateKey(): string {
    if (typeof this.adapter.getPrivateKey === "function") {
      return this.adapter.getPrivateKey();
    }
    throw new Error("Adapter does not implement getPrivateKey");
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  async requestAccounts(): Promise<string[]> {
    // Ensure the adapter is ready.
    if (this.adapter.initialize) {
      await this.adapter.initialize();
    }
    return this.adapter.requestAccounts();
  }

  getAccounts(): Promise<string[]> {
    return this.adapter.getAccounts();
  }

  on(event: WalletEvent, callback: (...args: any[]) => void): void {
    return this.adapter.on(event, callback);
  }

  off(event: WalletEvent, callback: (...args: any[]) => void): void {
    return this.adapter.off(event, callback);
  }

  getNetwork(): Promise<{ chainId: string; name?: string }> {
    return this.adapter.getNetwork();
  }

  switchNetwork(chainId: string): Promise<boolean> {
    return this.adapter.switchNetwork(chainId);
  }

  sendTransaction(tx: TransactionData): Promise<string> {
    return this.adapter.sendTransaction(tx);
  }

  signTransaction(tx: TransactionData): Promise<string> {
    return this.adapter.signTransaction(tx);
  }

  signMessage(message: string): Promise<string> {
    return this.adapter.signMessage(message);
  }

  // EVM-specific methods - These will be called when the adapter is EVM-compatible
  async signTypedData(data: any): Promise<string> {
    if (typeof this.adapter.signTypedData !== 'function') {
      throw new Error('Adapter does not implement signTypedData');
    }
    return this.adapter.signTypedData(data);
  }

  async getGasPrice(): Promise<string> {
    if (typeof this.adapter.getGasPrice !== 'function') {
      throw new Error('Adapter does not implement getGasPrice');
    }
    return this.adapter.getGasPrice();
  }

  async estimateGas(tx: any): Promise<string> {
    if (typeof this.adapter.estimateGas !== 'function') {
      throw new Error('Adapter does not implement estimateGas');
    }
    return this.adapter.estimateGas(tx);
  }
}