import { AdapterMetadata, Ms3Modules } from '@m3s/shared';
import { getRequirements, getEnvironments, getStaticCompatibilityMatrix } from '@m3s/shared';
import { RuntimeEnvironment } from '@m3s/shared';
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

const adapterMetadata: AdapterMetadata = {
  name: 'contract-template',
  version: '1.0.0',
  module: Ms3Modules.smartcontract,
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: ContractTemplateAdapter,
  capabilities: [],
  requirements: contractRequirements,
  environment: contractEnvironment,
};

export { adapterMetadata as smartContractTemplateAdapterMetadata };
const compatibilityMatrix = getStaticCompatibilityMatrix(Ms3Modules.smartcontract, 'contract-template', '1.0.0');
export { compatibilityMatrix as smartContractTemplateCompatibilityMatrix };


console.debug('✅ Template contract adapter registered with static compatibility matrix');
console.debug('📋 Generated requirements:', contractRequirements);
console.debug('🌍 Generated environment:', contractEnvironment);
console.debug('🔧 Generated capabilities:', adapterMetadata.capabilities.map(c => JSON.parse(JSON.stringify(c))));