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

  requirements.securityNotes!.push(
    `${adapterName} adapter follows standard security practices`
  );

  requirements.limitations = [...new Set(requirements.limitations)];
  requirements.securityNotes = [...new Set(requirements.securityNotes)];

  return requirements;
}

/**
 * ✅ BROWSER-SAFE: Use pre-computed requirements instead of JOI validation
 */
export function getRequirements(
  joiSchema: Joi.Schema | any,
  adapterName: string
): Requirement[] {
  console.debug(`🔍 [getRequirements] Starting analysis for ${adapterName}`);

  if (adapterName.toLowerCase() === 'ethers') {
    console.info(`[getRequirements] Using fallback requirements for ${adapterName}`);
    return generateFallbackRequirements(adapterName);
  }

  if (typeof window !== 'undefined') {
    console.info(`🌐 [getRequirements] Browser environment - using fallback for ${adapterName}`);
    return generateFallbackRequirements(adapterName);
  }

  if (joiSchema && typeof joiSchema.describe === 'function') {
    try {
      return analyzeJoiSchema(joiSchema, 'options');
    } catch (error) {
      console.error(`❌ [getRequirements] JOI validation failed:`, error);
    }
  }

  return generateFallbackRequirements(adapterName);
}

