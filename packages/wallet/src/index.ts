import { adapterRegistry } from './adapters/registry.js';
import { ICoreWallet, IWalletOptions } from './types/index.js';
import { WalletAdapterFactory } from './factories/walletAdapterFactory.js';
import { createErrorHandlingProxy } from './errors.js';
import { VersionRepository } from '@m3s/utils/persistence/versionRepository.js';
const pkgJson = require('../package.json') as any;
const version = pkgJson.version;

// Export main components.
export * from './types/index.js';
export * from './adapters/index.js';

export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { adapterName, provider, options, neededFeature } = params;
 
  // Validate adapter exists.
  const adapterInfo = adapterRegistry.getAdapter(adapterName);

  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }

  // Check feature compatibility if specified
  if (neededFeature) {
    const repo = VersionRepository.getInstance();
    const currentVersion = version; // From package.json
    const adapterVersion = '1.0.0'; // Default or get from adapter registry

    const isSupported = repo.checkFeatureSupport({
      moduleName: 'wallet',
      moduleVersion: currentVersion,
      adapterName,
      adapterVersion,
      featureName: neededFeature
    });

    if (!isSupported) {
      throw new Error(
        `Feature '${neededFeature}' is not supported by adapter '${adapterName}' v${adapterVersion}`
      );
    }
  }

  // Create adapter instance directly.
  const factory = await WalletAdapterFactory.create({ adapterName, options });
  const adapter = factory.instance;

  if (!adapter) {
    throw new Error(`Adapter "${adapterName}" initialization error.`);
  }

  // Initialize if needed.
  if (adapter.initialize) {
    await adapter.initialize(params.options);
  }

  // Set provider if provided.
  if (provider && typeof adapter.setProvider === 'function') {
    adapter.setProvider(provider);
  }

  // Wrap in error handler and return.
  return createErrorHandlingProxy(adapter) as T;
}