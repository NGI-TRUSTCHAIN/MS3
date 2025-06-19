import { AdapterMetadata, registry } from '@m3s/common';
import { getRequirements, getEnvironments, getFeatures, getStaticCompatibilityMatrix } from '@m3s/common';
import { RuntimeEnvironment } from '@m3s/common';
import Joi from 'joi';
import { ContractTemplateAdapter } from './contract.js';
import { ContractHandlerType } from '../../index.js';

// ✅ JOI schema for contract template - matches the naming pattern
export const contractTemplateOptionsSchema = Joi.object({
  option_1: Joi.string().required().description('Required string option'),
  option_2: Joi.object({
    option_2_1: Joi.number().required().description('Required number sub-option'),
    option_2_2: Joi.array().items(Joi.string()).required().description('Required string array sub-option')
  }).required().description('Required nested object option'),
  option_3: Joi.any().optional().description('Optional BigInt option')
});

const contractRequirements = getRequirements(contractTemplateOptionsSchema, 'contract-template');

const contractEnvironment = getEnvironments(
  'contract-template',
  [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
  [
    'Template contract adapter - update limitations as needed'
  ],
  [
    'Template contract adapter security notes'
  ]
);

const contractFeatures = getFeatures(ContractTemplateAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'contract-template',
  version: '1.0.0',
  module: 'smart-contract',
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: ContractTemplateAdapter,
  requirements: contractRequirements,
  environment: contractEnvironment,
  features: contractFeatures
};

registry.registerAdapter('smart-contract', adapterMetadata);

const compatibilityMatrix = getStaticCompatibilityMatrix('smart-contract', 'contract-template', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('smart-contract', compatibilityMatrix);
}

console.log('✅ Template contract adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', contractRequirements);
console.log('🌍 Generated environment:', contractEnvironment);
console.log('🔧 Generated features:', contractFeatures.map(f => f.name));