import { AdapterMetadata, Capability, Ms3Modules } from '@m3s/shared';
import { getRequirements, getEnvironments, getStaticCompatibilityMatrix } from '@m3s/shared';
import { EvmWalletAdapter } from './ethersWallet.js';
import { WalletType } from '../../types/index.js';
import { RuntimeEnvironment } from '@m3s/shared';
import Joi from 'joi';

// ✅ PROFESSIONAL: JOI schema for ethers
export const ethersOptionsSchema = Joi.object({
  privateKey: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .description("Private key for wallet (generates random if not provided)"),
  provider: Joi.object({
    name: Joi.string().required().description("Real Chain name"),
    chainId: Joi.string()
      .pattern(/^0x[0-9a-fA-F]+$/)
      .required()
      .description("Hex chain ID (e.g., 0xaa36a7)"),
    rpcUrls: Joi.array()
      .items(
        Joi.string()
          .uri({ scheme: ["https"] })
          .required()
      )
      .min(1)
      .required()
      .description("Array of HTTPS RPC URLs"),
    displayName: Joi.string().required().description("Wallet display label for the chain")
  })
    .optional()
    .description('Optional provider configuration'),

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

const adapterMetadata: AdapterMetadata = {
  name: 'ethers',
  version: '1.0.0',
  module: Ms3Modules.wallet,
  adapterType: WalletType.evm,
  adapterClass: EvmWalletAdapter,
  capabilities: [
    Capability.CoreWallet,
    Capability.EventEmitter,
    Capability.MessageSigner,
    Capability.TransactionHandler,   
    Capability.RPCHandler,
    Capability.TypedDataSigner,
    Capability.GasEstimation,
    Capability.TokenOperations,
    Capability.TransactionStatus,
    Capability.AdapterLifecycle
  ],
  requirements: ethersRequirements,
  environment: ethersEnvironment,
};
export { adapterMetadata as ethersAdapterMetadata };

// registry.registerAdapter(Ms3Modules.wallet, adapterMetadata);

// ✅ REPLACE: Use static compatibility matrix
const compatibilityMatrix = getStaticCompatibilityMatrix(Ms3Modules.wallet, 'ethers', '1.0.0');
export { compatibilityMatrix as ethersCompatibilityMatrix };

// if (compatibilityMatrix) {
//   registry.registerCompatibilityMatrix(Ms3Modules.wallet, compatibilityMatrix);
// }

console.debug('✅ Ethers wallet adapter registered with static compatibility matrix');
console.debug('📋 Generated requirements:', ethersRequirements);
console.debug('🌍 Generated environment:', ethersEnvironment);
console.debug('🔧 Generated capabilities:', adapterMetadata.capabilities.map(c => JSON.parse(JSON.stringify(c))));