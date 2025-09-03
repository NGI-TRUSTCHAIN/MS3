import { ICrossChain } from './types/interfaces/index.js';
import pkgJson from '../package.json' with { type: "json" };

import {  createErrorHandlingProxy, ModuleArguments, validateAdapterParameters, ValidatorArguments, AdapterError, validateEnvironment, Ms3Modules, Capability, UniversalRegistry } from '@m3s/shared';
import { ILiFiAdapterOptionsV1 } from './adapters/index.js';
import { crosschainAdapters } from './adapters/registration.js';

export const crossChainRegistry = new UniversalRegistry();

crossChainRegistry.registerModule({ name: Ms3Modules.crosschain, version: pkgJson.version });
Object.values(crosschainAdapters).forEach((adapter: any) => {
  if (adapter.meta) {
    crossChainRegistry.registerAdapter(Ms3Modules.crosschain, adapter.meta);
  }
  if (adapter.matrix) {
    crossChainRegistry.registerCompatibilityMatrix(Ms3Modules.crosschain, adapter.matrix);
  }
});

import './adapters/index.js';

export * from './types/index.js';
export type { ILiFiAdapterOptionsV1 } from './adapters/index.js';
export interface ICrossChainOptions extends ModuleArguments< ILiFiAdapterOptionsV1> { }

crossChainRegistry.registerInterfaceShape('ICrossChain', [
  Capability.AdapterIdentity, Capability.AdapterLifecycle, Capability.QuoteProvider,
  Capability.OperationHandler, Capability.ChainDiscovery,
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

  const adapterInfo = version
    ? crossChainRegistry.getAdapter(Ms3Modules.crosschain, name, version)
    : crossChainRegistry.getLatestAdapter(Ms3Modules.crosschain, name);

  if (!adapterInfo) {
    const availableVersions = crossChainRegistry.getAdapterVersions(Ms3Modules.crosschain, name);
    const versionsText = availableVersions.length > 0
      ? ` Available versions: ${availableVersions.join(', ')}`
      : ' No versions of this adapter are registered.';
    const requestedVersionText = version ? `version '${version}'` : '(latest version)';

    throw new AdapterError(`Adapter '${name}' ${requestedVersionText} not found for crosschain module.${versionsText}`);
  }

  if (adapterInfo.environment) {
    validateEnvironment(name, adapterInfo.environment);
  }

  const validatorArgs: ValidatorArguments = {
    moduleName: Ms3Modules.crosschain,
    name,
    version: adapterInfo.version,
    params,
    adapterInfo,
    registry: crossChainRegistry,
    factoryMethodName: 'createCrossChain'
  };

 try {
    validateAdapterParameters(validatorArgs);
  } catch (e: any) {
    const msg = e.message || '';
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

  return createErrorHandlingProxy(
      adapter,
      adapterInfo.capabilities,
      adapterInfo.errorMap || {},
      undefined,
      `CrossChainAdapter(${name})`
    ) as T;
}