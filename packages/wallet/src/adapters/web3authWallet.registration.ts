import { WalletType } from '../types/enums';
import { adapterRegistry } from './registry';
import { Web3AuthWalletAdapter } from './web3authWallet';

adapterRegistry.register({
  name: "web3auth",
  adapterType: WalletType['evm'], // Web3Auth is EVM-compatible
  adapterClass: Web3AuthWalletAdapter,
  requirements: ["web3authConfig"]
});