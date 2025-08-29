import pkgJson from '../package.json' with { type: "json" };
import { registry, createErrorHandlingProxy, AdapterError, validateAdapterParameters, ModuleArguments, ValidatorArguments, validateEnvironment, Ms3Modules, Capability } from '@m3s/shared'
import { ICoreWallet, WalletAdapterOptionsV1 } from "./types/index.js";

// Register this module in the registry
registry.registerModule({ name: 'wallet', version: pkgJson.version });
export * from './types/index.js';
export type { IEthersWalletOptionsV1, IWeb3AuthWalletOptionsV1 } from './adapters/index.js';

export interface IWalletOptions extends ModuleArguments<WalletAdapterOptionsV1> { }

registry.registerInterfaceShape('IEVMWallet', [
  Capability.CoreWallet, Capability.EventEmitter, Capability.MessageSigner, Capability.TransactionHandler,
  Capability.TypedDataSigner, Capability.GasEstimation, Capability.TokenOperations, Capability.RPCHandler, Capability.TransactionStatus
]);

async function loadAdapter(name: string) {
  switch (name) {
    case 'ethers':
      await import('./adapters/ethers/ethersWallet.registration.js');
      break;
    case 'web3auth':
      await import('./adapters/web3auth/web3authWallet.registration.js');
      break;
    default:
      break;
  }
}

/**
 * Creates and returns a wallet adapter instance based on the provided configuration.
 *
 */
export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { name, version } = params;

  try {
    await loadAdapter(name)

    const adapterInfo = registry.getAdapter(
      Ms3Modules.wallet,
      name, version
    );

    if (!adapterInfo) {
      // ✅ Enhanced error message with available versions
      const availableVersions = registry.getAdapterVersions(Ms3Modules.wallet, name);
      const versionsText = availableVersions.length > 0
        ? ` Available versions: ${availableVersions.join(', ')}`
        : '';
      throw new AdapterError(`Adapter '${name}' version '${version}' not found for wallet module.${versionsText}`);
    }

    // ✅ Validate environment before creation
    if (adapterInfo.environment) {
      console.log(adapterInfo.environment);
      validateEnvironment(name, adapterInfo.environment);
    }

    // Use the validation utility
    // ✅ Updated ValidatorArguments
    const validatorArgs: ValidatorArguments = {
      moduleName: Ms3Modules.wallet,
      name,
      version,  // ✅ Add version
      params,
      adapterInfo,
      registry,
      factoryMethodName: 'createWallet'
    };

    validateAdapterParameters(validatorArgs);

    const AdapterClass = adapterInfo.adapterClass;
    if (!AdapterClass || typeof AdapterClass.create !== 'function') {
      throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${name}'.`);
    }

    // ✅ Pass the registry name and version to the adapter
    const adapter = await AdapterClass.create({
      name,
      version,
      options: params.options
    });

    if (!adapter) {
    }

    // ✅ Preserve all error handling and proxy functionality
    return createErrorHandlingProxy(
      adapter,
      adapterInfo.capabilities, // Pass the capabilities
      adapterInfo.errorMap || {},
      undefined,
      `WalletAdapter(${name})`
    ) as T;
  } catch (error) {
    if (error instanceof AdapterError) {
      // Re-throw the original AdapterError to preserve its code and details.
      throw error;
    }
    // For other types of errors, wrap them in a generic AdapterError.
    throw new AdapterError(`Adapter '${name}' failed to be created: ${error}`);
  }
}