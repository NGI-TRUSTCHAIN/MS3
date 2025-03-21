import { adapterRegistry } from './adapters/registry';
import { ICoreWallet, IWalletOptions } from './types';
import { WalletAdapterFactory } from './factories/walletAdapterFactory';
import { createErrorHandlingProxy } from './errors';

// Export main components
// export { BaseWallet } from './wallet.core';
export * from './types';
export * from './adapters';

export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { adapterName, provider, options } = params;

  // Validate adapter exists
  const adapterInfo = adapterRegistry.getAdapter(adapterName);
  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }
  
  // Create adapter instance directly
  const factory = await WalletAdapterFactory.create({ adapterName, options });
  const adapter = factory.instance;
  
  if (!adapter) {
    throw new Error(`Adapter "${adapterName}" initialization error.`);
  }
  
  // Initialize if needed
  if (adapter.initialize) {
    await adapter.initialize(params.options);
  }
  
  // Set provider if provided
  if (provider && typeof adapter.setProvider === 'function') {
    adapter.setProvider(provider);
  }
  
  // Wrap in error handler and return
  return createErrorHandlingProxy(adapter) as T;
}