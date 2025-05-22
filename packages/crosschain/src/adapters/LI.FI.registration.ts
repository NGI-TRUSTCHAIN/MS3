import { MinimalLiFiAdapter } from './LI.FI.Adapter.js';
import { CrossChainAdapterType } from '../types/index.js';
import { registry, Requirement } from '@m3s/common';


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

registry.registerAdapter('crosschain', {
  name: 'lifi',
  module: 'crosschain',
  adapterType: CrossChainAdapterType['aggregator'],
  adapterClass: MinimalLiFiAdapter,
  requirements: lifiRequirments,
  // errorMap: { ... } // Define if specific error mappings are needed
});