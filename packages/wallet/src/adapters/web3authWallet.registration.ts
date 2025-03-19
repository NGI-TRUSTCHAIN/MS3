import { adapterRegistry } from './registry';
import { WalletType } from '../types';
import { Web3AuthWalletAdapter } from './web3authWallet';

adapterRegistry.register({
  name: "web3auth",
  adapterType: WalletType['web3auth'],
  adapterClass: Web3AuthWalletAdapter,
  requirements: ["web3authConfig"],
});