import { AdapterMetadata, Ms3Modules } from '@m3s/shared';
import { getRequirements, getEnvironments, getStaticCompatibilityMatrix } from '@m3s/shared';
import { WalletTemplateAdapter } from './wallet.js';
import { RuntimeEnvironment } from '@m3s/shared';
import Joi from 'joi';
import { WalletType } from '../../types/index.js';
import { walletRegistry as registry } from '../../../src/index.js';

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

const adapterMetadata: AdapterMetadata = {
  name: 'wallet-template',
  version: '1.0.0',
  module: Ms3Modules.wallet,
  adapterType: WalletType.evm,
  adapterClass: WalletTemplateAdapter,
  capabilities: [],
  requirements: walletRequirements,
  environment: walletEnvironment,
};

registry.registerAdapter(Ms3Modules.wallet, adapterMetadata);

const compatibilityMatrix = getStaticCompatibilityMatrix(Ms3Modules.wallet, 'wallet-template', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix(Ms3Modules.wallet, compatibilityMatrix);
}

console.debug('✅ Template wallet adapter registered with static compatibility matrix');
console.debug('📋 Generated requirements:', walletRequirements);
console.debug('🌍 Generated environment:', walletEnvironment);
console.debug('🔧 Generated capabilities:', adapterMetadata.capabilities.map(c => JSON.parse(JSON.stringify(c))));