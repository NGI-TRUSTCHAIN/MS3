import { AdapterArguments, AdapterError, WalletErrorCode } from '@m3s/shared';
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
    console.info('Event  ON', event)
    console.info('Event  ON handler', listener)

    throw new AdapterError('Method not implemented to subscribe to events', { methodName: 'on', code: WalletErrorCode.InvalidInput });
  
  }
  
  off(event: 'status', listener: (result: OperationResult) => void): this {
    console.info('Event  OFF', event)
    console.info('Event  OFF handler', listener)

    throw new AdapterError('Method not implemented to unsubscribe from events', { methodName: 'off', code: WalletErrorCode.InvalidInput });
  }

  static async create(args: args): Promise<CrosschainTemplateAdapter> {
    const adapter = new CrosschainTemplateAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  async initialize(): Promise<void> {
    // TODO: Implement initialization logic
    throw new AdapterError('initialize() not implemented for CrosschainTemplateAdapter', { methodName: 'initialize', code: WalletErrorCode.InvalidInput });
  
  }


  isInitialized(): boolean {
    return true;
  }

  async getOperationQuote(): Promise<OperationQuote[]> {
    throw new AdapterError('getOperationQuote not implemented', { methodName: 'getOperationQuote', code: WalletErrorCode.InvalidInput });
  }

  async executeOperation(): Promise<OperationResult> {
    throw new AdapterError('executeOperation not implemented', { methodName: 'executeOperation', code: WalletErrorCode.InvalidInput });
  }

  async getOperationStatus(): Promise<OperationResult> {
    throw new AdapterError('getOperationStatus not implemented', { methodName: 'getOperationStatus', code: WalletErrorCode.InvalidInput });
  }

  async cancelOperation(): Promise<OperationResult> {
    throw new AdapterError('cancelOperation not implemented', { methodName: 'cancelOperation', code: WalletErrorCode.InvalidInput });
  }

  async getSupportedChains(): Promise<{ chainId: number; name: string, symbol: string }[]> {
    throw new AdapterError('getSupportedChains not implemented', { methodName: 'getSupportedChains', code: WalletErrorCode.InvalidInput });
  }

  async getSupportedTokens(): Promise<ChainAsset[]> {
    throw new AdapterError('getSupportedTokens not implemented', { methodName: 'getSupportedTokens', code: WalletErrorCode.InvalidInput });
  }

  async getGasOnDestination(): Promise<{ amount: string, usdValue: string }> {
    throw new AdapterError('getGasOnDestination not implemented', { methodName: 'getGasOnDestination', code: WalletErrorCode.InvalidInput });
  }

  async resumeOperation(): Promise<OperationResult> {
    throw new AdapterError('resumeOperation not implemented', { methodName: 'resumeOperation', code: WalletErrorCode.InvalidInput });
  }

  async checkForTimedOutOperations(): Promise<void> {
    throw new AdapterError('checkForTimedOutOperations not implemented', { methodName: 'checkForTimedOutOperations', code: WalletErrorCode.InvalidInput });
  }
}