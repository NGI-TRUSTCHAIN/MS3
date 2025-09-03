import { BrowserProvider, JsonRpcProvider } from 'ethers';
import { NetworkConfig } from '../types/base.js';
import { AdapterError } from '../errors/AdapterError.js';
import { WalletErrorCode } from '../types/error.js';


// A curated list of shared chains to serve as a reliable fallback.
const staticChainList = [
    {
        name: 'Ethereum Mainnet',
        chainId: 1,
        shortName: 'eth',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpc: [
            'https://eth.llamarpc.com',
            'https://ethereum-rpc.publicnode.com',
            'https://1rpc.io/eth',
            'https://cloudflare-eth.com',
        ],
        blockExplorerUrl: 'https://etherscan.io',
        isTestnet: false,
        isStatic: true,
    },
    {
        name: 'Polygon Mainnet',
        chainId: 137,
        shortName: 'matic',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpc: [
            'https://polygon-rpc.com',
            'https://polygon.llamarpc.com',
            'https://polygon.drpc.org',
        ],
        blockExplorerUrl: 'https://polygonscan.com',
        isTestnet: false,
        isStatic: true,
    },
    {
        name: 'Optimism',
        chainId: 10,
        shortName: 'oeth',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpc: [
            'https://mainnet.optimism.io',
            'https://optimism.llamarpc.com',
            'https://optimism.publicnode.com',
        ],
        blockExplorerUrl: 'https://optimistic.etherscan.io',
        isTestnet: false,
        isStatic: true,
    },
    {
        name: 'Arbitrum One',
        chainId: 42161,
        shortName: 'arb1',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpc: [
            'https://arb1.arbitrum.io/rpc',
            'https://arbitrum.llamarpc.com',
            'https://arbitrum-one.public.blastapi.io',
        ],
        blockExplorerUrl: 'https://arbiscan.io',
        isTestnet: false,
        isStatic: true,
    },
    {
        name: 'Holesky',
        chainId: 17000,
        shortName: 'holesky',
        nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
        rpc: ['https://ethereum-holesky.publicnode.com'],
        blockExplorerUrl: 'https://holesky.etherscan.io',
        isTestnet: true,
        isStatic: true,
    },
    {
        name: 'Sepolia',
        chainId: 11155111,
        shortName: 'sep',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpc: [
            'https://rpc.sepolia.org',
            'https://ethereum-sepolia-rpc.publicnode.com',
            'https://endpoints.omniatech.io/v1/eth/sepolia/public',
            'https://eth-sepolia.public.blastapi.io',
        ],
        blockExplorerUrl: 'https://sepolia.etherscan.io',
        isTestnet: true,
        isStatic: true,
    },
];

// Define the structure for your network cache items if it's more specific than NetworkConfig
interface CachedNetworkConfig extends NetworkConfig {
    isStatic?: boolean;
    nativeCurrency?: { name: string; symbol: string; decimals: number };
}

export class NetworkHelper {
    private static instance: NetworkHelper;
    private networkCache: Record<string, CachedNetworkConfig> = {};
    private initializationPromise: Promise<void> | null = null;

    private constructor() {
        // Pre-populate cache with our reliable static list.
        for (const chain of staticChainList) {
            this.addChainToCache(chain);
        }
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
        if (!this.initializationPromise) {
            this.initializationPromise = this.fetchAndMergeExternalChainList();
        }
        await this.initializationPromise;
    }

    private async fetchAndMergeExternalChainList(): Promise<void> {
        try {
            const response = await fetch('https://chainid.network/chains.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch chain list: ${response.statusText}`);
            }
            const externalChains: any[] = await response.json();

            for (const chain of externalChains) {
                // Only add/overwrite if it's not in our static list, or to enrich data.
                const normalizedId = NetworkHelper.normalizeChainId(chain.chainId);
                if (!this.networkCache[normalizedId] || !this.networkCache[normalizedId].isStatic) {
                    this.addChainToCache(chain, false);
                }
            }
        } catch (error) {
            console.warn('[NetworkHelper] Could not fetch external chain list. Using embedded static list only.', error);
        }
    }

