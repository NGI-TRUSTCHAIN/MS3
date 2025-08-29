import { RuntimeEnvironment, EnvironmentRequirements, Requirement } from '../types/registry.js';
import Joi from 'joi';

/**
 * Recursively analyze JOI schema to generate requirements
 */
function analyzeJoiSchema(schema: Joi.Schema, basePath: string): Requirement[] {
  console.debug(`🔬 [analyzeJoiSchema] Analyzing schema at path: ${basePath}`);

  const requirements: Requirement[] = [];

  try {
    const description = schema.describe();
    console.debug(`📋 [analyzeJoiSchema] Schema description type:`, description.type);
    console.debug(`📋 [analyzeJoiSchema] Schema keys:`, description.keys ? Object.keys(description.keys) : 'NO KEYS');

    if (description.type === 'object' && description.keys) {
      console.debug(`✅ [analyzeJoiSchema] Processing object schema with ${Object.keys(description.keys).length} keys`);

      for (const [key, fieldDesc] of Object.entries(description.keys)) {
        console.debug(`🔑 [analyzeJoiSchema] Processing field: ${key}`);
        console.debug(`📝 [analyzeJoiSchema] Field description:`, fieldDesc);

        const fieldSchema = fieldDesc as any;
        const fieldPath = `${basePath}.${key}`;

        const hasPresenceFlag = fieldSchema.flags?.presence;
        const isRequired = hasPresenceFlag === 'required' || (!hasPresenceFlag && !fieldSchema.flags?.optional);

        let fieldType: string = fieldSchema.type || 'any';
        if (fieldType === 'alternatives' && fieldSchema.matches) {
          fieldType = fieldSchema.matches[0]?.schema?.type || 'any';
        }

        let message = fieldSchema.flags?.description || '';
        if (!message) {
          const mandatory = isRequired ? 'required' : 'optional';
          message = `${key} is ${mandatory} and must be of type: ${fieldType}`;
        }

        console.debug(`📊 [analyzeJoiSchema] Field ${key}: type=${fieldType}, required=${isRequired}, message="${message}"`);

        requirements.push({
          path: fieldPath,
          type: fieldType as any,
          allowUndefined: !isRequired,
          message
        });

        // ✅ Recursively handle nested objects
        if (fieldSchema.type === 'object' && fieldSchema.keys) {
          console.debug(`🔄 [analyzeJoiSchema] Recursing into nested object: ${key}`);
          const nestedRequirements = analyzeJoiSchemaFromDescription(fieldSchema, fieldPath);
          requirements.push(...nestedRequirements);
        }
      }
    } else {
      console.warn(`⚠️ [analyzeJoiSchema] Expected object schema but got type: ${description.type}`);
    }
  } catch (error) {
    console.error(`❌ [analyzeJoiSchema] Failed to analyze schema at ${basePath}:`, error);
  }

  console.info(`📊 [analyzeJoiSchema] Generated ${requirements.length} requirements for ${basePath}`);
  return requirements;
}

/**
 * Helper to analyze from JOI description object (for nested schemas)
 */
function analyzeJoiSchemaFromDescription(description: any, basePath: string): Requirement[] {
  const requirements: Requirement[] = [];

  if (description.keys) {
    for (const [key, fieldDesc] of Object.entries(description.keys)) {
      const fieldSchema = fieldDesc as any;
      const fieldPath = `${basePath}.${key}`;

      const isRequired = fieldSchema.flags?.presence === 'required' ||
        (!fieldSchema.flags?.presence && !fieldSchema.flags?.optional && !fieldSchema.flags?.default);

      let fieldType: string = fieldSchema.type || 'any';
      if (fieldType === 'alternatives' && fieldSchema.matches) {
        fieldType = fieldSchema.matches[0]?.schema?.type || 'any';
      }

      let message = fieldSchema.flags?.description || '';
      if (!message) {
        const mandatory = isRequired ? 'required' : 'optional';
        message = `${key} is ${mandatory} and must be of type: ${fieldType}`;
      }

      requirements.push({
        path: fieldPath,
        type: fieldType as any,
        allowUndefined: !isRequired,
        message
      });

      // Recursive nested objects
      if (fieldSchema.type === 'object' && fieldSchema.keys) {
        const nestedRequirements = analyzeJoiSchemaFromDescription(fieldSchema, fieldPath);
        requirements.push(...nestedRequirements);
      }
    }
  }

  return requirements;
}

