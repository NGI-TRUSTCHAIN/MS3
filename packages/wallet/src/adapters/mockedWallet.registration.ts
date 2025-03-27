import { registry } from '@m3s/registry';
import { WalletType } from '../types/index.js';
import { MockedWalletAdapter } from './mockedWallet.js';

registry.registerAdapter('wallet', {
  name: 'mocked',
  module: 'wallet',
  adapterType: WalletType['core'],
  adapterClass: MockedWalletAdapter,
  requirements: []
});