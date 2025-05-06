import { IBaseContractHandler, IContractOptions } from './types/index.js';
import { createErrorHandlingProxy } from './errors.js';
import pkgJson from '../package.json' with { type: "json" };
import { registry } from '@m3s/common';

// Register this module in the registry
registry.registerModule({ name: 'contractHandler', version: pkgJson.version });

// Export main components.
export * from './types/index.js';
export * from './adapters/index.js';

export async function createContractHandler<T extends IBaseContractHandler = IBaseContractHandler>(params: IContractOptions): Promise<T> {
  const { adapterName, provider, options, neededFeature } = params;

  // Validate adapter exists using the registry directly
  const adapterInfo = registry.getAdapter('contractHandler', adapterName);

  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }

  // Check feature compatibility if specified
  if (neededFeature && !registry.supportsFeature('contractHandler', adapterName, neededFeature)) {
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

  // Set provider if provided
  if (provider && typeof adapter.setProvider === 'function') {
    await adapter.setProvider(provider);
  }

  // Wrap in error handler and return
  return createErrorHandlingProxy(adapter) as T;
}