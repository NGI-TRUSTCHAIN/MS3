import { registry } from '../registry.js';
import { WalletType } from '../types/index.js';
import { EvmWalletAdapter } from './ethersWallet.js';

registry.registerAdapter('wallet', {
  name: 'ethers',
  module: 'wallet',
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: []
});