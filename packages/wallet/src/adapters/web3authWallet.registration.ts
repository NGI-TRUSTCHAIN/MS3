import { registry, WalletType } from '@m3s/common';
import { Web3AuthWalletAdapter } from './web3authWallet.js';

registry.registerAdapter('wallet', {
  name: 'web3auth',
  module: 'wallet',
  adapterType: WalletType['web3auth'],
  adapterClass: Web3AuthWalletAdapter,
  requirements: ['web3authConfig']
});