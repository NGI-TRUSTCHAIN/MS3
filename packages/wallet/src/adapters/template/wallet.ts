import { IEVMWallet, AssetBalance, EstimatedFeeData } from "@m3s/wallet";
import { AdapterArguments, NetworkConfig } from "@m3s/common";

/**
 * Specific options for this wallet adapter template.
 */
export interface WalletTemplateOptions {
  /** Required string option - describe what this does */
  option_1: string;
  
  /** Required nested object option */
  option_2: {
    /** Required number sub-option */
    option_2_1: number,
    /** Required string array sub-option */
    option_2_2: string[]
  },
  
  /** Optional BigInt option - describe what this does */
  option_3?: BigInt;
  
  // TODO: Add the options as required by your specific adapter implementation
}

interface args extends AdapterArguments<WalletTemplateOptions> { }

/**
 * Template Wallet Adapter
 */
export class WalletTemplateAdapter implements IEVMWallet {
  public readonly name: string;
  public readonly version: string;
  
  private initialized: boolean = false;

  private constructor(args: args) {
    this.name = args.name;
    this.version = args.version;
  }

  static async create(args: args): Promise<WalletTemplateAdapter> {
    const adapter = new WalletTemplateAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // TODO: Implement initialization logic
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Core Wallet Methods
  disconnect(): void {
    this.initialized = false;
  }

  isConnected(): boolean {
    return false;
  }

  async getAccounts(): Promise<string[]> {
    throw new Error("getAccounts not implemented");
  }

  async getBalance(): Promise<AssetBalance> {
    throw new Error("getBalance not implemented");
  }

async callContract(to: string, data: string): Promise<string> {
  console.log('callContract', to, data)
  throw new Error("callContract not implemented");
}

  async getNetwork(): Promise<NetworkConfig> {
    throw new Error("getNetwork not implemented");
  }

  async setProvider(): Promise<void> {
    throw new Error("setProvider not implemented");
  }

  // Event Methods
  on(): void {
    throw new Error("on not implemented");
  }

  off(): void {
    throw new Error("off not implemented");
  }

  // Signing Methods
  async signMessage(): Promise<string> {
    throw new Error("signMessage not implemented");
  }

  async verifySignature(): Promise<boolean> {
    throw new Error("verifySignature not implemented");
  }

  // Transaction Methods
  async sendTransaction(): Promise<string> {
    throw new Error("sendTransaction not implemented");
  }

  async signTransaction(): Promise<string> {
    throw new Error("signTransaction not implemented");
  }

  // EVM-Specific Methods
  async signTypedData(): Promise<string> {
    throw new Error("signTypedData not implemented");
  }

  async getGasPrice(): Promise<bigint> {
    throw new Error("getGasPrice not implemented");
  }

  async estimateGas(): Promise<EstimatedFeeData> {
    throw new Error("estimateGas not implemented");
  }

  async getTransactionReceipt(): Promise<any> {
    throw new Error("getTransactionReceipt not implemented");
  }


}