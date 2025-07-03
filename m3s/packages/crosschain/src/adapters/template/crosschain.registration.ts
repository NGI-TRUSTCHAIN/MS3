import { CrosschainTemplateAdapter } from './crosschain.js';
import { AdapterMetadata, getEnvironments, getFeatures, getRequirements, registry, RuntimeEnvironment, getStaticCompatibilityMatrix } from '@m3s/common';
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

const crosschainFeatures = getFeatures(CrosschainTemplateAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'crosschain-template',
  version: '1.0.0',
  module: 'crosschain',
  adapterType: CrossChainAdapterType.bridge,
  adapterClass: CrosschainTemplateAdapter,
  requirements: crosschainRequirements,
  environment: crosschainEnvironment,
  features: crosschainFeatures
};

registry.registerAdapter('crosschain', adapterMetadata);

const compatibilityMatrix = getStaticCompatibilityMatrix('crosschain', 'crosschain-template', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('crosschain', compatibilityMatrix);
}

console.log('✅ Template crosschain adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', crosschainRequirements);
console.log('🌍 Generated environment:', crosschainEnvironment);
console.log('🔧 Generated features:', crosschainFeatures.map(f => f.name));