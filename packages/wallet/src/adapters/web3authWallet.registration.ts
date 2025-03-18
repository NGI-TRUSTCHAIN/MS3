import { WalletType } from '../types';
import { adapterRegistry } from './registry';
import { Web3AuthWalletAdapter } from './web3authWallet';

/**
 * Register the Web3AuthWalletAdapter with the adapter registry
 */
adapterRegistry.register({
  name: "web3auth",
  adapterType: WalletType['web3auth'],
  adapterClass: Web3AuthWalletAdapter,
  requirements: ["web3authConfig"]
});