import { adapterRegistry } from './registry';
import { WalletType } from '../types/enums';
import { EvmWalletAdapter } from './etheresWallet';
import { EVMWallet } from '../types/interfaces/EVM';

adapterRegistry.register({
  name: "evmWallet",
  adapterType: WalletType['evm'],
  adapterClass: EvmWalletAdapter,
  requirements: [],
});