import { registry, WalletType } from '@m3s/common';
import { EvmWalletAdapter } from './ethersWallet.js';

registry.registerAdapter('wallet', {
  name: 'ethers',
  module: 'wallet',
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: []
});