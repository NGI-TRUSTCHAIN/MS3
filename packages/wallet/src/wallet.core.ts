import { ICoreWallet, IWalletOptions, TransactionData, WalletEvent } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { createErrorHandlingProxy } from './errors';
import { WalletAdapterFactory } from './factories/walletAdapterFactory';
import { VersionRepository } from '@m3s/utils';

export class BaseWallet implements ICoreWallet {
  protected adapter: any;
  protected versionRepo!: VersionRepository;
  protected walletVersion!: string;
  protected provider?: any;
  protected initialized: boolean = false;

  isInitialized(): boolean {
    return this.adapter.isInitialized();
  }

  private constructor() {
    this.versionRepo = new VersionRepository();
    this.walletVersion = "0.0.0"; // Default that will be overwritten in create()
    this.initialized = false;
  }

  static async create(params: IWalletOptions): Promise<BaseWallet & ICoreWallet> {
    const wallet = new BaseWallet();

    const { adapterName, neededFeature, provider, options } = params;
    wallet.walletVersion = wallet.getCurrentVersion();
    wallet.versionRepo = new VersionRepository();

    if (neededFeature && !wallet.checkFeatureSupport(neededFeature)) {
      throw new Error(`Wallet@${wallet.walletVersion} does not support the feature: ${neededFeature}`);
    }

    await wallet.getInstance(adapterName, options);

    if (provider) {
      wallet.setProvider(provider);
    }

    return createErrorHandlingProxy(wallet);
  }

  async initialize(args?: any): Promise<void> {
    if (this.adapter.initialize) {
      await this.adapter.initialize(args);
    }
  }

  private async getInstance(adapterName: string, options?: any): Promise<void> {
    const walletFactory = await WalletAdapterFactory.create({ adapterName, ...options });
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

    // This is critical - make sure to update the adapter's provider
    if (this.adapter && typeof this.adapter.setProvider === 'function') {
      this.adapter.setProvider(provider);
    }
  }

  getProvider(): any | undefined {
    return this.adapter.getProvider();
  }

  // CoreWallet delegate methods:
  getWalletName(): string {
    return this.adapter.getWalletName();
  }

  getWalletVersion(): string {
    return this.adapter.getWalletVersion();
  }

  async getPrivateKey(): Promise<string> {
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