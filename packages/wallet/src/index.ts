import { getAdapterFactory, VersionRepository } from '@m3s/utils';
import { CoreWallet } from './types/interfaces';
import { WalletEvent, TransactionData } from './types/types';
import path from 'path';
import fs from 'fs';
import { IRequiredMethods } from './types/enums';

export class Wallet implements CoreWallet {
  private adapter: any;
  private versionRepo: VersionRepository;
  private walletVersion: string;

  constructor(adapterName: string, neededFeature?: string) {
    this.walletVersion = this.getCurrentVersion();

    // 2) Load version matrix and check feature support
    this.versionRepo = new VersionRepository();
    if(!this.checkFeatureSupport(neededFeature as any)){
      throw new Error(`Wallet@${this.walletVersion} does not support the feature: ${neededFeature}`);
    }

    // 3) Instantiate adapter
    this.getInstance(adapterName);
  }
 
  private getCurrentVersion(): string {
    const pkgJsonPath = path.join(__dirname, '../package.json');
    console.log('Reading wallet version from:', pkgJsonPath);

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return pkg.version || '0.0.0'; 
    
  }

  private checkFeatureSupport(feature: string): boolean {
    if (feature && !this.versionRepo.supportsFeature('wallet', this.walletVersion, feature)) {
      console.warn(
        `Wallet@${this.walletVersion} does not support the feature: ${feature}`
      );
    }

    return true;
  }

  private getInstance(adapterName: string): any {
    const walletFactory = getAdapterFactory('wallet', adapterName);
    this.adapter = walletFactory.instance;
  
    // 4) Validate adapter's base wallet interface or specific features
    if (!this.adapter) {
      throw new Error(`Adapter "${adapterName}" does not implement the required CoreWallet interface.`);
    }
  
    if (!this.implementsCoreWalletMethods()) { // Added parentheses here
      throw new Error(`Adapter "${adapterName}" does not implement the required CoreWallet interface.`);
    }
  }

  private implementsCoreWalletMethods(): boolean {
    const requiredMethods = Object.values(IRequiredMethods);
    return requiredMethods.every(method => 
      typeof this.adapter[method] === "function"
    );
  }

  getWalletName(): string {
    return this.adapter.getWalletName();
  }
  getWalletVersion(): string {
    return this.adapter.getWalletVersion();
  }
  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  requestAccounts(): Promise<string[]> {
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

}


// Test the mock adapter works.
const wallet = new Wallet('mock');
console.log('Wallet name:', wallet.getWalletName());