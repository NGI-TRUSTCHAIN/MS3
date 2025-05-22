import { ICrossChain } from './types/interfaces/index.js';
import pkgJson from '../package.json' with { type: "json" };
import { registry, createErrorHandlingProxy, AdapterError, ModuleArguments, validateAdapterParameters, ValidatorArguments } from '@m3s/common';

// Register this module in the registry
registry.registerModule({ name: 'crosschain', version: pkgJson.version });

// Export main components
export * from './types/index.js';
import './adapters/index.js';
import { ILiFiAdapterOptionsV1 } from './adapters/index.js';
export { AdapterError };
export type { ILiFiAdapterOptionsV1 } from './adapters/index.js';

interface ICrossChainOptions extends ModuleArguments<string, ILiFiAdapterOptionsV1> { }

/**
 * Creates a CrossChain module instance with the specified adapter.
 * 
 * @param params - Configuration parameters for the CrossChain module
 * @returns A promise that resolves to a CrossChain module instance
 * @throws Error if the adapter is not found or initialization fails
 */
export async function createCrossChain<T extends ICrossChain = ICrossChain>(params: ICrossChainOptions): Promise<T> {
  const { adapterName } = params;

  // Validate adapter exists using the registry
  const adapterInfo = registry.getAdapter('crosschain', adapterName);

  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }

  const validatorArgs: ValidatorArguments = {
    moduleName: 'crosschain',
    adapterName,
    params,
    adapterInfo,
    registry,
    factoryMethodName: 'createCrossChain'
  };

  validateAdapterParameters(validatorArgs);

  // Get adapter class directly from registry
  const AdapterClass = adapterInfo.adapterClass;
  if (!AdapterClass || typeof AdapterClass.create !== 'function') {
    throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${adapterName}'.`);
  }

  // Create adapter instance
  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new Error(`Adapter "${adapterName}" initialization error.`);
  }

  // Wrap in error handler and return
  return createErrorHandlingProxy(
    adapter,
    adapterInfo.errorMap || {},
    undefined,
    `CrossChainAdapter(${adapterName})`
  ) as T;
}