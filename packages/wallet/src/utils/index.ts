import { JsonRpcProvider } from 'ethers';
import { NetworkConfig } from '../interfaces/index.js';

let networkCache: Record<string, any> = {
    // Default entries ensure basic functionality even if API fails
    ethereum: { chainId: '0x1', name: 'Ethereum Mainnet', rpcUrl: 'https://eth.llamarpc.com', rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth', 'https://cloudflare-eth.com'], blockExplorer: 'https://etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Ethereum Mainnet' },
    sepolia: { chainId: '0xaa36a7', name: 'Sepolia Testnet', rpcUrl: 'https://rpc.sepolia.org', rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/sepolia/public', 'https://eth-sepolia.public.blastapi.io'], blockExplorer: 'https://sepolia.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Sepolia Testnet' },
    arbitrum: { chainId: '0xa4b1', name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://arbitrum-one.public.blastapi.io'], blockExplorer: 'https://arbiscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Arbitrum One' },
    optimism: { chainId: '0xa', name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io', rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://optimism.publicnode.com'], blockExplorer: 'https://optimistic.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Optimism' },
    polygon: { chainId: '0x89', name: 'Polygon Mainnet', rpcUrl: 'https://polygon-rpc.com', rpcUrls: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://polygon.drpc.org'], blockExplorer: 'https://polygonscan.com', ticker: 'MATIC', tickerName: 'Polygon', displayName: 'Polygon Mainnet' }
};

let isLoadingNetworks = false;

/**
 * Fetches network configuration and validates RPC connectivity, returning a config
 * with an ordered list of RPC URLs (validated one first).
 *
 * @param networkIdentifier - The name, chainId (decimal or hex string), shortName, or chainSlug of the network.
 * @param preferredRpcUrls - Optional array of RPC URLs to test first.
 * @returns Promise resolving to the NetworkConfig with ordered `rpcUrls`, or `null` if no working RPC is found.
 */
export async function getNetworkConfig(
    networkIdentifier: string | number,
    preferredRpcUrls: string[] = []
): Promise<NetworkConfig | null> {

    // 1. Get Base Configuration
    const baseConfig = await fetchChainListNetwork(String(networkIdentifier));

    if (!baseConfig || !baseConfig.chainId) {
        console.error(`[getNetworkConfig] No base config found for network: ${networkIdentifier}`);
        return null;
    }

    // 2. Combine and Deduplicate RPC URLs
    const baseRpcUrls = Array.isArray(baseConfig.rpcUrls) ? baseConfig.rpcUrls : [];
    const uniquePreferred = [...new Set(preferredRpcUrls)];
    const uniqueBase = baseRpcUrls.filter((url: string) => !uniquePreferred.includes(url));
    const combinedUrls = [...uniquePreferred, ...uniqueBase]; // Test preferred first

    if (combinedUrls.length === 0) {
        console.error(`[getNetworkConfig] No RPC URLs found (preferred or base) for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})`);
        return null;
    }

    // 3. Test URLs Sequentially (Preferred first)
    console.log(`[getNetworkConfig] Testing ${combinedUrls.length} RPC(s) for ${baseConfig.name} (Chain ID: ${baseConfig.chainId}). Preferred: ${uniquePreferred.length}`);
    let workingUrl: string | null = null;
    for (const url of combinedUrls) {
        if (await testRpcConnection(url, baseConfig.chainId)) {
            workingUrl = url;
            console.log(`[getNetworkConfig] Found working RPC: ${url} for ${baseConfig.name}`);
            break; // Stop testing after finding the first working URL
        }
    }

    // 4. Handle Failure or Success
    if (!workingUrl) {
        console.error(`[getNetworkConfig] No working RPC found for ${baseConfig.name} after testing ${combinedUrls.length} URLs.`);
        return null;
    }


    // 5. Prepare and Return Ordered Config
    // Move the working URL to the front of the combined list
    const orderedRpcUrls = [workingUrl, ...combinedUrls.filter(url => url !== workingUrl)];

    const networkConfig: NetworkConfig = {
        chainId: baseConfig.chainId, // Use hex chainId from baseConfig
        name: baseConfig.name,
        displayName: baseConfig.displayName || baseConfig.name,
        rpcUrls: orderedRpcUrls, // Return the full list, with the working one guaranteed first
        blockExplorer: baseConfig.blockExplorer,
        ticker: baseConfig.ticker,
        tickerName: baseConfig.tickerName,
        shortName: baseConfig.shortName,
        chainSlug: baseConfig.chainSlug,
    };


    return networkConfig;
}

export async function testRpcConnection(url: string, expectedChainId: string | number, timeoutMs: number = 5000): Promise<boolean> {
    try {
        const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true }); // staticNetwork might help speed up
        const networkPromise = provider.getNetwork();

        // Implement timeout manually for the network request
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout connecting to ${url}`)), timeoutMs)
        );

        const network: any = await Promise.race([networkPromise, timeoutPromise]);

        // Convert both chainIds for comparison (handle hex/decimal)
        const networkChainIdStr = network.chainId.toString();
        const expectedChainIdStr = expectedChainId.toString();
        const expectedChainIdHex = expectedChainIdStr.startsWith('0x') ? expectedChainIdStr : `0x${parseInt(expectedChainIdStr).toString(16)}`;
        const expectedChainIdDec = expectedChainIdStr.startsWith('0x') ? parseInt(expectedChainIdStr, 16).toString() : expectedChainIdStr;

        if (networkChainIdStr !== expectedChainIdHex && networkChainIdStr !== expectedChainIdDec) {
            console.warn(`[testRpcConnection] RPC ${url} connected but wrong chainId: ${networkChainIdStr} (expected ${expectedChainId})`);
            return false;
        }

        return true;
    } catch (error: any) {
        return false;
    }
}

/**
 * Fetches all network configurations from ChainList.org API
 * @returns Promise that resolves when networks are loaded
 */
export async function loadAllNetworks(): Promise<Record<string, any>> {
    if (isLoadingNetworks) {
        // Avoid concurrent fetches, wait briefly for existing one to potentially finish
        await new Promise(resolve => setTimeout(resolve, 1000));
        return networkCache;
    }
    isLoadingNetworks = true;
    try {
        // console.debug('[loadAllNetworks] Fetching networks from ChainList API...');
        // Use fetch with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for API fetch

        const response = await fetch('https://chainlist.org/rpcs.json', { signal: controller.signal });
        clearTimeout(timeoutId); // Clear timeout if fetch succeeded

        if (!response.ok) {
            throw new Error(`Failed to fetch networks: ${response.status} ${response.statusText}`);
        }
        const networks = await response.json();
        // console.debug(`[loadAllNetworks] Loaded ${networks.length} networks from ChainList API`);

        let processedCount = 0;
        for (const network of networks) {
            if (!network.chainId) continue;

            const filteredRpcUrls = (network.rpc || [])
                .map((rpc: string | { url: string; tracking?: string }) => (typeof rpc === 'string' ? rpc : rpc?.url))
                .filter((url: string | undefined): url is string =>
                    !!url &&
                    (url.startsWith('http://') || url.startsWith('https://')) &&
                    !url.includes('/demo') &&
                    !/\{\$?.*\}/.test(url) &&
                    !/api_key|api-key|apikey/i.test(url) &&
                    !url.includes('wss://')
                );

            if (filteredRpcUrls.length === 0) continue;

            const rpcTarget = filteredRpcUrls[0];
            const chainIdNum = network.chainId;
            const chainIdHex = `0x${chainIdNum.toString(16)}`;
            const chainIdDecString = chainIdNum.toString();

            const formattedNetwork = {
                chainId: chainIdHex,
                name: network.name,
                displayName: network.name,
                rpcTarget: rpcTarget,
                rpcUrl: rpcTarget, // Keep for potential backward compatibility? Decide later.
                rpcUrls: filteredRpcUrls,
                ticker: network.nativeCurrency?.symbol || '',
                tickerName: network.nativeCurrency?.name || '',
                blockExplorer: network.explorers?.[0]?.url || '',
                shortName: network.shortName,
                chainSlug: network.chainSlug,
            };

            const normalizedName = network.name.toLowerCase().replace(/\s+/g, '');
            networkCache[normalizedName] = formattedNetwork;
            networkCache[chainIdDecString] = formattedNetwork;
            networkCache[chainIdHex] = formattedNetwork;
            if (network.shortName) networkCache[network.shortName.toLowerCase()] = formattedNetwork;
            if (network.chainSlug) networkCache[network.chainSlug] = formattedNetwork;
            processedCount++;
        }
        return networkCache;
    } catch (error: any) {
        console.warn('[loadAllNetworks] Failed to load networks from ChainList API, using defaults:', error.message);
        return networkCache; // Return default cache on error
    } finally {
        isLoadingNetworks = false;
    }
}

/**
 * Fetches network configuration from ChainList.org API for a specific network
 * @param networkName The name of the network to fetch
 * @returns The network configuration object
 */
export async function fetchChainListNetwork(networkIdentifier: string): Promise<any> {

    if (!networkIdentifier) {
        throw new Error('networkIdentifier is required')
    }

    const identifierStr = String(networkIdentifier).toLowerCase();

    try {
        let cachedConfig = networkCache[identifierStr] || networkCache[String(networkIdentifier)];

        if (cachedConfig) {
            return cachedConfig;
        }

        await loadAllNetworks();

        cachedConfig = networkCache[identifierStr] || networkCache[String(networkIdentifier)];
        if (cachedConfig) {
            return cachedConfig;
        }

        console.error(`[fetchChainListNetwork] Network ${networkIdentifier} NOT FOUND in cache or defaults.`);
        return null;

    } catch (error: any) {
        console.error(`[fetchChainListNetwork] Error fetching network ${networkIdentifier}:`, error.message);
        const cachedOnError = networkCache[identifierStr] || networkCache[String(networkIdentifier)];
        if (cachedOnError) return cachedOnError;
        if (identifierStr === 'sepolia' || identifierStr === '11155111' || identifierStr === '0xaa36a7') return networkCache.sepolia;
        return null;
    }
}

/**
 * Asynchronously gets network configuration and validates RPC connectivity,
 * returning a config with the first successfully connected RPC URL.
 * @param networkIdentifier The name, shortName, or chainSlug of the network.
 * @returns Promise resolving to the network configuration with a single, validated `rpcUrl`, or `null` if no working RPC is found.
 */
export async function getWorkingChainConfigAsync(networkIdentifier: string): Promise<any | null> {
  
  // Step 1: Get the base configuration using the reliable async fetcher
  const baseConfig = await fetchChainListNetwork(networkIdentifier);

  if (!baseConfig || !baseConfig.chainId) {
    console.error(`[getWorkingChainConfigAsync] No base config found for network: ${networkIdentifier}`);
    return null;
  }

  // Step 2: Extract URLs to test from the base config
  let urlsToTest: string[] = [];
  if (Array.isArray(baseConfig.rpcUrls) && baseConfig.rpcUrls.length > 0) {
      urlsToTest = baseConfig.rpcUrls;
  } else if (baseConfig.rpcUrl) { // Fallback to single rpcUrl if rpcUrls array is missing/empty
      urlsToTest = [baseConfig.rpcUrl];
  }
  // Note: rpcTarget is less standard, preferring rpcUrl/rpcUrls

  if (urlsToTest.length === 0) {
      console.error(`[getWorkingChainConfigAsync] No RPC URLs found in config for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})`);
      return null;
  }

  // Step 3: Test URLs sequentially until one works
  // console.debug(`[getWorkingChainConfigAsync] Testing ${urlsToTest.length} RPC(s) for ${networkIdentifier} (Chain ID: ${baseConfig.chainId})...`);
  for (const url of urlsToTest) {
    if (await testRpcConnection(url, baseConfig.chainId)) { // Uses updated timeout from testRpcConnection
      // console.debug(`[getWorkingChainConfigAsync] Using working RPC: ${url} for ${networkIdentifier}`);
      // Return a new config object containing only the validated RPC
      // Ensure it matches the expected ProviderConfig structure
      return {
        chainId: baseConfig.chainId,
        name: baseConfig.name,
        displayName: baseConfig.displayName || baseConfig.name,
        rpcUrl: url, // The validated URL is the primary one now
        rpcUrls: [url], // Keep array with only the working one for consistency
        blockExplorer: baseConfig.blockExplorer,
        ticker: baseConfig.ticker,
        tickerName: baseConfig.tickerName
        // Copy other relevant fields if needed
      };
    }
  }

  // Step 4: Handle failure if no URL worked
  console.error(`[getWorkingChainConfigAsync] No working RPC found for ${networkIdentifier} after testing ${urlsToTest.length} URLs.`);
  return null; // Indicate failure
}

// --- Background Loading ---
loadAllNetworks().catch(err => console.error('[networks.ts] Background network loading failed:', err.message));