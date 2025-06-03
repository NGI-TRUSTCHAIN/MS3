import { CrossChainAdapterType, EnvironmentRequirements, registry, Requirement, RuntimeEnvironment } from '@m3s/crosschain';
import { MinimalLiFiAdapter } from './lifi.adapter';


const lifiRequirments: Requirement[] = [
 {
    path: 'config.apiKey', // Path within the object passed to createCrossChain
    type: 'string',
    message: 'LI.FI Adapter requires config.apiKey for most operations.',
    allowUndefined: true, // If some read-only operations can work without it, or make false if always needed
  },
  {
    path: 'config.provider', // Path to the LiFiExecutionProvider
    type: 'object', // Assuming LiFiExecutionProvider is an object
    message: 'LI.FI Adapter requires config.provider (LiFiExecutionProvider) for transaction execution.',
    allowUndefined: true, // True if the adapter can be initialized for read-only quotes without a provider
  }
  // Note: RPC_URL is implicitly handled by the EXECUTION_PROVIDER requirement.
  // The LiFiExecutionProvider, when created from an M3S wallet, will use the wallet's RPC configuration.
]

const lifiEnvironment: EnvironmentRequirements = {
  supportedEnvironments: [RuntimeEnvironment.BROWSER],
  limitations: [
    'Requires browser environment for wallet client interactions.',
    'User interaction needed for transaction signing and chain switching.',
    'Server-side execution limited to quote generation only.',
    'Depends on browser-based wallet providers (MetaMask, WalletConnect, etc.).'
  ]
};

registry.registerAdapter('crosschain', {
  name: 'lifi',
  version: '1.0.0',
  module: 'crosschain',
  adapterType: CrossChainAdapterType['aggregator'],
  adapterClass: MinimalLiFiAdapter,
  environment: lifiEnvironment,
  requirements: lifiRequirments,
});