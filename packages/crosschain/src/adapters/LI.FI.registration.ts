import { MinimalLiFiAdapter } from './LI.FI.Adapter.js';
import { AdapterMetadata, getEnvironments, getFeatures, getRequirements, registry, RuntimeEnvironment, getStaticCompatibilityMatrix, Capability } from '@m3s/shared';
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
  wallet: Joi.any().optional().description('Wallet adapter instance for transaction execution'),
  rpcOverrides: Joi.any().optional().description('rpcOverrides')
});



const lifiRequirements = getRequirements(lifiOptionsSchema, 'lifi');


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
  capabilities: [
    Capability.AdapterIdentity,
    Capability.AdapterLifecycle,
    Capability.QuoteProvider,
    Capability.OperationExecutor,
    Capability.OperationMonitor,
    Capability.ChainDiscovery,
    Capability.GasEstimator,
    Capability.OperationMaintenance,
    Capability.EventEmitter
  ],
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