import { adapterRegistry } from '../adapters/registry';

export class WalletAdapterFactory {
  public instance: any;

  constructor(args: any) {
    const adapter = this.initAdapter(args);
    this.instance = adapter;
  }

  initAdapter(args: any): any {
    const adapterInfo = adapterRegistry.getAdapter(args.adapterName);

    if (!adapterInfo) {
      throw new Error(`Unknown adapter: ${args.adapterName}`);
    }

    // Check requirements
    if (adapterInfo.requirements) {
      for (const req of adapterInfo.requirements) {
        if (!args[req]) {
          throw new Error(`${req} is required for ${args.adapterName} adapter`);
        }
      }
    }

    // Create the appropriate adapter instance based on the registration
    const AdapterClass = adapterInfo.adapterClass;

    // Handle different constructor signatures based on adapter type
    switch (adapterInfo.adapterType) {
      case 'evm':
        return new AdapterClass(args.privateKey, args.provider);
      case 'web3auth':
        return new AdapterClass(args.web3authConfig);
      default:
        // Generic adapter initialization
        return new AdapterClass(args);
    }
  }
}