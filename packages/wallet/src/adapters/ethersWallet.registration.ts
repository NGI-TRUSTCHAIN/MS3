import { registry } from '@m3s/registry';
import { WalletType } from '../types/index.js';
import { EvmWalletAdapter } from './ethersWallet.js';

registry.registerAdapter('wallet', {
  name: 'ethers',
  module: 'wallet',
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: []
});