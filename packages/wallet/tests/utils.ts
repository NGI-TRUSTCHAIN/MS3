// import { JsonRpcProvider } from 'ethers';
// import { TEST_PRIVATE_KEY } from '../config.js';

// let networkCache: Record<string, any> = {
//   // Default entries ensure basic functionality even if API fails
//   ethereum: { chainId: '0x1', name: 'Ethereum Mainnet', rpcUrl: 'https://eth.llamarpc.com', rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth', 'https://cloudflare-eth.com'], blockExplorer: 'https://etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Ethereum Mainnet' },
//   sepolia: { chainId: '0xaa36a7', name: 'Sepolia Testnet', rpcUrl: 'https://rpc.sepolia.org', rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/sepolia/public', 'https://eth-sepolia.public.blastapi.io'], blockExplorer: 'https://sepolia.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Sepolia Testnet' },
//   goerli: { chainId: '0x5', name: 'Goerli Testnet', rpcUrl: 'https://ethereum-goerli.publicnode.com', rpcUrls: ['https://ethereum-goerli.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/goerli/public'], blockExplorer: 'https://goerli.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Goerli Testnet' },
//   arbitrum: { chainId: '0xa4b1', name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://arbitrum-one.public.blastapi.io'], blockExplorer: 'https://arbiscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Arbitrum One' },
//   optimism: { chainId: '0xa', name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io', rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://optimism.publicnode.com'], blockExplorer: 'https://optimistic.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Optimism' },
//   polygon: { chainId: '0x89', name: 'Polygon Mainnet', rpcUrl: 'https://polygon-rpc.com', rpcUrls: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://polygon.drpc.org'], blockExplorer: 'https://polygonscan.com', ticker: 'MATIC', tickerName: 'Polygon', displayName: 'Polygon Mainnet' }
// };

// let isLoadingNetworks = false;

// async function testRpcConnection(url: string, expectedChainId: string | number, timeoutMs: number = 5000): Promise<boolean> {
//   try {
//     const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true }); // staticNetwork might help speed up
//     const networkPromise = provider.getNetwork();

//     // Implement timeout manually for the network request
//     const timeoutPromise = new Promise((_, reject) =>
//       setTimeout(() => reject(new Error(`Timeout connecting to ${url}`)), timeoutMs)
//     );

//     const network: any = await Promise.race([networkPromise, timeoutPromise]);

//     // Convert both chainIds for comparison (handle hex/decimal)
//     const networkChainIdStr = network.chainId.toString();
//     const expectedChainIdStr = expectedChainId.toString();
//     const expectedChainIdHex = expectedChainIdStr.startsWith('0x') ? expectedChainIdStr : `0x${parseInt(expectedChainIdStr).toString(16)}`;
//     const expectedChainIdDec = expectedChainIdStr.startsWith('0x') ? parseInt(expectedChainIdStr, 16).toString() : expectedChainIdStr;

//     if (networkChainIdStr !== expectedChainIdHex && networkChainIdStr !== expectedChainIdDec) {
//       console.warn(`[testRpcConnection] RPC ${url} connected but wrong chainId: ${networkChainIdStr} (expected ${expectedChainId})`);
//       return false;
//     }

//     console.log(`[testRpcConnection] RPC ${url} connected successfully with correct chainId.`);
//     return true;
//   } catch (error: any) {
//     console.warn(`[testRpcConnection] Failed to connect to RPC ${url}: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * Gets the test private key from environment variables
//  * @returns The private key to use for testing
//  */
// export function getTestPrivateKey() {
//   // Get the private key from environment variables
//   if (!TEST_PRIVATE_KEY) {
//     console.warn('⚠️ TEST_PRIVATE_KEY environment variable not found! Using empty string.');
//     return '';
//   }
//   return TEST_PRIVATE_KEY;
// }

// /**
//  * Fetches all network configurations from ChainList.org API
//  * @returns Promise that resolves when networks are loaded
//  */
// export async function loadAllNetworks(): Promise<Record<string, any>> {
//   if (isLoadingNetworks) {
//     // Avoid concurrent fetches, wait briefly for existing one to potentially finish
//     await new Promise(resolve => setTimeout(resolve, 1000));
//     return networkCache;
//   }
//   isLoadingNetworks = true;
//   try {
//     console.log('[loadAllNetworks] Fetching networks from ChainList API...');
//     // Use fetch with a timeout
//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for API fetch

