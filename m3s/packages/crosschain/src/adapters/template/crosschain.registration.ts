import { CrosschainTemplateAdapter } from './crosschain.js';
import { AdapterMetadata, getEnvironments, getRequirements, registry, RuntimeEnvironment, getStaticCompatibilityMatrix, Ms3Modules } from '@m3s/shared';
import Joi from 'joi';
import { CrossChainAdapterType } from '../../types/index.js';

export const crosschainTemplateOptionsSchema = Joi.object({
  option_1: Joi.string().required().description('Required string option'),
  option_2: Joi.object({
    option_2_1: Joi.number().required().description('Required number sub-option'),
    option_2_2: Joi.array().items(Joi.string()).required().description('Required string array sub-option')
  }).required().description('Required nested object option'),
  option_3: Joi.any().optional().description('Optional BigInt option')
});

const crosschainRequirements = getRequirements(crosschainTemplateOptionsSchema, 'crosschain-template');

const crosschainEnvironment = getEnvironments(
  'crosschain-template',
  [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
  [
    'Template crosschain adapter - update limitations as needed'
  ],
  [
    'Template crosschain adapter security notes'
  ]
);

const adapterMetadata: AdapterMetadata = {
  name: 'crosschain-template',
  version: '1.0.0',
  module: Ms3Modules.crosschain,
  adapterType: CrossChainAdapterType.bridge,
  adapterClass: CrosschainTemplateAdapter,
  capabilities: [],
  requirements: crosschainRequirements,
  environment: crosschainEnvironment,
};

registry.registerAdapter(Ms3Modules.crosschain, adapterMetadata);

const compatibilityMatrix = getStaticCompatibilityMatrix(Ms3Modules.crosschain, 'crosschain-template', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix(Ms3Modules.crosschain, compatibilityMatrix);
}

console.debug('✅ Template crosschain adapter registered with static compatibility matrix');
console.debug('📋 Generated requirements:', crosschainRequirements);
console.debug('🌍 Generated environment:', crosschainEnvironment);
console.debug('🔧 Generated capabilities:', adapterMetadata.capabilities.map(c => JSON.parse(JSON.stringify(c))));