/**
 * Fallback for known interfaces
 */
function generateFallbackRequirements(adapterName: string): Requirement[] {
  console.warn(`[getRequirements] No requirements found for ${adapterName} interface - using fallback.`);
  console.warn(`[getRequirements] Using fallback requirements for ${adapterName}`);

  // Known adapter fallbacks
  if (adapterName === 'ethers') {
    return [
      {
        path: 'options.privateKey',
        type: 'string',
        allowUndefined: true,
        message: 'Private key for wallet (generates random if not provided)'
      },
      {
        path: 'options.provider',
        type: 'object',
        allowUndefined: true,
        message: 'Optional provider configuration'
      }
    ];
  }

  if (adapterName === 'web3auth') {
    return [
      {
        path: 'options.web3authConfig',
        type: 'object',
        allowUndefined: false,
        message: 'Web3Auth configuration object is required'
      },
      {
        path: 'options.web3authConfig.clientId',
        type: 'string',
        allowUndefined: false,
        message: 'Your Web3Auth Client ID is required'
      }
    ];
  }

  return [];
}



export function getEnvironments(
  adapterName: string,
  supportedEnvs: RuntimeEnvironment[],
  customLimitations?: string[],
  customSecurityNotes?: string[]
): EnvironmentRequirements {

  const requirements: EnvironmentRequirements = {
    supportedEnvironments: [...supportedEnvs],
    limitations: [...(customLimitations || [])],
    securityNotes: [...(customSecurityNotes || [])]
  };

  // Add default limitations and security notes per environment
  for (const env of supportedEnvs) {
    switch (env) {
      case RuntimeEnvironment.BROWSER:
        requirements.limitations!.push(
          'Requires browser environment with window and document objects',
          'Cannot be used in Node.js server environments',
          'May require user interaction for authentication flows'
        );
        requirements.securityNotes!.push(
          'Ensure secure handling of private keys in browser environment',
          'Consider using hardware wallets for enhanced security'
        );
        break;

      case RuntimeEnvironment.SERVER:
        requirements.limitations!.push(
          'Requires Node.js server environment',
          'Cannot be used in browser environments'
        );
        requirements.securityNotes!.push(
          'Server environments provide better security for sensitive operations',
          'Ensure proper private key management and storage'
        );
        break;
    }
  }

  // Add adapter-specific notes
  requirements.securityNotes!.push(
    `${adapterName} adapter follows standard security practices`
  );

  // Remove duplicates
  requirements.limitations = [...new Set(requirements.limitations)];
  requirements.securityNotes = [...new Set(requirements.securityNotes)];

  return requirements;
}

// /**
//  * ✅ SIMPLIFIED: Basic method signature analysis from compiled JavaScript
//  */
// function analyzeMethodSignature(method: Function, methodName: string): MethodSignature {
//   try {
//     const funcString = method.toString();

//     // ✅ Extract parameters (basic regex)
//     const paramMatch = funcString.match(/\(([^)]*)\)/);
//     const paramString = paramMatch ? paramMatch[1].trim() : '';

//     // ✅ Basic parameter parsing
//     const parameters: Parameter[] = paramString
//       ? paramString.split(',').map(param => {
//         const cleanParam = param.trim();
//         const name = cleanParam.split(/[=:]/)[0].trim().replace(/[{}[\]]/g, '');
//         return {
//           name: name || 'param',
//           type: 'any', // We can't reliably extract types from compiled JS
//           optional: cleanParam.includes('=') || cleanParam.includes('?')
//         };
//       })
//       : [];

//     // ✅ Basic return type inference
//     const isAsync = funcString.includes('async ') || funcString.includes('Promise') || funcString.includes('await ');
//     let returnType = 'any';

