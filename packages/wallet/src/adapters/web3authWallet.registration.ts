import { adapterRegistry } from './registry.js';
import { WalletType } from '../types/index.js';
import { web3authWalletAdapter } from './web3authWallet.js';

adapterRegistry.register({
  name: "web3auth",
  adapterType: WalletType['web3auth'], 
  adapterClass: web3authWalletAdapter,
  requirements: [],
});
