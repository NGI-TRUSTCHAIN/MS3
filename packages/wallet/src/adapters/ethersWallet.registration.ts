import { adapterRegistry } from './registry.js';
import { WalletType } from '../types/index.js';
import { EvmWalletAdapter } from './etheresWallet.js';

adapterRegistry.register({
  name: "evmWallet",
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: [],
});