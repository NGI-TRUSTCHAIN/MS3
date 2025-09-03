
import { AdapterMetadata, getStaticCompatibilityMatrix, getEnvironments, getRequirements, registry, RuntimeEnvironment, Capability, Ms3Modules } from '@m3s/shared';
import { ContractHandlerType } from '../../types/index.js';
import { OpenZeppelinAdapter } from './adapter.js';
import Joi from "joi";

// ✅ JOI schema for OpenZeppelin adapter
export const openZeppelinOptionsSchema = Joi.object({
  workDir: Joi.string().optional().description('Working directory for contract generation'),
  hardhatConfig: Joi.object({
    configFileName: Joi.string().optional().description('Hardhat config file name'),
    customSettings: Joi.object().optional().description('Custom Hardhat settings')
  }).optional().description('Hardhat configuration options'),
  preserveOutput: Joi.boolean().optional().default(false).description('Whether to preserve generated files'),
  providerConfig: Joi.object().optional().description('Network provider configuration'),
  compilerSettings: Joi.object({
    solcVersion: Joi.string().optional().default('0.8.20'),
    optimizer: Joi.boolean().optional().default(true),
    optimizerRuns: Joi.number().optional().default(200)
  }).optional().description('Solidity compiler settings'),
  solcVersion: Joi.string().optional().description('Solidity compiler version')
});

// const openZeppelinRequirements: Requirement[] = [];
const openZeppelinRequirements = getRequirements(openZeppelinOptionsSchema, 'openZeppelin');

const openZeppelinEnvironment = getEnvironments(
  'openZeppelin',
  [RuntimeEnvironment.SERVER],
  [
    'Requires blockchain provider for contract interactions',
    'Contract ABI must be accurate and complete for intended operations'
  ],
  [
    'Contract interactions require proper gas estimation',
    'Ensure contract addresses are verified and trusted',
    'Private key handling follows secure practices when using signerOptions'
  ]
);

const adapterMetadata: AdapterMetadata = {
  name: 'openZeppelin',
  version: '1.0.0',
  module: Ms3Modules.smartcontract,
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: OpenZeppelinAdapter,
  capabilities: [
    Capability.AdapterIdentity,
    Capability.AdapterLifecycle,
    Capability.ContractGenerator,
    Capability.ContractCompiler
  ],
  requirements: openZeppelinRequirements,
  environment: openZeppelinEnvironment,
};

registry.registerAdapter(Ms3Modules.smartcontract, adapterMetadata);

// ✅ REPLACE: Use static compatibility matrix
const compatibilityMatrix = getStaticCompatibilityMatrix(Ms3Modules.smartcontract, 'openZeppelin', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix(Ms3Modules.smartcontract, compatibilityMatrix);
}

console.debug('✅ OpenZeppelin adapter registered with static compatibility matrix');
console.debug('📋 Generated requirements:', openZeppelinRequirements);
console.debug('🔧 Generated capabilities:', adapterMetadata.capabilities.map(c => JSON.parse(JSON.stringify(c))));