import { IBaseContractHandler, SmartContractAdapterOptions } from './types/index.js';
import pkgJson from '../package.json' with { type: "json" };
import { registry, AdapterError, createErrorHandlingProxy, ModuleArguments, validateAdapterParameters, ValidatorArguments } from '@m3s/common';

// Register this module in the registry
registry.registerModule({ name: 'contractHandler', version: pkgJson.version });

import './adapters/index.js';
export * from './types/index.js';
export { AdapterError };
export type { IOpenZeppelinAdapterOptionsV1 } from './adapters/index.js';

interface IContractOptions extends ModuleArguments<string, SmartContractAdapterOptions>{} 

/**
 * Creates and returns a contract handler adapter instance based on the provided configuration.
 */
export async function createContractHandler<T extends IBaseContractHandler = IBaseContractHandler>(
    params: IContractOptions
): Promise<T> {
  const { adapterName } = params; // 'options' and 'provider' from params are accessed via getPropertyByPath or directly by adapter

  const adapterInfo = registry.getAdapter('contractHandler', adapterName);

  if (!adapterInfo) {
    throw new AdapterError(`Adapter '${adapterName}' not found or not registered for the contractHandler module.`);
  }

 const validatorArgs: ValidatorArguments = {
    moduleName: 'smart-contract',
    adapterName,
    params,
    adapterInfo,
    registry,
    factoryMethodName: 'createContractHandler'
  };

  validateAdapterParameters(validatorArgs);

  const AdapterClass = adapterInfo.adapterClass;
  if (!AdapterClass || typeof AdapterClass.create !== 'function') {
      throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${adapterName}'.`);
  }

  // The 'create' method of adapters like OpenZeppelinAdapter expects IContractOptions (or its specific args type)
  // The 'provider' parameter from IContractOptions is not explicitly used here for setProvider,
  // as adapters like OpenZeppelinAdapter handle provider setup internally via options.providerConfig
  // or expect a wallet with a provider for operations.
  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new AdapterError(`Adapter '${adapterName}' failed to be created.`, { methodName: 'createContractHandler' });
  }


  return createErrorHandlingProxy(
      adapter,
      adapterInfo.errorMap || {},
      undefined,
      `ContractHandler(${adapterName})`
  ) as T;
}