import { AdapterMetadata, getStaticCompatibilityMatrix, getEnvironments, getFeatures, getRequirements, registry, RuntimeEnvironment, Capability } from '@m3s/shared';
import { Web3AuthWalletAdapter } from './web3authWallet.js';
import { WalletType } from '../../../types/index.js';
import Joi from 'joi';

// ✅ PROFESSIONAL: Define explicit JOI schema
export const web3AuthOptionsSchema = Joi.object({
  web3authConfig: Joi.object({
    clientId: Joi.string().required().description('Your Web3Auth Client ID'),
    web3AuthNetwork: Joi.string().valid('sapphire_mainnet', 'sapphire_devnet', 'testnet').required()
      .description('Web3Auth Network environment'),
    chainConfig: Joi.object({
      chainNamespace: Joi.string().default('eip155'),
      chainId: Joi.string().required().description('Blockchain chain ID (hexadecimal)'),
      rpcTarget: Joi.string().uri().required().description('RPC endpoint URL'),
      displayName: Joi.string().required().description('Network display name'),
      blockExplorerUrl: Joi.string().uri().required().description('Block explorer URL'),
      ticker: Joi.string().required().description('Native token ticker (e.g., ETH)'),
      tickerName: Joi.string().required().description('Native token name (e.g., Ethereum)')
    }).required().description('Blockchain configuration'),
    loginConfig: Joi.object().required().description('OAuth provider configuration'),
    privateKeyProvider: Joi.any().optional().description('Optional private key provider')
  }).required().description('Web3Auth configuration object'),

  // ✅ NEW: Add multiChainRpcs option (same as ethers)
  multiChainRpcs: Joi.object()
    .pattern(
      Joi.alternatives().try(
        Joi.string().pattern(/^0x[0-9a-fA-F]+$/), // Hex chain ID
        Joi.string().pattern(/^\d+$/)              // Decimal chain ID
      ),
      Joi.array()
        .items(Joi.string().uri({ scheme: ["https", "http"] }))
        .min(1)
        .description("Array of RPC URLs for this chain")
    )
    .optional()
    .description("Multi-chain RPC configuration - maps chain IDs to RPC URL arrays")
});

const web3authRequirements = getRequirements(web3AuthOptionsSchema, 'web3auth');

const web3authEnvironment = getEnvironments(
  'web3auth',
  [RuntimeEnvironment.BROWSER], // Browser only
  [
    'Requires browser environment with Web3Auth SDK',
    'Cannot be used in Node.js server environments',
    'Requires user interaction for OAuth flows'
  ],
  [
    'Web3Auth handles private key generation securely',
    'OAuth-based authentication provides better UX',
    'Private keys reconstructed in memory only'
  ]
);

const web3authFeatures = getFeatures(Web3AuthWalletAdapter);

const adapterMetadata: AdapterMetadata = {
  name: 'web3auth',
  version: '1.0.0',
  module: 'wallet',
  adapterType: WalletType.web3auth,
  adapterClass: Web3AuthWalletAdapter,
   /** ✅ ADD: Define the capabilities this adapter implements. */
   capabilities: [
     Capability.CoreWallet,
     Capability.EventEmitter,
     Capability.MessageSigner,
     Capability.TransactionHandler,
     Capability.TypedDataSigner,
     Capability.GasEstimation,
     Capability.TokenOperations,
     Capability.RPCHandler,
     Capability.TransactionStatus,
         Capability.AdapterLifecycle
   ],
  requirements: web3authRequirements,
  environment: web3authEnvironment,
  features: web3authFeatures
};

registry.registerAdapter('wallet', adapterMetadata);

// ✅ REPLACE: Use static compatibility matrix
const compatibilityMatrix = getStaticCompatibilityMatrix('wallet', 'web3auth', '1.0.0');
if (compatibilityMatrix) {
  registry.registerCompatibilityMatrix('wallet', compatibilityMatrix);
}

console.log('✅ Web3Auth wallet adapter registered with static compatibility matrix');
console.log('📋 Generated requirements:', web3authRequirements);
console.log('🌍 Generated environment:', web3authEnvironment);
console.log('🔧 Generated features:', web3authFeatures.map(f => f.name));