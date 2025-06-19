import { MinimalLiFiAdapter } from './LI.FI.Adapter.js';
import { AdapterMetadata, getEnvironments, getFeatures, getRequirements, registry, RuntimeEnvironment, getStaticCompatibilityMatrix } from '@m3s/common';
import Joi from 'joi';
import { CrossChainAdapterType } from '../types/index.js';

// ✅ JOI schema for LiFi adapter
export const lifiOptionsSchema = Joi.object({
  apiKey: Joi.string().optional().description('Optional LiFi API key for enhanced rate limits'),
  timeout: Joi.number().min(5000).max(60000).default(30000).description('Request timeout in milliseconds'),
  retries: Joi.number().integer().min(0).max(5).default(2).description('Number of retry attempts for failed requests'),
  supportedChains: Joi.array().items(
    Joi.object({
      chainId: Joi.number().required(),
      name: Joi.string().required()
    })
  ).optional().description('Override supported chain configurations'),
  slippageConfig: Joi.object({
    defaultSlippage: Joi.number().min(0).max(1).default(0.03).description('Default slippage tolerance (3%)'),
    maxSlippage: Joi.number().min(0).max(1).default(0.1).description('Maximum allowed slippage (10%)')
  }).optional().description('Slippage tolerance configuration'),
  wallet: Joi.any().optional().description('Wallet adapter instance for transaction execution')
});


// const lifiRequirments: Requirement[] = [
//  {
//     path: 'config.apiKey', // Path within the object passed to createCrossChain
//     type: 'string',
//     message: 'LI.FI Adapter requires config.apiKey for most operations.',
//     allowUndefined: true, // If some read-only operations can work without it, or make false if always needed
//   },
//   {
//     path: 'config.provider', // Path to the LiFiExecutionProvider
//     type: 'object', // Assuming LiFiExecutionProvider is an object
//     message: 'LI.FI Adapter requires config.provider (LiFiExecutionProvider) for transaction execution.',
//     allowUndefined: true, // True if the adapter can be initialized for read-only quotes without a provider
//   }
//   // Note: RPC_URL is implicitly handled by the EXECUTION_PROVIDER requirement.
//   // The LiFiExecutionProvider, when created from an M3S wallet, will use the wallet's RPC configuration.
// ]
const lifiRequirements = getRequirements(lifiOptionsSchema, 'lifi');


// const lifiEnvironment: EnvironmentRequirements = {
//   supportedEnvironments: [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
//   securityNotes: [
//     'Requires a compatible M3S wallet adapter for transaction execution',
//     'API key provides enhanced rate limits and features',
//     'Browser usage requires wallet with secure key management (e.g., Web3Auth, hardware wallets)'
//   ],
//   limitations: [
//     'Transaction execution requires a wallet adapter (ethers for server, web3auth for browser)',
//     'Some LiFi features may have different availability across environments',
//     'Browser environments should use wallets with OAuth-based authentication for production'
//   ]
// };
const lifiEnvironment = getEnvironments(
    'lifi',
  [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
  [
    'Requires network connectivity for bridge/swap operations',
    'Dependent on external bridge and DEX protocols',
    'May have varying availability based on source/destination chains'
  ],
  [
    'Cross-chain operations involve multiple protocols and potential attack vectors',
    'Always verify transaction details before signing',
    'Monitor slippage tolerance to prevent value extraction',
    'Consider using API keys for production environments'
  ]
);

const lifiFeatures = getFeatures(MinimalLiFiAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'lifi',
  version: '1.0.0',
  module: 'crosschain',
  adapterType: CrossChainAdapterType.aggregator,
  adapterClass: MinimalLiFiAdapter,
  requirements: lifiRequirements,
  environment: lifiEnvironment,
  features: lifiFeatures
};

registry.registerAdapter('crosschain', adapterMetadata);

// ✅ REPLACE: Use static compatibility matrix
const compatibilityMatrix = getStaticCompatibilityMatrix('crosschain', 'lifi', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('crosschain', compatibilityMatrix);
}

console.log('✅ LiFi adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', lifiRequirements);
console.log('🔧 Generated features:', lifiFeatures.map(f => f.name));