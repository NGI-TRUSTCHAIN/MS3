import { AdapterError } from '../errors/AdapterError.js';
import { AdapterMetadata } from '../types/registry.js';
import { ModuleArguments } from '../types/base.js';
import { getPropertyByPath, UniversalRegistry } from '../registry/registry.js';



export interface ValidatorArguments {
  moduleName: string,
  name: string,
  version: string,
  params: ModuleArguments<any, any>, // Generic params object
  adapterInfo: AdapterMetadata,
  registry: UniversalRegistry,
  factoryMethodName: string
}

export function validateAdapterParameters(args: ValidatorArguments
): void {
  const { moduleName, name, version, params, adapterInfo, registry, factoryMethodName } = args
  const { neededFeature } = params; // neededFeature here is a string

  console.log('Validator - arguments, ', args)

  // Check feature compatibility if specified (neededFeature is a string)
  if (neededFeature && typeof neededFeature === 'string') {
    console.log('Validator - neededFeature, ', neededFeature)

    if (!registry.supportsFeature(moduleName, name, version, neededFeature)) {
      throw new AdapterError(
        `Feature '${neededFeature}' is not supported by adapter '${name}' for module '${moduleName}'.`,
        { 
          methodName: factoryMethodName,
          code: 'FEATURE_NOT_SUPPORTED',
          details: { feature: neededFeature } }
      );
    }
  } else if (neededFeature && !Array.isArray(neededFeature) && typeof neededFeature !== 'string') {
    // Handle cases where neededFeature might be something else unexpected, like an object not an array
    console.warn(`[validateAdapterParameters] 'neededFeature' for ${name} is of an unexpected type: ${typeof neededFeature}. It should typically be a string.`);
  }


  // Check requirements from adapter metadata (adapterInfo.requirements is Requirement[])
  if (adapterInfo.requirements && adapterInfo.requirements.length > 0) {
    console.log('Validator - adapterInfo, ', adapterInfo)

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