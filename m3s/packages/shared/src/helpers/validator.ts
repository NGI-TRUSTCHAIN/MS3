import { AdapterError } from '../errors/AdapterError.js';
import { AdapterMetadata } from '../types/registry.js';
import { ModuleArguments } from '../types/base.js';
import {  UniversalRegistry } from '../registry/registry.js';

// Helper function to get a value from a nested path
function getPropertyByPath(obj: any, path: string): any {
  return path.split('.').reduce((currentObject, key) => {
    return (currentObject && typeof currentObject === 'object' && Object.prototype.hasOwnProperty.call(currentObject, key))
      ? currentObject[key]
      : undefined;
  }, obj);
}

export interface ValidatorArguments {
  moduleName: string,
  name: string,
  version: string,
  params: ModuleArguments<any>, // Generic params object
  adapterInfo: AdapterMetadata,
  registry: UniversalRegistry,
  factoryMethodName: string
}

export function validateAdapterParameters(args: ValidatorArguments
): void {
  const { name, version, params, adapterInfo, registry, factoryMethodName } = args
  const { expectedInterface } = params;

  // ✅ NEW: Implement the "Promise & Verify" check from our blueprint.
  if (expectedInterface) {
    const requiredCapabilities = registry.getInterfaceShape(expectedInterface);
    if (!requiredCapabilities) {
      // This is a developer error, the interface shape was likely not registered.
      throw new AdapterError(`Unknown interface shape requested: '${expectedInterface}'. Ensure it is registered in the registry.`, { code: 'INTERNAL_ERROR' });
    }

    const adapterCapabilities = adapterInfo.capabilities || [];
    for (const req of requiredCapabilities) {
      if (!adapterCapabilities.includes(req)) {
        // FAIL FAST! The user's assumption was wrong.
        throw new AdapterError(
          `Adapter '${name}@${version}' does not fully implement the '${expectedInterface}' interface. Missing capability: '${req}'.`,
          { code: 'INCOMPATIBLE_ADAPTER', methodName: factoryMethodName }
        );
      }
    }
  }


  // Check requirements from adapter metadata (adapterInfo.requirements is Requirement[])
  if (adapterInfo.requirements && adapterInfo.requirements.length > 0) {

    for (const req of adapterInfo.requirements) {
      const value = getPropertyByPath(params, req.path); // req.path like "options.privateKey"

      if (value === undefined && !req.allowUndefined) {
        const errorMessage =
          req.message || `Required option '${req.path}' is missing for adapter '${name}'.`;
        throw new AdapterError(errorMessage, {
          methodName: factoryMethodName,
          code: 'MISSING_ADAPTER_REQUIREMENT',
          details: { path: req.path, message: req.message }
        });
      }

      if (req.type && value !== undefined) {
        if (req.type === 'any') {
          // runtime objects (wallets, transports, etc.) are allowed here
          continue;
        }

        const valueType = Array.isArray(value) ? 'array' : typeof value;
        if (valueType !== req.type) {
          const errorMessage =
            req.message ||
            `Required option '${req.path}' for adapter '${name}' must be of type '${req.type}', but received '${valueType}'.`;
          throw new AdapterError(errorMessage, {
            methodName: factoryMethodName,
            code: 'INVALID_ADAPTER_REQUIREMENT_TYPE',
            details: { path: req.path, message: req.message, expectedType: req.type, actualType: valueType }
          });
        }
      }
    }
  }
}