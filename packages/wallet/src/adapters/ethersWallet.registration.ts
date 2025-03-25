import { adapterRegistry } from './registry.js';
import { WalletType } from '../types/index.js';
import { EvmWalletAdapter } from './ethersWallet.js';

adapterRegistry.register({
  name: "ethers",
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: [],
});