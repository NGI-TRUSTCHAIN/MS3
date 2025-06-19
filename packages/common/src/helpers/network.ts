import { JsonRpcProvider } from 'ethers'; // Ensure ethers is a dependency of @m3s/common
import { NetworkConfig } from '../types/base.js';

// Define the structure for your network cache items if it's more specific than NetworkConfig
interface CachedNetworkConfig extends NetworkConfig { }

export class NetworkHelper {
    private networkCache: Record<string, CachedNetworkConfig>;
    private isLoadingNetworks: boolean;
    private static instance: NetworkHelper;
    private initializationPromise: Promise<void> | null = null;

    private constructor() {
        this.networkCache = {
            // Default entries ensure basic functionality even if API fails
            ethereum: { chainId: '0x1', name: 'Ethereum Mainnet', rpcUrls: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth', 'https://cloudflare-eth.com'], blockExplorerUrl: 'https://etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Ethereum Mainnet' },
            sepolia: { chainId: '0xaa36a7', name: 'Sepolia Testnet', rpcUrls: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com', 'https://endpoints.omniatech.io/v1/eth/sepolia/public', 'https://eth-sepolia.public.blastapi.io'], blockExplorerUrl: 'https://sepolia.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Sepolia Testnet' },
            polygon: { chainId: '0x89', name: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://polygon.drpc.org'], blockExplorerUrl: 'https://polygonscan.com', ticker: 'MATIC', tickerName: 'Polygon', displayName: 'Polygon Mainnet' },
            arbitrum: { chainId: '0xa4b1', name: 'Arbitrum One', rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://arbitrum-one.public.blastapi.io'], blockExplorerUrl: 'https://arbiscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Arbitrum One' },
            optimism: { chainId: '0xa', name: 'Optimism', rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://optimism.publicnode.com'], blockExplorerUrl: 'https://optimistic.etherscan.io', ticker: 'ETH', tickerName: 'Ethereum', displayName: 'Optimism' },
        };
        this.isLoadingNetworks = false;
        // Correctly type the initializationPromise
        this.initializationPromise = this.loadAllNetworks()
            .then(() => {
                // Successfully loaded or used defaults, operation considered complete for initialization purposes
            })
            .catch(err => {
                console.error('[NetworkHelper] Background network loading failed:', err.message);
                // Still resolve to void, the error is handled, and initialization attempt is complete
            });
    }

    private async loadAllNetworks(): Promise<Record<string, CachedNetworkConfig>> {
        if (this.isLoadingNetworks) {
            if (this.initializationPromise) await this.initializationPromise;
            return this.networkCache;
        }
        this.isLoadingNetworks = true;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('https://chainlist.org/rpcs.json', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to fetch networks: ${response.status} ${response.statusText}`);
            }

            const networks = await response.json();
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

                const chainIdNum = network.chainId;
                const chainIdHex = `0x${chainIdNum.toString(16)}`;
                const chainIdDecString = chainIdNum.toString();

                const formattedNetwork: CachedNetworkConfig = {
                    chainId: chainIdHex,
                    name: network.name,
                    displayName: network.name,
                    rpcUrls: filteredRpcUrls, // rpcUrls[0] is the primary
                    ticker: network.nativeCurrency?.symbol || '',
                    tickerName: network.nativeCurrency?.name || '',
                    blockExplorerUrl: network.explorers?.[0]?.url || '',
                    shortName: network.shortName,
                    chainSlug: network.chainSlug,
                };

                const normalizedName = network.name.toLowerCase().replace(/\s+/g, '');
                this.networkCache[normalizedName] = formattedNetwork;
                this.networkCache[chainIdDecString] = formattedNetwork;
                this.networkCache[chainIdHex.toLowerCase()] = formattedNetwork;
                if (network.shortName) this.networkCache[network.shortName.toLowerCase()] = formattedNetwork;
                if (network.chainSlug) this.networkCache[network.chainSlug] = formattedNetwork;
            }
        } catch (error: any) {
            console.warn('[NetworkHelper] Failed to load networks from ChainList API, using defaults:', error.message);
        } finally {
            this.isLoadingNetworks = false;
        }
        return this.networkCache;
    }

    /**
     * Filters a collection of NetworkConfig | null objects, returning only valid NetworkConfig objects.
     * A config is considered valid if it's not null, has a chainId, and has at least one RPC URL.
     * @param configs - A Record<string, NetworkConfig | null> or Array<NetworkConfig | null>.
     * @returns A collection of the same type (Record or Array) containing only valid NetworkConfig objects.
     */
    public static filterValidConfigs(
        configs: Record<string, NetworkConfig | null> | Array<NetworkConfig | null>
    ): Record<string, NetworkConfig> | Array<NetworkConfig> {
        const isValid = (config: NetworkConfig | null): config is NetworkConfig =>
            !!config && !!config.chainId && !!config.rpcUrls && config.rpcUrls.length > 0;

        if (Array.isArray(configs)) {
            return configs.filter(isValid);
        } else {
            const result: Record<string, NetworkConfig> = {};
            for (const key in configs) {
                if (Object.prototype.hasOwnProperty.call(configs, key)) {
                    const config = configs[key];
                    if (isValid(config)) {
                        result[key] = config;
                    }
                }
            }
            return result;
        }
    }

    /**
     * Asserts that a given NetworkConfig is valid.
     * Throws an error if the config is null, or missing chainId, or rpcUrls.
     * @param config - The NetworkConfig | null to validate.
     * @param context - Optional context string to include in the error message.
     * @returns The validated NetworkConfig (guaranteed to be non-null and valid).
     * @throws Error if the config is invalid.
     */
    public static assertConfigIsValid(config: NetworkConfig | null, context: string = 'NetworkConfiguration'): NetworkConfig {
        if (!config) {
            throw new Error(`[NetworkHelper] ${context}: Configuration is null or undefined.`);
        }
        if (!config.chainId) {
            throw new Error(`[NetworkHelper] ${context} (Name: ${config.name || 'N/A'}): Missing chainId.`);
        }
        if (!config.rpcUrls || config.rpcUrls.length === 0) {
            throw new Error(`[NetworkHelper] ${context} (Name: ${config.name || 'N/A'}, ChainID: ${config.chainId}): Missing or empty rpcUrls.`);
        }
        // Add any other critical checks if needed
        return config; // Type assertion is safe here due to checks
    }

    public static getInstance(): NetworkHelper {
        if (!NetworkHelper.instance) {
            NetworkHelper.instance = new NetworkHelper();
        }
        return NetworkHelper.instance;
    }

    /**
     * Ensures that the initial loading of networks has attempted to complete.
     */
    public async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    public async testRpcConnection(url: string, expectedChainId: string | number, timeoutMs: number = 5000): Promise<boolean> {
        try {
            const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
            const networkPromise = provider.getNetwork();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout connecting to ${url}`)), timeoutMs)
            );

            const network: any = await Promise.race([networkPromise, timeoutPromise]);
            await provider.destroy();

            const networkChainIdStr = network.chainId.toString();
            const expectedChainIdStr = expectedChainId.toString();

            const expectedHex = expectedChainIdStr.startsWith('0x') ? expectedChainIdStr.toLowerCase() : `0x${parseInt(expectedChainIdStr, 10).toString(16).toLowerCase()}`;
            const expectedDec = expectedChainIdStr.startsWith('0x') ? parseInt(expectedChainIdStr, 16).toString() : expectedChainIdStr;

            if (networkChainIdStr !== expectedHex && networkChainIdStr !== expectedDec) {
                return false;
            }
            return true;
        } catch (error: any) {
            return false;
        }
    }

    public async fetchChainListNetwork(networkIdentifier: string | number): Promise<CachedNetworkConfig | null> {
        await this.ensureInitialized();
        const identifierStr = String(networkIdentifier).toLowerCase();
        let cachedConfig = this.networkCache[identifierStr] || this.networkCache[String(networkIdentifier)];

        if (cachedConfig) {
            return cachedConfig;
        }

        if (identifierStr.includes('arbi')) {
            cachedConfig = this.networkCache.arbitrum || this.networkCache.arbitrumone;
            if (cachedConfig) return cachedConfig;
        }
        if (identifierStr.includes('opti')) {
            cachedConfig = this.networkCache.optimism;
            if (cachedConfig) return cachedConfig;
        }
        if (identifierStr === 'sepolia' || identifierStr === '11155111' || identifierStr === '0xaa36a7') {
            return this.networkCache.sepolia || null;
        }
        return null;
    }

    public async getNetworkConfig(
        networkIdentifier: string | number,
        preferredRpcUrls: string[] = [],
        useOnlyPreferredRpc: boolean = false
    ): Promise<NetworkConfig | null> {
        await this.ensureInitialized();
        const baseConfig = await this.fetchChainListNetwork(String(networkIdentifier));

        if (!baseConfig || !baseConfig.chainId || !baseConfig.rpcUrls || baseConfig.rpcUrls.length === 0) {
            return null;
        }

        const uniquePreferred = [...new Set(preferredRpcUrls.filter(url => url))];
        let urlsToTest: string[] = [];
        let foundInPreferred = false;

        if (uniquePreferred.length > 0) {
            urlsToTest.push(...uniquePreferred);
        }

        if (!useOnlyPreferredRpc) {
            const baseRpcUrlsFromCache = (Array.isArray(baseConfig.rpcUrls) ? baseConfig.rpcUrls : [])
                .filter((url: string) => !uniquePreferred.includes(url));
            urlsToTest.push(...baseRpcUrlsFromCache);
        } else if (uniquePreferred.length === 0) {
            console.warn(`[NetworkHelper] getNetworkConfig called with useOnlyPreferredRpc=true but no preferredRpcUrls were provided for ${networkIdentifier}.`);
            return null;
        }

        if (urlsToTest.length === 0) {
            return null;
        }

        let workingUrl: string | null = null;
        for (const url of urlsToTest) {
            if (await this.testRpcConnection(url, baseConfig.chainId)) {
                workingUrl = url;
                if (uniquePreferred.includes(url)) {
                    foundInPreferred = true;
                }
                break;
            }
        }

        if (!workingUrl) {
            return null;
        }

        if (!useOnlyPreferredRpc && uniquePreferred.length > 0 && !foundInPreferred) {
            console.warn(`[NetworkHelper] None of the preferred RPCs worked for ${baseConfig.name}. Using a public RPC: ${workingUrl}. For critical operations, ensure your preferred RPCs are operational.`);
        }

        const orderedRpcUrls = [workingUrl, ...urlsToTest.filter(url => url !== workingUrl)];

        return {
            chainId: baseConfig.chainId,
            name: baseConfig.name,
            displayName: baseConfig.displayName || baseConfig.name,
            rpcUrls: orderedRpcUrls,
            blockExplorerUrl: baseConfig.blockExplorerUrl,
            ticker: baseConfig.ticker,
            tickerName: baseConfig.tickerName,
            shortName: baseConfig.shortName,
            chainSlug: baseConfig.chainSlug,
        };
    }

    /**
 * Try each URL until one returns a matching chainId within timeout.
 * @returns the first working RPC, or null if none worked.
 */
    public async findFirstWorkingRpc(
        urls: string[],
        expectedChainId: string | number,
        timeoutMs: number = 3000
    ): Promise<string | null> {
        for (const url of urls) {
            try {
                const ok = await this.testRpcConnection(url, expectedChainId, timeoutMs);
                if (ok) return url;
            } catch {
                // swallow and try next
            }
        }
        return null;
    }
}