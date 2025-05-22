import { registry, Requirement } from '@m3s/common';
import { EvmWalletAdapter } from './ethersWallet.js';
import { WalletType } from '../types/index.js';

const evmRequirements: Requirement[] = [];

registry.registerAdapter('wallet', {
  name: 'ethers',
  module: 'wallet',
  adapterType: WalletType.evm, // Use WalletType.evm if it's an enum
  adapterClass: EvmWalletAdapter,
  requirements: evmRequirements, // <<< Use the new requirements structure
  // errorMap: { ... } // Define if specific error mappings are needed for this adapter
});