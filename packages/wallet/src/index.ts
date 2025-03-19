import { adapterRegistry } from './adapters/registry';
import { BaseWallet } from './wallet.core';
import { ICoreWallet, IWalletOptions } from './types';

// Export main components
export { BaseWallet } from './wallet.core';
export * from './types';
export * from './adapters';

export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {

  const { adapterName } = params

  const adapterInfo = adapterRegistry.getAdapter(adapterName);
  
  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }
  
  // Create a wallet with the adapter
  const wallet = await BaseWallet.create(params);

  // Return it with the appropriate type based on what the caller expects
  return wallet as unknown as T;
}