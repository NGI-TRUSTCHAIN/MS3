import { adapterRegistry } from './registry';
import { WalletType } from '../types';
import { EvmWalletAdapter } from './etheresWallet';

adapterRegistry.register({
  name: "evmWallet",
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: [],
});