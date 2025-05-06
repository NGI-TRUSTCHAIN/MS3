// import { fetchChainListNetwork, testRpcConnection } from '../utils/networkUtils.js';

// /**
//  * Represents the configuration for a specific blockchain network.
//  */
// export interface NetworkConfig {
//   chainId: string; // Hexadecimal string (e.g., '0x1')
//   name: string;
//   displayName: string;
//   rpcUrls: string[]; // Array of RPC URLs, ordered by preference/validation
//   blockExplorer?: string;
//   ticker?: string;
//   tickerName?: string;
//   shortName?: string;
//   chainSlug?: string;
// }

// /**
//  * Fetches network configuration and validates RPC connectivity, returning a config
//  * with an ordered list of RPC URLs (validated one first).
//  *
//  * @param networkIdentifier - The name, chainId (decimal or hex string), shortName, or chainSlug of the network.
//  * @param preferredRpcUrls - Optional array of RPC URLs to test first.
//  * @returns Promise resolving to the NetworkConfig with ordered `rpcUrls`, or `null` if no working RPC is found.
//  */
// export async function getNetworkConfig(
//   networkIdentifier: string | number,
//   preferredRpcUrls: string[] = []
// ): Promise<NetworkConfig | null> {

//   // 1. Get Base Configuration
//   const baseConfig = await fetchChainListNetwork(String(networkIdentifier));

//   if (!baseConfig || !baseConfig.chainId) {
//     console.error(`[getNetworkConfig] No base config found for network: ${networkIdentifier}`);
//     return null;
//   }

//   // 2. Combine and Deduplicate RPC URLs
//   const baseRpcUrls = Array.isArray(baseConfig.rpcUrls) ? baseConfig.rpcUrls : [];
//   const uniquePreferred = [...new Set(preferredRpcUrls)];
//   const uniqueBase = baseRpcUrls.filter((url: string) => !uniquePreferred.includes(url));
//   const combinedUrls = [...uniquePreferred, ...uniqueBase]; // Test preferred first

//  if (combinedUrls.length === 0) {
//     console.error(`[getNetworkConfig] No RPC URLs found (preferred or base) for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})`);
//     return null;
//   }

//   // 3. Test URLs Sequentially (Preferred first)
//   console.log(`[getNetworkConfig] Testing ${combinedUrls.length} RPC(s) for ${baseConfig.name} (Chain ID: ${baseConfig.chainId}). Preferred: ${uniquePreferred.length}`);
//   let workingUrl: string | null = null;
//   for (const url of combinedUrls) {
//     if (await testRpcConnection(url, baseConfig.chainId)) {
//       workingUrl = url;
//       console.log(`[getNetworkConfig] Found working RPC: ${url} for ${baseConfig.name}`);
//       break; // Stop testing after finding the first working URL
//     }
//   }

//   // 4. Handle Failure or Success
//   if (!workingUrl) {
//     console.error(`[getNetworkConfig] No working RPC found for ${baseConfig.name} after testing ${combinedUrls.length} URLs.`);
//     return null;
//   }


//   // 5. Prepare and Return Ordered Config
//   // Move the working URL to the front of the combined list
//   const orderedRpcUrls = [workingUrl, ...combinedUrls.filter(url => url !== workingUrl)];

//   const networkConfig: NetworkConfig = {
//     chainId: baseConfig.chainId, // Use hex chainId from baseConfig
//     name: baseConfig.name,
//     displayName: baseConfig.displayName || baseConfig.name,
//     rpcUrls: orderedRpcUrls, // Return the full list, with the working one guaranteed first
//     blockExplorer: baseConfig.blockExplorer,
//     ticker: baseConfig.ticker,
//     tickerName: baseConfig.tickerName,
//     shortName: baseConfig.shortName,
//     chainSlug: baseConfig.chainSlug,
//   };


//   return networkConfig;
// }