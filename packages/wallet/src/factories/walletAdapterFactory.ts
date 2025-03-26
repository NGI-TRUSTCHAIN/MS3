import { adapterRegistry } from '../adapters/registry.js';
import { IWalletOptions } from '../types/index.js';
import { WalletType } from '../types/enums/index.js';

export class WalletAdapterFactory {
  public instance: any;


  private constructor() {}

  static async create(args: IWalletOptions): Promise<WalletAdapterFactory> {
    console.log("WalletAdapterFactory creating with:", JSON.stringify(args, null, 2));
    const factory = new WalletAdapterFactory();
    factory.instance = await factory.initAdapter(args);
    return factory;
  }

  async initAdapter(args: any): Promise<any> {
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

    // Return the created adapter instance.
    return  AdapterClass.create(args);
  }
}