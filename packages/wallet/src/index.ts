import pkgJson from '../package.json' with { type: "json" };
import {registry, createErrorHandlingProxy, ICoreWallet, IWalletOptions} from '@m3s/common'

// Register this module in the registry
registry.registerModule({ name: 'wallet', version: pkgJson.version });

// Export main components.
export * from './interfaces/index.js';
export * from './adapters/index.js';
export * from './utils/index.js'

/**
 * Creates and returns a wallet adapter instance based on the provided configuration.
 *
 * This factory function looks up the specified adapter (`adapterName`) in the registry,
 * validates the provided options against the adapter's requirements, and creates
 * an instance of the adapter class using its static `create` method. The returned instance
 * is wrapped in an error handling proxy to provide standardized `AdapterError` exceptions.
 *
 * **Note:** After creating the wallet instance, you typically need to call the
 * `initialize()` method on the instance before using other wallet functions.
 * Some adapters might also require calling `setProvider()` or similar methods
 * to establish a network connection or complete setup.
 *
 * @template T - The expected wallet interface type (e.g., `IEVMWallet`, `ICoreWallet`). Defaults to `ICoreWallet`.
 * @param {IWalletOptions} params - Configuration options for creating the wallet adapter.
 * @param {string} params.adapterName - The name of the wallet adapter to create (e.g., 'ethers', 'web3auth', 'mocked'). Must be registered.
 * @param {object} [params.options] - Adapter-specific configuration options. The required structure depends on the `adapterName`. See specific adapter documentation for details (e.g., `privateKey` for 'ethers', `web3authConfig` for 'web3auth').
 * @param {ProviderConfig | any} [params.provider] - Optional initial provider configuration. How this is used depends on the specific adapter's `create` method. Often set via `setProvider()` after creation/initialization.
 * @param {string} [params.neededFeature] - An optional feature string (method name) to ensure the selected adapter supports it before creation.
 *
 * @returns {Promise<T>} A promise that resolves to the created wallet adapter instance, wrapped in an error handling proxy.
 *
 * @throws {AdapterError} If the `adapterName` is not registered in the 'wallet' module.
 * @throws {AdapterError} If `neededFeature` is specified but not supported by the adapter class prototype.
 * @throws {AdapterError} If required `options` (defined in the adapter's metadata) for the specified adapter are missing within `params.options`.
 * @throws {AdapterError} If the adapter's static `create` method fails or returns an invalid instance. The original error is wrapped.
 *
 * @example // Creating an EVM wallet using the 'ethers' adapter
 * ```typescript
 * import { createWallet, IEVMWallet, IWalletOptions, ProviderConfig } from '@m3s/wallet';
 *
 * const sepoliaConfig: ProviderConfig = {
 *   chainId: '11155111',
 *   rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
 *   displayName: 'Sepolia Testnet',
 *   nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
 *   blockExplorerUrls: ['https://sepolia.etherscan.io']
 * };
 *
 * const params: IWalletOptions = {
 *   adapterName: 'ethers',
 *   options: {
 *     privateKey: '0xYOUR_PRIVATE_KEY_HERE' // Replace with a real private key for testing
 *   }
 *   // Provider can be set later using wallet.setProvider(sepoliaConfig)
 * };
 *
 * async function setupWallet() {
 *   try {
 *     const wallet = await createWallet<IEVMWallet>(params);
 *     await wallet.initialize(); // Initialize the adapter
 *     await wallet.setProvider(sepoliaConfig); // Connect to the network
 *
 *     if (wallet.isConnected()) {
 *       const accounts = await wallet.getAccounts();
 *       console.log('Ethers Wallet Connected Account:', accounts[0]);
 *       const network = await wallet.getNetwork();
 *       console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
 *     }
 *   } catch (error) {
 *     console.error("Failed to set up ethers wallet:", error);
 *   }
 * }
 *
 * setupWallet();
 * ```
 *
 * @example // Creating a Web3Auth wallet
 * ```typescript
 * import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';
 * import { Web3AuthOptions } from '@web3auth/modal'; // Assuming Web3AuthOptions is the type for web3authConfig
 *
 * const web3authConfig: Web3AuthOptions = { // Use the actual type if available
 *   clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Replace with your Client ID
 *   web3AuthNetwork: "sapphire_devnet", // Or "sapphire_mainnet", "mainnet", etc.
 *   chainConfig: {
 *     chainNamespace: "eip155" as const,
 *     chainId: "0xaa36a7", // Sepolia Testnet Chain ID
 *     rpcTarget: "https://rpc.sepolia.org",
 *     displayName: "Sepolia Testnet",
 *     blockExplorer: "https://sepolia.etherscan.io/",
 *     ticker: "ETH",
 *     tickerName: "Ethereum"
 *   },
 *   // uiConfig, loginConfig etc. can be added here
 * };
 *
 * const params: IWalletOptions = {
 *   adapterName: 'web3auth',
 *   options: { web3authConfig } // Pass the config object under the expected key
 * };
 *
 * async function setupWeb3Auth() {
 *   try {
 *     const wallet = await createWallet<IEVMWallet>(params);
 *     await wallet.initialize(); // Initialize Web3Auth SDK
 *
 *     // Request accounts triggers the login flow if not already logged in
 *     const accounts = await wallet.requestAccounts();
 *     console.log('Web3Auth Connected Account:', accounts[0]);
 *
 *     const network = await wallet.getNetwork(); // Network info comes from Web3Auth config/state
 *     console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
 *
 *     // You can now use the wallet instance
 *     // await wallet.signMessage("Hello!");
 *
 *   } catch (error) {
 *     console.error("Failed to set up Web3Auth wallet:", error);
 *   }
 * }
 *
 * setupWeb3Auth();
 * ```
 * @public
 */
export async function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T> {
  const { adapterName, options, neededFeature } = params;

  // --- Registry Interaction ---
  const adapterInfo = registry.getAdapter('wallet', adapterName);

  if (!adapterInfo) {
    throw new Error(`Unknown adapter: ${adapterName}`);
  }

  // Check feature compatibility if specified
  if (neededFeature && !registry.supportsFeature('wallet', adapterName, neededFeature)) {
    throw new Error(`Feature '${neededFeature}' is not supported by adapter '${adapterName}'`);
  }

  // Check requirements if any
  if (adapterInfo.requirements && adapterInfo.requirements.length > 0) {
    for (const req of adapterInfo.requirements) {
      if (!options || !(req in options)) {
        throw new Error(`Required option '${req}' missing for adapter '${adapterName}'`);
      }
    }
  }

  // Get adapter class directly from registry
  const AdapterClass = adapterInfo.adapterClass;

  // Create adapter instance
  const adapter = await AdapterClass.create(params);

  if (!adapter) {
    throw new Error(`Adapter "${adapterName}" initialization error.`);
  }

  // Wrap in error handler and return
  return createErrorHandlingProxy(adapter) as T;
}