//     const response = await fetch('https://chainlist.org/rpcs.json', { signal: controller.signal });
//     clearTimeout(timeoutId); // Clear timeout if fetch succeeded

//     if (!response.ok) {
//       throw new Error(`Failed to fetch networks: ${response.status} ${response.statusText}`);
//     }
//     const networks = await response.json();
//     console.log(`[loadAllNetworks] Loaded ${networks.length} networks from ChainList API`);

//     let processedCount = 0;
//     for (const network of networks) {
//       if (!network.chainId) continue; // Skip entries without chainId

//       // Filter RPC URLs more robustly
//       const filteredRpcUrls = (network.rpc || [])
//         .map((rpc: string | { url: string; tracking?: string }) => (typeof rpc === 'string' ? rpc : rpc?.url))
//         .filter((url: string | undefined): url is string =>
//           !!url &&
//           (url.startsWith('http://') || url.startsWith('https://')) &&
//           !url.includes('/demo') &&
//           !/\{\$?.*\}/.test(url) && // Regex to exclude {VAR} or ${VAR} placeholders
//           !/api_key|api-key|apikey/i.test(url) && // Exclude URLs likely needing API keys in path/query
//           !url.includes('wss://')
//         );

//       if (filteredRpcUrls.length === 0) continue; // Skip if no valid RPCs remain

//       const rpcTarget = filteredRpcUrls[0]; // Use the first valid one as the primary rpcUrl/rpcTarget

//       const formattedNetwork = {
//         chainId: `0x${network.chainId.toString(16)}`,
//         name: network.name,
//         displayName: network.name, // Add displayName
//         rpcTarget: rpcTarget, // Keep for potential legacy use, but prefer rpcUrl
//         rpcUrl: rpcTarget, // Primary RPC URL field
//         rpcUrls: filteredRpcUrls, // Full list of potentially usable RPCs
//         ticker: network.nativeCurrency?.symbol || '',
//         tickerName: network.nativeCurrency?.name || '',
//         blockExplorer: network.explorers?.[0]?.url || '',
//         // Add other potentially useful fields if needed
//         shortName: network.shortName,
//         chainSlug: network.chainSlug,
//       };

//       // Cache using multiple keys for flexibility
//       const normalizedName = network.name.toLowerCase().replace(/\s+/g, '');
//       networkCache[normalizedName] = formattedNetwork;
//       if (network.shortName) networkCache[network.shortName] = formattedNetwork;
//       if (network.chainSlug) networkCache[network.chainSlug] = formattedNetwork;
//       processedCount++;
//     }
//     console.log(`[loadAllNetworks] Processed and cached ${processedCount} networks with valid RPCs.`);
//     return networkCache;
//   } catch (error: any) {
//     console.warn('[loadAllNetworks] Failed to load networks from ChainList API, using defaults:', error.message);
//     return networkCache; // Return default cache on error
//   } finally {
//     isLoadingNetworks = false;
//     console.log('[loadAllNetworks] EXITING function.'); // <<< ADD THIS
//   }
// }

// /**
//  * Fetches network configuration from ChainList.org API for a specific network
//  * @param networkName The name of the network to fetch
//  * @returns The network configuration object
//  */
// export async function fetchChainListNetwork(networkIdentifier: string): Promise<any> {
//   console.log(`[fetchChainListNetwork] ENTERING function for: ${networkIdentifier}`); // <<< ADD THIS

//   const normalizedId = networkIdentifier.toLowerCase();
//   try {
//     // Check cache using multiple potential keys
//     let cachedConfig = networkCache[normalizedId] || networkCache[networkIdentifier]; // Check normalized name and original identifier (for shortName/slug)
//     if (cachedConfig) {
//       // console.log(`[fetchChainListNetwork] Cache hit for ${networkIdentifier}`);
//       return cachedConfig;
//     }

//     // If cache miss, ensure networks are loaded (this might trigger API call)
//     // console.log(`[fetchChainListNetwork] Cache miss for ${networkIdentifier}, ensuring networks are loaded...`);
//     await loadAllNetworks();

//     // Try cache again after loading attempt
//     cachedConfig = networkCache[normalizedId] || networkCache[networkIdentifier];
//     if (cachedConfig) {
//       // console.log(`[fetchChainListNetwork] Found ${networkIdentifier} after loading cache.`);
//       return cachedConfig;
//     }