    private addChainToCache(chain: any, isStatic: boolean = true): void {
        if (!chain || !chain.chainId) return;

        const normalizedId = NetworkHelper.normalizeChainId(chain.chainId);
        const rpcUrls = (chain.rpc || [])
            .filter((url: string) => url && url.startsWith('http') && !url.includes('${'));

        if (rpcUrls.length === 0 && !isStatic) return; // Don't cache external chains without RPCs

        const config: CachedNetworkConfig = {
            name: chain.name,
            chainId: normalizedId,
            shortName: chain.shortName,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: rpcUrls,
            blockExplorerUrl: chain.explorers?.[0]?.url || chain.blockExplorerUrl,
            // isTestnet: chain.isTestnet ?? (chain.networkId !== 1), // Simple heuristic
            isStatic: isStatic,
            displayName: chain.name,
            decimals: chain.nativeCurrency?.decimals || 18,
            ticker: chain.nativeCurrency?.symbol,
            tickerName: chain.nativeCurrency?.name,
        };

        // Add to cache using multiple identifiers for easy lookup
        this.networkCache[normalizedId] = config;
        this.networkCache[chain.chainId.toString()] = config; // decimal string
        if (chain.shortName) {
            this.networkCache[chain.shortName.toLowerCase()] = config;
        }
        if (chain.name) {
            this.networkCache[chain.name.toLowerCase().replace(/\s+/g, '')] = config;
        }
    }

    public async getNetworkConfig(
        networkIdentifier: string | number,
        preferredRpcUrls: string[] = [],
        useOnlyPreferredRpc: boolean = false
    ): Promise<NetworkConfig | null> {

        await this.ensureInitialized();

        const identifierStr = String(networkIdentifier).toLowerCase().replace(/\s+/g, '');

        const baseConfig = this.networkCache[identifierStr];

        if (!baseConfig || !baseConfig.chainId) {
            return null;
        }

        const uniquePreferred = [...new Set(preferredRpcUrls.filter(url => url))];
        const baseRpcUrls = Array.isArray(baseConfig.rpcUrls) ? baseConfig.rpcUrls : [];
        let urlsToTest: string[] = [];


        if (useOnlyPreferredRpc) {
            if (uniquePreferred.length === 0) {
                console.warn(`[NetworkHelper] getNetworkConfig called with useOnlyPreferredRpc=true but no preferredRpcUrls were provided for ${networkIdentifier}.`);
                return null;
            }
            urlsToTest = uniquePreferred;
        } else {
            urlsToTest = [...uniquePreferred, ...baseRpcUrls.filter(url => !uniquePreferred.includes(url))];
        }

        if (urlsToTest.length === 0) {
            return null;
        }


        const workingUrl = await this.findFirstWorkingRpc(urlsToTest, baseConfig.chainId);


        if (!workingUrl) {
            return null;
        }

        if (!useOnlyPreferredRpc && uniquePreferred.length > 0 && !uniquePreferred.includes(workingUrl)) {
            console.warn(`[NetworkHelper] None of the preferred RPCs worked for ${baseConfig.name}. Using a public RPC: ${workingUrl}. For critical operations, ensure your preferred RPCs are operational.`);
        }

        const orderedRpcUrls = [workingUrl, ...urlsToTest.filter(url => url !== workingUrl)];

        return {
            chainId: baseConfig.chainId,
            name: baseConfig.name,
            displayName: baseConfig.displayName || baseConfig.name,
            rpcUrls: orderedRpcUrls,
            decimals: baseConfig.decimals,
            blockExplorerUrl: baseConfig.blockExplorerUrl,
            ticker: baseConfig.ticker,
            tickerName: baseConfig.tickerName,
            shortName: baseConfig.shortName,
        };
    }

