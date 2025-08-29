import { IBaseContractHandler, SmartContractAdapterOptions } from './types/index.js';
import pkgJson from '../package.json' with { type: "json" };
import { registry, AdapterError, createErrorHandlingProxy, ModuleArguments, validateAdapterParameters, ValidatorArguments, validateEnvironment, Capability, Ms3Modules } from '@m3s/shared';

// Register this module in the registry
registry.registerModule({ name: Ms3Modules.smartcontract, version: pkgJson.version });
import './adapters/index.js';

export * from './types/index.js';
export type { IOpenZeppelinAdapterOptionsV1 } from './adapters/index.js';
export interface IContractOptions extends ModuleArguments<SmartContractAdapterOptions> { }

registry.registerInterfaceShape('IContractHandler', [
  Capability.ContractGenerator,
  Capability.ContractCompiler
]);

/**
 * Creates and returns a contract handler adapter instance based on the provided configuration.
 */
export async function createContractHandler<T extends IBaseContractHandler = IBaseContractHandler>(
  params: IContractOptions
): Promise<T> {
  const { name, version } = params; // 'options' and 'provider' from params are accessed via getPropertyByPath or directly by adapter

  const adapterInfo = registry.getAdapter(Ms3Modules.smartcontract, name, version);

  if (!adapterInfo) {
    // ✅ Show available versions in error
    const availableVersions = registry.getAdapterVersions(Ms3Modules.smartcontract, name);
    const versionsText = availableVersions.length > 0
      ? ` Available versions: ${availableVersions.join(', ')}`
      : '';
    throw new AdapterError(`Adapter '${name}' version '${version}' not found for contractHandler module.${versionsText}`);
  }

  // ✅ ADD: Validate environment before creation
  if (adapterInfo.environment) {
    console.info(`[ContractHandler] Environment requirements for ${name}:`, adapterInfo.environment);
    validateEnvironment(name, adapterInfo.environment);
  }

  // ✅ Updated ValidatorArguments with correct parameter names
  const validatorArgs: ValidatorArguments = {
    moduleName: Ms3Modules.smartcontract,
    name,
    version,
    params,
    adapterInfo,
    registry,
    factoryMethodName: 'createContractHandler'
  };


  validateAdapterParameters(validatorArgs);

  const AdapterClass = adapterInfo.adapterClass;
  if (!AdapterClass || typeof AdapterClass.create !== 'function') {
    throw new AdapterError(`Adapter class or its static 'create' method is invalid for '${name}'.`);
  }

  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new AdapterError(`Adapter '${name}' failed to be created.`, { methodName: 'createContractHandler' });
  }

  // ✅ Preserve all error handling and proxy functionality
    return createErrorHandlingProxy(
      adapter,
      adapterInfo.capabilities,
      adapterInfo.errorMap || {},
      undefined,
      `ContractHandler(${name})`
    ) as T;
}