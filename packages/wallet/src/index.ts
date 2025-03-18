import { adapterRegistry } from './adapters/registry';
import { BaseWallet } from './wallet.core';
import { ICoreWallet, IWalletOptions } from './types/interfaces';

// Export main components
export { BaseWallet } from './wallet.core';
export * from './types/interfaces';
export * from './adapters';


export function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): T {

  const { adapterName,neededFeature, provider, options } = params

  const adapterInfo = adapterRegistry.getAdapter(adapterName);
  
  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }
  
  // Create a wallet with the adapter
  const wallet = new BaseWallet(params
    // adapterName, neededFeature, provider, options
  );
  
  // Return it with the appropriate type based on what the caller expects
  return wallet as unknown as T;
}