    public async testRpcConnection(url: string, expectedChainId: string | number, timeoutMs: number = 5000): Promise<boolean> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
                signal: controller.signal,
            });

            if (!response.ok) {
                console.warn(`[testRpcConnection] RPC ${url} returned non-ok status: ${response.status}`);
                return false;
            }

            const data = await response.json();
            if (data.error) {
                console.warn(`[testRpcConnection] RPC ${url} returned error: ${data.error.message}`);
                return false;
            }

            const receivedChainId = NetworkHelper.normalizeChainId(data.result);
            const expectedNormalized = NetworkHelper.normalizeChainId(expectedChainId);

            if (receivedChainId !== expectedNormalized) {
                console.warn(`[testRpcConnection] Chain ID mismatch for ${url}: Got ${receivedChainId}, Expected ${expectedNormalized}`);
                return false;
            }

            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error(`[testRpcConnection] Connection timed out for ${url} after ${timeoutMs}ms`);
            } else {
                console.error(`[testRpcConnection] Connection failed for ${url}: ${error.message}`);
            }
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    public async findFirstWorkingRpc(
        urls: string[],
        expectedChainId: string | number,
        timeoutMs: number = 3000
    ): Promise<string | null> {
        for (const url of urls) {
            if (await this.testRpcConnection(url, expectedChainId, timeoutMs)) {
                return url;
            }
        }
        return null;
    }

    public async getProvider(
        input?: unknown,
        preferredRpcUrls: string[] = [],
        chainId?: string | number
    ): Promise<JsonRpcProvider | BrowserProvider> {
        // 1) Ethers Provider already?
        if (input instanceof JsonRpcProvider || input instanceof BrowserProvider) {
            return input;
        }
        // 2) EIP-1193 injected?
        if (input && typeof (input as any).request === 'function') {
            return new BrowserProvider(input as any, 'any');
        }
        // 3) raw URL?
        if (typeof input === 'string') {
            return new JsonRpcProvider(input);
        }
        // 4) NetworkConfig shape?
        if (input && typeof input === 'object' && Array.isArray((input as any).rpcUrls) && (input as any).rpcUrls.length > 0) {
            return new JsonRpcProvider((input as any).rpcUrls[0]);
        }
        // 5) fallback via NetworkHelper lookup
        if (!chainId) {
            throw new AdapterError(
                'No chainId available to pick a public RPC. Supply your own in options.provider.',
                { code: WalletErrorCode.InvalidInput, methodName: 'getProvider' }
            );
        }
        const net = await this.getNetworkConfig(chainId, preferredRpcUrls);
        if (!net || !net.rpcUrls || net.rpcUrls.length === 0) {
            throw new AdapterError(
                `No RPC could be reached for chainId=${chainId}. Please supply at least one working URL in options.provider.rpcUrls.`,
                { code: WalletErrorCode.ConnectionFailed, methodName: 'getProvider' }
            );
        }
        return new JsonRpcProvider(net.rpcUrls[0]);
    }

    public static normalizeChainId(chainId: string | number): string {
        if (typeof chainId === 'number') {
            return `0x${chainId.toString(16).toLowerCase()}`;
        }
        if (typeof chainId === 'string') {
            if (chainId.toLowerCase().startsWith('0x')) {
                return chainId.toLowerCase();
            }
            const num = parseInt(chainId, 10);
            if (!isNaN(num)) {
                return `0x${num.toString(16).toLowerCase()}`;
            }
        }
        throw new AdapterError(`Invalid chainId format: ${chainId}`, { code: WalletErrorCode.InvalidInput });
    }

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
        return config;
    }

    public static filterValidConfigs(
        configs: Record<string, NetworkConfig | null> | Array<NetworkConfig | null>
    ): Record<string, NetworkConfig> | Array<NetworkConfig> {
        const isValid = (config: NetworkConfig | null): config is NetworkConfig =>
            !!config && !!config.chainId && Array.isArray(config.rpcUrls) && config.rpcUrls.length > 0;

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

    public validatePrivateRpcsForChains(
        chainIds: (string | number)[],
        walletRpcs: Record<string, string[]>
    ): { hasAllPrivateRpcs: boolean; missingChains: string[] } {
        const missingChains: string[] = [];

        for (const chainId of chainIds) {
            const normalizedId = NetworkHelper.normalizeChainId(chainId);
            const decimalId = parseInt(normalizedId, 16).toString();

            const hasRpcs = (walletRpcs[normalizedId]?.length > 0) || (walletRpcs[decimalId]?.length > 0);

            if (!hasRpcs) {
                missingChains.push(decimalId);
            }
        }

        return {
            hasAllPrivateRpcs: missingChains.length === 0,
            missingChains
        };
    }
}