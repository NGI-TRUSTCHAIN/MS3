import { adapterRegistry } from './registry.js';
import { MockedWalletAdapter } from './mockedWallet.js';
import { WalletType } from '../types/index.js';

adapterRegistry.register({
  name: "mockedWallet",
  adapterType: WalletType['core'],
  adapterClass: MockedWalletAdapter,
  requirements: [],
});