//     // Simple patterns
//     if (methodName.startsWith('is') || methodName.startsWith('has')) {
//       returnType = 'boolean';
//     } else if (methodName === 'initialize' || methodName === 'disconnect') {
//       returnType = 'void';
//     }

//     // Wrap in Promise if async
//     if (isAsync && !returnType.includes('Promise')) {
//       returnType = returnType === 'void' ? 'Promise<void>' : `Promise<${returnType}>`;
//     }

//     console.debug(`✅ [analyzeMethodSignature] ${methodName}(${parameters.length} params) -> ${returnType}, async: ${isAsync}`);

//     return {
//       name: methodName,
//       parameters,
//       returnType,
//       isAsync
//     };
//   } catch (error) {
//     console.warn(`❌ [analyzeMethodSignature] Failed to analyze ${methodName}:`, error);
//     return {
//       name: methodName,
//       parameters: [],
//       returnType: 'any',
//       isAsync: false
//     };
//   }
// }

// /**
//  * Extract basic method signatures from compiled JavaScript
//  */
// export function getFeatures(adapterClass: any): MethodSignature[] {
//   if (!adapterClass || typeof adapterClass !== 'function') {
//     console.warn(`[getFeatures] Invalid adapter class provided:`, typeof adapterClass);
//     return [];
//   }

//   console.debug(`🔧 [getFeatures] Analyzing ${adapterClass.name} for method signatures by walking prototype chain.`);

//   const signatures: MethodSignature[] = [];
//   const seenMethods = new Set<string>();

//   let currentProto = adapterClass.prototype;

//   // Walk the prototype chain to find all methods, including those from BaseEvmWallet
//   while (currentProto && currentProto !== Object.prototype) {
//     const methodNames = Object.getOwnPropertyNames(currentProto).filter(name => {
//       // Exclude constructor, private/protected methods (_), and methods we've already added from a child class
//       return name !== 'constructor' && !name.startsWith('_') && !seenMethods.has(name) && typeof currentProto[name] === 'function';
//     });

//     console.debug(`🔍 [getFeatures] Found ${methodNames.length} methods on ${currentProto.constructor.name}:`, methodNames);

//     for (const methodName of methodNames) {
//       seenMethods.add(methodName); // Mark as seen to prevent duplicates from parent prototypes
//       const method = currentProto[methodName];
//       const signature = analyzeMethodSignature(method, methodName);
//       signatures.push(signature);
//     }

//     // Move up the chain to the parent class (e.g., from EvmWalletAdapter to BaseEvmWallet)
//     currentProto = Object.getPrototypeOf(currentProto);
//   }

//   console.debug(`✅ [getFeatures] Generated ${signatures.length} total method signatures for ${adapterClass.name}`);
//   return signatures;
// }

/**
 * ✅ BROWSER-SAFE: Use pre-computed requirements instead of JOI validation
 */
export function getRequirements(
  joiSchema: Joi.Schema | any,
  adapterName: string
): Requirement[] {
  console.debug(`🔍 [getRequirements] Starting analysis for ${adapterName}`);

  // ONLY short‐circuit the ethers adapter to 2 hard‐coded requirements
  if (adapterName.toLowerCase() === 'ethers') {
    console.info(`[getRequirements] Using fallback requirements for ${adapterName}`);
    return generateFallbackRequirements(adapterName);
  }

  // In browser always fallback (no JOI)
  if (typeof window !== 'undefined') {
    console.info(`🌐 [getRequirements] Browser environment - using fallback for ${adapterName}`);
    return generateFallbackRequirements(adapterName);
  }

  // In Node.js, if we have a Joi schema, use it
  if (joiSchema && typeof joiSchema.describe === 'function') {
    try {
      return analyzeJoiSchema(joiSchema, 'options');
    } catch (error) {
      console.error(`❌ [getRequirements] JOI validation failed:`, error);
      // fall through to fallback
    }
  }

  // Fallback for anything else (e.g. unknown adapters)
  return generateFallbackRequirements(adapterName);
}