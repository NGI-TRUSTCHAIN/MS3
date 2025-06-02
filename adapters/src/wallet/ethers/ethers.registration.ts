import { Requirement, EnvironmentRequirements, RuntimeEnvironment, registry, WalletType } from '@m3s/wallet';
import { EvmWalletAdapter } from './ethers.adapter.js';

const ethersRequirements: Requirement[] = [
  {
    path: 'options.privateKey',
    type: 'string',
    allowUndefined: true, // Can generate random if not provided
    message: 'Private key for wallet (optional - will generate random if not provided)'
  }
];

const ethersEnvironment: EnvironmentRequirements = {
  supportedEnvironments: [RuntimeEnvironment.SERVER],
  securityNotes: [
    'Private keys are stored in memory and should only be used in secure server environments',
    'Never use this adapter in browser/client-side applications where private keys could be exposed'
  ],
  limitations: [
    'This adapter is designed for server-side use only due to private key security requirements.'
  ]
};

registry.registerAdapter('wallet', {
  name: 'ethers',
  version: '1.0.0',
  module: 'wallet',
  adapterType: WalletType.evm,
  adapterClass: EvmWalletAdapter,
  requirements: ethersRequirements,
  environment: ethersEnvironment, // ✅ Add environment info
});