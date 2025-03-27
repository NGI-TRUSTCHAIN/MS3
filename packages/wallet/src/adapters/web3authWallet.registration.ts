import { registry } from '../registry.js';
import { WalletType } from '../types/index.js';
import { Web3AuthWalletAdapter } from './web3authWallet.js';

registry.registerAdapter('wallet', {
  name: 'web3auth',
  module: 'wallet',
  adapterType: WalletType['web3auth'],
  adapterClass: Web3AuthWalletAdapter,
  requirements: ['web3authConfig']
});