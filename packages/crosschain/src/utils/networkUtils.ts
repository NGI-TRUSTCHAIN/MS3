import { JsonRpcProvider } from 'ethers';
import { TEST_PRIVATE_KEY } from '../config.js'

/**
 * Gets the test private key from environment variables
 * @returns The private key to use for testing
 */
export function getTestPrivateKey() {
    // Get the private key from environment variables
    if (!TEST_PRIVATE_KEY) {
        console.warn('⚠️ TEST_PRIVATE_KEY environment variable not found! Using empty string.');
        return '';
    }
    return TEST_PRIVATE_KEY;
}

let networkCache: Record<string, any> = {
    // Default entries ensure basic functionality even if API fails
    ethereum: { chainId: '0x1', name: 'Ethereum Mainnet', rpcUrl: 'https://eth.llamarpc.com', rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth', 'https://cloudflare-eth.com'], blockExplorer: 'https://etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Ethereum Mainnet' },
    sepolia: { chainId: '0xaa36a7', name: 'Sepolia Testnet', rpcUrl: 'https://rpc.sepolia.org', rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/sepolia/public', 'https://eth-sepolia.public.blastapi.io'], blockExplorer: 'https://sepolia.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Sepolia Testnet' },
    goerli: { chainId: '0x5', name: 'Goerli Testnet', rpcUrl: 'https://ethereum-goerli.publicnode.com', rpcUrls: ['https://ethereum-goerli.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/goerli/public'], blockExplorer: 'https://goerli.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Goerli Testnet' },
    arbitrum: { chainId: '0xa4b1', name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://arbitrum-one.public.blastapi.io'], blockExplorer: 'https://arbiscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Arbitrum One' },
    optimism: { chainId: '0xa', name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io', rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://optimism.publicnode.com'], blockExplorer: 'https://optimistic.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Optimism' },
    polygon: { chainId: '0x89', name: 'Polygon Mainnet', rpcUrl: 'https://polygon-rpc.com', rpcUrls: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://polygon.drpc.org'], blockExplorer: 'https://polygonscan.com', ticker: 'MATIC', tickerName: 'Polygon', displayName: 'Polygon Mainnet' }
};
let isLoadingNetworks = false;

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
        console.log('[loadAllNetworks] Fetching networks from ChainList API...');
        // Use fetch with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for API fetch

        const response = await fetch('https://chainlist.org/rpcs.json', { signal: controller.signal });
        clearTimeout(timeoutId); // Clear timeout if fetch succeeded

        if (!response.ok) {
            throw new Error(`Failed to fetch networks: ${response.status} ${response.statusText}`);
        }
        const networks = await response.json();
        console.log(`[loadAllNetworks] Loaded ${networks.length} networks from ChainList API`);

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

// --- Background Loading ---
loadAllNetworks().catch(err => console.error('[networks.ts] Background network loading failed:', err.message));