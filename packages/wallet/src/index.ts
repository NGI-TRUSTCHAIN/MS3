import pkgJson from '../package.json' with { type: "json" };
import { registry, createErrorHandlingProxy, AdapterError, validateAdapterParameters, ModuleArguments, ValidatorArguments } from '@m3s/common'
import { ICoreWallet, WalletAdapterOptionsV1 } from "./types/index.js";
// Import for side effects: ensures adapter registration code runs
import './adapters/index.js';

// Export individual adapter option types for direct consumer use
export type { IEthersWalletOptionsV1 , IWeb3AuthWalletOptionsV1 } from './adapters/index.js';
// Export wallet-specific types and interfaces
export * from './types/index.js';
// Re-export AdapterError for convenience for consumers of this package
export { AdapterError };

// Register this module in the registry
registry.registerModule({ name: 'wallet', version: pkgJson.version });

// IWalletOptions becomes the specialized ModuleArguments for the wallet module.
// This is the type that createWallet and adapter's static create method will expect.
interface IWalletOptions extends ModuleArguments<string, WalletAdapterOptionsV1> {
  // No wallet-module-specific top-level properties beyond ModuleArguments for now
}

/**
 * Creates and returns a wallet adapter instance based on the provided configuration.
 *
 */
export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { adapterName } = params; // neededFeature is implicitly in params if provided

  const adapterInfo = registry.getAdapter('wallet', adapterName);
  if (!adapterInfo) {
    throw new AdapterError(`Adapter '${adapterName}' not found or not registered for the wallet module.`);
  }

  // Use the validation utility
  const args: ValidatorArguments = { moduleName: 'wallet', adapterName, params, adapterInfo, registry, factoryMethodName: 'createWallet' }
  validateAdapterParameters(args);

  const AdapterClass = adapterInfo.adapterClass;
  if (!AdapterClass || typeof AdapterClass.create !== 'function') {
    throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${adapterName}'.`);
  }

  const adapter = await AdapterClass.create(params);
  if (!adapter) {
    throw new AdapterError(`Adapter '${adapterName}' failed to be created.`);
  }

  return createErrorHandlingProxy(adapter, adapterInfo.errorMap || {}, undefined, `WalletAdapter(${adapterName})`) as T;
}