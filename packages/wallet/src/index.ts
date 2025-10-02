import { UniversalRegistry, createErrorHandlingProxy, AdapterError, validateAdapterParameters, ModuleArguments, ValidatorArguments, validateEnvironment, Ms3Modules, Capability } from '@m3s/shared';
import pkgJson from '../package.json' with { type: "json" };
import { ICoreWallet, WalletAdapterOptionsV1 } from "./types/index.js";
import { walletAdapters } from './adapters/registration.js';

export const walletRegistry = new UniversalRegistry();

// Register this module in the registry
walletRegistry.registerModule({ name: Ms3Modules.wallet, version: pkgJson.version });

// ✅ Register all known adapters from the manifest at startup
// ✅ THIS IS THE KEY: Loop through the imported adapters and register them here.
Object.values(walletAdapters).forEach((adapter: any) => {
  if (adapter.meta) {
    walletRegistry.registerAdapter(Ms3Modules.wallet, adapter.meta);
  }
  if (adapter.matrix) {
    walletRegistry.registerCompatibilityMatrix(Ms3Modules.wallet, adapter.matrix);
  }
});

export * from './types/index.js';
export type { IEthersWalletOptionsV1, IWeb3AuthWalletOptionsV1 } from './adapters/index.js';
export { walletAdapters };

export interface IWalletOptions extends ModuleArguments<WalletAdapterOptionsV1> { }

walletRegistry.registerInterfaceShape('IEVMWallet', [
  Capability.CoreWallet, Capability.EventEmitter, Capability.MessageSigner, Capability.TransactionHandler,
  Capability.TypedDataSigner, Capability.GasEstimation, Capability.TokenOperations, Capability.RPCHandler, Capability.TransactionStatus
]);

/**
 * Creates and returns a wallet adapter instance based on the provided configuration.
 *
 */
export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { name, version } = params;

    const adapterInfo = version
      ? walletRegistry.getAdapter(Ms3Modules.wallet, name, version)
      : walletRegistry.getLatestAdapter(Ms3Modules.wallet, name);

    if (!adapterInfo) {
      const availableVersions = walletRegistry.getAdapterVersions(Ms3Modules.wallet, name);
      const versionsText = availableVersions.length > 0
        ? ` Available versions: ${availableVersions.join(', ')}`
        : ' No versions of this adapter are registered.';
      const requestedVersionText = version ? `version '${version}'` : '(latest version)';

      throw new AdapterError(`Adapter '${name}' ${requestedVersionText} not found for wallet module.${versionsText}`);
    }

    if (adapterInfo.environment) {
      validateEnvironment(name, adapterInfo.environment);
    }

    // Use the validation utility
    const validatorArgs: ValidatorArguments = {
      moduleName: Ms3Modules.wallet,
      name,
      version: adapterInfo.version,  // ✅ Add version
      params,
      adapterInfo,
      registry: walletRegistry,
      factoryMethodName: 'createWallet'
    };

    validateAdapterParameters(validatorArgs);

    const AdapterClass = adapterInfo.adapterClass;
    if (!AdapterClass || typeof AdapterClass.create !== 'function') {
      throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${name}'.`);
    }

    // ✅ Pass the registry name and version to the adapter
    const adapter = await AdapterClass.create(params);

    if (!adapter) {
      throw new AdapterError(`Adapter '${name}' create method returned a falsy value.`);
    }

    // ✅ Preserve all error handling and proxy functionality
    return createErrorHandlingProxy(
      adapter,
      adapterInfo.capabilities, // Pass the capabilities
      adapterInfo.errorMap || {},
      undefined,
      `WalletAdapter(${name})`
    ) as T;

}