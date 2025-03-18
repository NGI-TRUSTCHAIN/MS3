import { adapterRegistry } from '../adapters/registry';
import { WalletType } from '../types/enums';

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
      // Check if required parameter is in root or nested in options
      if (!args[req] && (!args.options || !args.options[req])) {
        throw new Error(`${req} is required for ${args.adapterName} adapter`);
      }
    }
  }

    // Create the appropriate adapter instance based on the registration
    const AdapterClass = adapterInfo.adapterClass;

    // Handle different constructor signatures based on adapter type
    switch (adapterInfo.adapterType) {
      case WalletType['evm']:
        return new AdapterClass(args.options?.privateKey || args.privateKey, args.provider);
      case  WalletType['web3auth']:
        // Look for web3authConfig in both places - options object or root
        return new AdapterClass(args.web3authConfig);
      default:
        // Generic adapter initialization
        return new AdapterClass(args);
    }
  }
}