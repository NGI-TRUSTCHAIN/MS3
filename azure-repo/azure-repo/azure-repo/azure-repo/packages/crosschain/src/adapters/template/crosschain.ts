import { AdapterArguments } from '@m3s/shared';
import { ICrossChain, OperationQuote, OperationResult, ChainAsset } from '../../types/index.js';

/**
 * Specific options for this crosschain adapter template.
 */
export interface CrosschainTemplateOptions {
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

interface args extends AdapterArguments<CrosschainTemplateOptions> { }

/**
 * Template Crosschain Adapter
 */
export class CrosschainTemplateAdapter implements ICrossChain {
  public readonly name: string;
  public readonly version: string;

  private constructor(args: args) {
    this.name = args.name;
    this.version = args.version;
  }

  on(event: 'status', listener: (result: OperationResult) => void): this {
    console.log('Event  ON', event)
    console.log('Event  ON handler', listener)

    throw new Error('Method not implemented to subscribe to: ');
  }
  
  off(event: 'status', listener: (result: OperationResult) => void): this {
    console.log('Event  OFF', event)
    console.log('Event  OFF handler', listener)

    throw new Error('Method not implemented.');
  }

  static async create(args: args): Promise<CrosschainTemplateAdapter> {
    const adapter = new CrosschainTemplateAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  async initialize(): Promise<void> {
    // TODO: Implement initialization logic
  }


  isInitialized(): boolean {
    return true;
  }

  async getOperationQuote(): Promise<OperationQuote[]> {
    throw new Error("getOperationQuote not implemented");
  }

  async executeOperation(): Promise<OperationResult> {
    throw new Error("executeOperation not implemented");
  }

  async getOperationStatus(): Promise<OperationResult> {
    throw new Error("getOperationStatus not implemented");
  }

  async cancelOperation(): Promise<OperationResult> {
    throw new Error("cancelOperation not implemented");
  }

  async getSupportedChains(): Promise<{ chainId: number; name: string, symbol: string }[]> {
    throw new Error("getSupportedChains not implemented");
  }

  async getSupportedTokens(): Promise<ChainAsset[]> {
    throw new Error("getSupportedTokens not implemented");
  }

  async getGasOnDestination(): Promise<{ amount: string, usdValue: string }> {
    throw new Error("getGasOnDestination not implemented");
  }

  async resumeOperation(): Promise<OperationResult> {
    throw new Error("resumeOperation not implemented");
  }

  async checkForTimedOutOperations(): Promise<void> {
    throw new Error("checkForTimedOutOperations not implemented");
  }
}