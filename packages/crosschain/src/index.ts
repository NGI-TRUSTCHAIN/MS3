import { ICrossChain } from './types/interfaces/index.js';
import { ICrossChainOptions } from './types/index.js';
import { createErrorHandlingProxy } from './errors.js';
import pkgJson from '../package.json' with { type: "json" };
import { registry } from '@m3s/common';

// Register this module in the registry
registry.registerModule({ name: 'crosschain', version: pkgJson.version });

// Export main components
export * from './types/index.js';
export * from './adapters/index.js';

/**
 * Creates a CrossChain module instance with the specified adapter.
 * 
 * @param params - Configuration parameters for the CrossChain module
 * @returns A promise that resolves to a CrossChain module instance
 * @throws Error if the adapter is not found or initialization fails
 */
export async function createCrossChain<T extends ICrossChain = ICrossChain>(params: ICrossChainOptions): Promise<T> {
  const { adapterName, options, neededFeature } = params;

  // Validate adapter exists using the registry
  const adapterInfo = registry.getAdapter('crosschain', adapterName);

  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }

  // Check feature compatibility if specified
  if (neededFeature && !registry.supportsFeature('crosschain', adapterName, neededFeature)) {
    throw new Error(`Feature '${neededFeature}' is not supported by adapter '${adapterName}'`);
  }

  // Check requirements if any
  if (adapterInfo.requirements && adapterInfo.requirements.length > 0) {
    for (const req of adapterInfo.requirements) {
      if (!options || !(req in options)) {
        throw new Error(`Required option '${req}' missing for adapter '${adapterName}'`);
      }
    }
  }

  // Get adapter class directly from registry
  const AdapterClass = adapterInfo.adapterClass;

  // Create adapter instance
  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new Error(`Adapter "${adapterName}" initialization error.`);
  }
  
  // Wrap in error handler and return
  return createErrorHandlingProxy(adapter) as T;
}