import { AdapterMetadata, registry } from '@m3s/common';
import { getRequirements, getEnvironments, getFeatures, getStaticCompatibilityMatrix } from '@m3s/common';
import { EvmWalletAdapter } from './ethersWallet.js';
import { WalletType } from '../../types/index.js';
import { RuntimeEnvironment } from '@m3s/common';
import Joi from 'joi';

// ✅ PROFESSIONAL: JOI schema for ethers
export const ethersOptionsSchema = Joi.object({
  privateKey: Joi.string().optional().description('Private key for wallet (generates random if not provided)'),
  provider: Joi.any().optional().description('Optional provider configuration')
});

const ethersRequirements = getRequirements(ethersOptionsSchema, 'ethers');

const ethersEnvironment = getEnvironments(
  'ethers',
  [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
  [
    'Browser environments should use secure key sources (hardware wallets, secure storage)',
    'Consider Web3Auth adapter for OAuth-based browser authentication flows'
  ],
  [
    'Private keys are processed during wallet creation but not stored persistently',
    'Server environments provide better security for sensitive private key operations',
    'Browser usage requires secure private key handling by the application'
  ]
);

const ethersFeatures = getFeatures(EvmWalletAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'ethers',
  version: '1.0.0',
  module: 'wallet',
  adapterType: WalletType.evm,
  adapterClass: EvmWalletAdapter,
  requirements: ethersRequirements,
  environment: ethersEnvironment,
  features: ethersFeatures
};

registry.registerAdapter('wallet', adapterMetadata);

// ✅ REPLACE: Use static compatibility matrix
const compatibilityMatrix = getStaticCompatibilityMatrix('wallet', 'ethers', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('wallet', compatibilityMatrix);
}

console.log('✅ Ethers wallet adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', ethersRequirements);
console.log('🌍 Generated environment:', ethersEnvironment);
console.log('🔧 Generated features:', ethersFeatures.map(f => f.name));