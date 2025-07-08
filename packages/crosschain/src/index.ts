import { ICrossChain } from './types/interfaces/index.js';
import pkgJson from '../package.json' with { type: "json" };

import { registry, createErrorHandlingProxy, ModuleArguments, validateAdapterParameters, ValidatorArguments, AdapterError, validateEnvironment, Ms3Modules, Capability } from '@m3s/shared';
import { ILiFiAdapterOptionsV1 } from './adapters/index.js';

// Register this module in the registry
registry.registerModule({ name: Ms3Modules.crosschain, version: pkgJson.version });
import './adapters/index.js';

export * from './types/index.js';
export * from './helpers/index.js'
export type { ILiFiAdapterOptionsV1 } from './adapters/index.js';

export interface ICrossChainOptions extends ModuleArguments< ILiFiAdapterOptionsV1> { }

registry.registerInterfaceShape('ICrossChain', [
  Capability.AdapterIdentity, Capability.AdapterLifecycle, Capability.QuoteProvider,
  Capability.OperationExecutor, Capability.OperationMonitor, Capability.ChainDiscovery,
  Capability.GasEstimator, Capability.OperationMaintenance
]);

/**
 * Creates a CrossChain module instance with the specified adapter.
 * 
 * @param params - Configuration parameters for the CrossChain module
 * @returns A promise that resolves to a CrossChain module instance
 * @throws Error if the adapter is not found or initialization fails
 */
export async function createCrossChain<T extends ICrossChain = ICrossChain>(params: ICrossChainOptions): Promise<T> {
  const { name, version } = params;

  // Validate adapter exists using the registry
  const adapterInfo = registry.getAdapter(Ms3Modules.crosschain, name, version);

  if (!adapterInfo) {
    // ✅ Improved error message with available versions
    const availableVersions = registry.getAdapterVersions(Ms3Modules.crosschain, name);
    const versionsText = availableVersions.length > 0
      ? ` Available versions: ${availableVersions.join(', ')}`
      : '';
    throw new AdapterError(`Adapter '${name}' version '${version}' not found for crosschain module.${versionsText}`);
  }

  // ✅ ADD: Validate environment before creation
  if (adapterInfo.environment) {
    console.log(`[CrossChain] Environment requirements for ${name}:`, adapterInfo.environment);
    validateEnvironment(name, adapterInfo.environment);
  }

  // ✅ Updated ValidatorArguments
  const validatorArgs: ValidatorArguments = {
    moduleName: Ms3Modules.crosschain,
    name,
    version,
    params,
    adapterInfo,
    registry,
    factoryMethodName: 'createCrossChain'
  };

 try {
    validateAdapterParameters(validatorArgs);
  } catch (e: any) {
    const msg = e.message || '';
    // ignore only missing timeout/retries
    if (
      msg.includes('Request timeout in milliseconds') ||
      msg.includes('Number of retry attempts')
    ) {
      console.warn('[createCrossChain] Ignoring missing timeout/retries options');
    } else {
      throw e;
    }
  }

  const AdapterClass = adapterInfo.adapterClass;
  if (!AdapterClass || typeof AdapterClass.create !== 'function') {
    throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${name}'.`);
  }

  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new AdapterError(`Adapter "${name}" initialization error.`);
  }

  // ✅ Preserve all error handling and proxy functionality
   return createErrorHandlingProxy(
      adapter,
      adapterInfo.capabilities,
      adapterInfo.errorMap || {},
      undefined,
      `CrossChainAdapter(${name})`
    ) as T;
}