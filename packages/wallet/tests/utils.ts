/**
 * Gets the test private key from environment variables
 * @returns The private key to use for testing
 */
export function getTestPrivateKey(): string {
  // Use the env var if available, otherwise use a default for testing
  return process.env.TEST_PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';
}

// Cache for network configs - avoid repeated API calls
let networkCache: Record<string, any> = {
  // Include defaults for fallback
  ethereum: {
    chainId: '0x1',
    name: 'Ethereum Mainnet',
    rpcTarget: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
  },
  sepolia: {
    chainId: '0xaa36a7', 
    name: 'Sepolia Testnet',
    rpcTarget: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
  },
  goerli: {
    chainId: '0x5',
    name: 'Goerli Testnet',
    rpcTarget: 'https://ethereum-goerli.publicnode.com',
    blockExplorer: 'https://goerli.etherscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
  },
  arbitrum: {
    chainId: '0xa4b1',
    name: 'Arbitrum One',
    rpcTarget: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
  },
  optimism: {
    chainId: '0xa',
    name: 'Optimism',
    rpcTarget: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    ticker: 'ETH',
    tickerName: 'Ethereum'
  }
};

// Flag to track if we've initiated loading networks
let isLoadingNetworks = false;

/**
 * Fetches all network configurations from ChainList.org API
 * @returns Promise that resolves when networks are loaded
 */
export async function loadAllNetworks(): Promise<Record<string, any>> {
  if (isLoadingNetworks) {
    // Wait a bit if already loading
    await new Promise(resolve => setTimeout(resolve, 500));
    return networkCache;
  }
  
  isLoadingNetworks = true;
  
  try {
    console.log('Fetching networks from ChainList API...');
    const response = await fetch('https://chainlist.org/rpcs.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch networks: ${response.status}`);
    }
    
    const networks = await response.json();
    console.log(`Loaded ${networks.length} networks from ChainList API`);
    
    // Process and cache networks
    for (const network of networks) {
      const rpcUrl = network.rpc && (
        // Use first available RPC URL
        (typeof network.rpc[0] === 'string' ? network.rpc[0] : network.rpc[0]?.url)
      );
      
      if (!rpcUrl) continue; // Skip networks without valid RPC URL
      
      const formattedNetwork = {
        chainId: `0x${network.chainId.toString(16)}`,
        name: network.name,
        rpcTarget: rpcUrl,
        blockExplorer: network.explorers?.[0]?.url || '',
        ticker: network.nativeCurrency?.symbol || '',
        tickerName: network.nativeCurrency?.name || ''
      };
      
      // Cache by shortName and chainSlug for more flexible lookups
      if (network.shortName) {
        networkCache[network.shortName] = formattedNetwork;
      }
      
      if (network.chainSlug) {
        networkCache[network.chainSlug] = formattedNetwork;
      }
      
      // Also cache by name (lowercase, without spaces)
      const normalizedName = network.name.toLowerCase().replace(/\s+/g, '');
      networkCache[normalizedName] = formattedNetwork;
    }
    
    console.log('Network cache populated successfully');
    return networkCache;
  } catch (error) {
    console.warn('Failed to load networks from ChainList API, using defaults:', error);
    // Continue with defaults
    return networkCache;
  } finally {
    isLoadingNetworks = false;
  }
}

/**
 * Fetches network configuration from ChainList.org API for a specific network
 * @param networkName The name of the network to fetch
 * @returns The network configuration object
 */
export async function fetchChainListNetwork(networkName: string): Promise<any> {
  const normalizedName = networkName.toLowerCase();
  
  try {
    // Check cache first
    if (networkCache[normalizedName]) {
      return networkCache[normalizedName];
    }
    
    // Load all networks if not already cached
    await loadAllNetworks();
    
    // Try to find the network in the cache
    if (networkCache[normalizedName]) {
      return networkCache[normalizedName];
    }
    
    // Try some fallbacks
    if (normalizedName.includes('arbi')) {
      return networkCache.arbitrum || networkCache.arbitrumone;
    }
    
    if (normalizedName.includes('opti')) {
      return networkCache.optimism;
    }
    
    // Default fallback
    console.warn(`Network ${networkName} not found, using sepolia as fallback`);
    return networkCache.sepolia;
  } catch (error) {
    console.warn(`Failed to fetch network ${networkName}:`, error);
    return networkCache[normalizedName] || networkCache.sepolia;
  }
}

/**
 * Gets network configuration for testing, with async API fetch capability
 * @param network The network name to get configuration for
 * @param useCacheOnly If true, only use cached values (no API calls)
 * @returns The network configuration
 */
export async function getChainConfigAsync(network: string = 'sepolia', useCacheOnly: boolean = false): Promise<any> {
  if (useCacheOnly) {
    // Use only cached data
    return getChainConfig(network);
  }
  
  // Try to fetch the network config
  return await fetchChainListNetwork(network);
}

/**
 * Gets network configuration for testing (synchronous version)
 * @param network The network name to get configuration for
 * @returns The network configuration
 */
export function getChainConfig(network: string = 'sepolia'): any {
  const normalizedName = network.toLowerCase();
  return networkCache[normalizedName] || networkCache.sepolia;
}

// Preload networks in the background
loadAllNetworks().catch(err => console.error('Failed to preload networks:', err));