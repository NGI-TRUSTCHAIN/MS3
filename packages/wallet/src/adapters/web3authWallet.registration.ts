import { WalletType } from '../types/enums';
import { adapterRegistry } from './registry';
import { Web3AuthWalletAdapter } from './web3authWallet';

/**
 * Register the Web3AuthWalletAdapter with the adapter registry
 */
adapterRegistry.register({
  name: "web3auth",
  adapterType: WalletType['evm'], // Web3Auth is EVM-compatible
  adapterClass: Web3AuthWalletAdapter,
  requirements: ["web3authConfig"]
});