//     // Apply specific fallbacks if still not found
//     if (normalizedId.includes('arbi')) {
//       const fallback = networkCache.arbitrum || networkCache.arbitrumone;
//       if (fallback) {
//         console.warn(`[fetchChainListNetwork] Network ${networkIdentifier} not found, using Arbitrum fallback.`);
//         return fallback;
//       }
//     }
//     if (normalizedId.includes('opti')) {
//        const fallback = networkCache.optimism;
//        if (fallback) {
//          console.warn(`[fetchChainListNetwork] Network ${networkIdentifier} not found, using Optimism fallback.`);
//          return fallback;
//        }
//     }

//     // Final fallback to Sepolia (ensure Sepolia exists in defaults)
//     console.warn(`[fetchChainListNetwork] Network ${networkIdentifier} not found after fetch, using Sepolia as final fallback.`);
//     return networkCache.sepolia;

//   } catch (error: any) {
//     console.error(`[fetchChainListNetwork] Error fetching network ${networkIdentifier}:`, error.message);
//     // Fallback to cache or Sepolia on error during fetch process
//     return networkCache[normalizedId] || networkCache[networkIdentifier] || networkCache.sepolia;
//   }
// }

// /**
//  * Asynchronously gets network configuration and validates RPC connectivity,
//  * returning a config with the first successfully connected RPC URL.
//  * @param networkIdentifier The name, shortName, or chainSlug of the network.
//  * @returns Promise resolving to the network configuration with a single, validated `rpcUrl`, or `null` if no working RPC is found.
//  */
// export async function getWorkingChainConfigAsync(networkIdentifier: string): Promise<any | null> {
  
//   // Step 1: Get the base configuration using the reliable async fetcher
//   const baseConfig = await fetchChainListNetwork(networkIdentifier);

//   if (!baseConfig || !baseConfig.chainId) {
//     console.error(`[getWorkingChainConfigAsync] No base config found for network: ${networkIdentifier}`);
//     return null;
//   }

//   // Step 2: Extract URLs to test from the base config
//   let urlsToTest: string[] = [];
//   if (Array.isArray(baseConfig.rpcUrls) && baseConfig.rpcUrls.length > 0) {
//       urlsToTest = baseConfig.rpcUrls;
//   } else if (baseConfig.rpcUrl) { // Fallback to single rpcUrl if rpcUrls array is missing/empty
//       urlsToTest = [baseConfig.rpcUrl];
//   }
//   // Note: rpcTarget is less standard, preferring rpcUrl/rpcUrls

//   if (urlsToTest.length === 0) {
//       console.error(`[getWorkingChainConfigAsync] No RPC URLs found in config for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})`);
//       return null;
//   }

//   // Step 3: Test URLs sequentially until one works
//   console.log(`[getWorkingChainConfigAsync] Testing ${urlsToTest.length} RPC(s) for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})...`);
//   for (const url of urlsToTest) {
//     if (await testRpcConnection(url, baseConfig.chainId)) { // Uses updated timeout from testRpcConnection
//       console.log(`[getWorkingChainConfigAsync] Using working RPC: ${url} for ${networkIdentifier}`);
//       // Return a new config object containing only the validated RPC
//       // Ensure it matches the expected ProviderConfig structure
//       return {
//         chainId: baseConfig.chainId,
//         name: baseConfig.name,
//         displayName: baseConfig.displayName || baseConfig.name,
//         rpcUrl: url, // The validated URL is the primary one now
//         rpcUrls: [url], // Keep array with only the working one for consistency
//         blockExplorer: baseConfig.blockExplorer,
//         ticker: baseConfig.ticker,
//         tickerName: baseConfig.tickerName
//         // Copy other relevant fields if needed
//       };
//     }
//   }

//   // Step 4: Handle failure if no URL worked
//   console.error(`[getWorkingChainConfigAsync] No working RPC found for ${networkIdentifier} after testing ${urlsToTest.length} URLs.`);
//   return null; // Indicate failure
// }


// // --- Keep Background Loading ---
// // Initiate loading networks in the background when the module is imported.
// // Errors are caught and logged, allowing the app/tests to continue with defaults.
// loadAllNetworks().catch(err => console.error('[utils.ts] Background network loading failed:', err.message));