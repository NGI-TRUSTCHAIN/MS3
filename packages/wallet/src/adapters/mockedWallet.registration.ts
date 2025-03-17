import { adapterRegistry } from './registry';
import { MockedWalletAdapter } from './mockedWallet';
import { WalletType } from '../types/enums';

adapterRegistry.register({
  name: "mockedWallet",
  adapterType: WalletType['core'],
  adapterClass: MockedWalletAdapter,
  requirements: []
});