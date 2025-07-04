import { AdapterMetadata, registry } from '@m3s/shared';
import { getRequirements, getEnvironments, getFeatures, getStaticCompatibilityMatrix } from '@m3s/shared';
import { WalletTemplateAdapter } from './wallet.js';
import { RuntimeEnvironment } from '@m3s/shared';
import Joi from 'joi';
import { WalletType } from '../../types/index.js';

// ✅ JOI schema for wallet template - matches the naming pattern
export const walletTemplateOptionsSchema = Joi.object({
  option_1: Joi.string().required().description('Required string option'),
  option_2: Joi.object({
    option_2_1: Joi.number().required().description('Required number sub-option'),
    option_2_2: Joi.array().items(Joi.string()).required().description('Required string array sub-option')
  }).required().description('Required nested object option'),
  option_3: Joi.any().optional().description('Optional BigInt option')
});

const walletRequirements = getRequirements(walletTemplateOptionsSchema, 'wallet-template');

const walletEnvironment = getEnvironments(
  'wallet-template',
  [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
  [
    'Template wallet adapter - update limitations as needed'
  ],
  [
    'Template wallet adapter security notes'
  ]
);

const walletFeatures = getFeatures(WalletTemplateAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'wallet-template',
  version: '1.0.0',
  module: 'wallet',
  adapterType: WalletType.evm,
  adapterClass: WalletTemplateAdapter,
  requirements: walletRequirements,
  environment: walletEnvironment,
  features: walletFeatures
};

registry.registerAdapter('wallet', adapterMetadata);

const compatibilityMatrix = getStaticCompatibilityMatrix('wallet', 'wallet-template', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('wallet', compatibilityMatrix);
}

console.log('✅ Template wallet adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', walletRequirements);
console.log('🌍 Generated environment:', walletEnvironment);
console.log('🔧 Generated features:', walletFeatures.map(f => f.name));