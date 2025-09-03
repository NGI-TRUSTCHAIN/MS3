import { IBaseContractHandler, SmartContractAdapterOptions } from './types/index.js';
import pkgJson from '../package.json' with { type: "json" };
import { AdapterError, createErrorHandlingProxy, ModuleArguments, validateAdapterParameters, ValidatorArguments, validateEnvironment, Capability, Ms3Modules, UniversalRegistry } from '@m3s/shared';
import { smartContractAdapters } from './adapters/registration.js';

export const smartContractRegistry = new UniversalRegistry();

// Register this module in the registry
smartContractRegistry.registerModule({ name: Ms3Modules.smartcontract, version: pkgJson.version });
Object.values(smartContractAdapters).forEach((adapter: any) => {
  if (adapter.meta) {
    smartContractRegistry.registerAdapter(Ms3Modules.smartcontract, adapter.meta);
  }
  if (adapter.matrix) {
    smartContractRegistry.registerCompatibilityMatrix(Ms3Modules.smartcontract, adapter.matrix);
  }
});

import './adapters/index.js';

export * from './types/index.js';
export type { IOpenZeppelinAdapterOptionsV1 } from './adapters/index.js';
export interface IContractOptions extends ModuleArguments<SmartContractAdapterOptions> { }

smartContractRegistry.registerInterfaceShape('IContractHandler', [
  Capability.ContractGenerator,
  Capability.ContractCompiler
]);

/**
 * Creates and returns a contract handler adapter instance based on the provided configuration.
 */
export async function createContractHandler<T extends IBaseContractHandler = IBaseContractHandler>(
  params: IContractOptions
): Promise<T> {
  const { name, version } = params;

  const adapterInfo = version
    ? smartContractRegistry.getAdapter(Ms3Modules.smartcontract, name, version)
    : smartContractRegistry.getLatestAdapter(Ms3Modules.smartcontract, name);

if (!adapterInfo) {
    const availableVersions = smartContractRegistry.getAdapterVersions(Ms3Modules.smartcontract, name);
    const versionsText = availableVersions.length > 0
      ? ` Available versions: ${availableVersions.join(', ')}`
      : ' No versions of this adapter are registered.';
    const requestedVersionText = version ? `version '${version}'` : '(latest version)';

    throw new AdapterError(`Adapter '${name}' ${requestedVersionText} not found for contractHandler module.${versionsText}`);
  }

  // ✅ ADD: Validate environment before creation
  if (adapterInfo.environment) {
    // Removed console.info for cleaner output
    validateEnvironment(name, adapterInfo.environment);
  }

  // ✅ Updated ValidatorArguments with correct parameter names
  const validatorArgs: ValidatorArguments = {
    moduleName: Ms3Modules.smartcontract,
    name,
    version: adapterInfo.version,
    params,
    adapterInfo,
    registry: smartContractRegistry,
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