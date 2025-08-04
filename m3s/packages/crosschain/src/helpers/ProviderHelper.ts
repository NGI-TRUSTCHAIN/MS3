
import {
    createWalletClient,
    http,
    fallback,
    WalletClient,
    Chain,
    LocalAccount,
    Address,
    Hex,
    SignableMessage,
    TransactionSerializable,
    TypedDataDefinition,
    TypedData,
} from 'viem';

import * as viemChains from 'viem/chains';
import { EIP712TypedData, GenericTransactionData, IEVMWallet, NetworkConfig } from '@m3s/wallet';

import { NetworkHelper } from '@m3s/shared';
import { ethers } from 'ethers';
/** Recursively turn every bigint into a string. */
export function sanitizeBigInts<T>(obj: T): T {
    if (typeof obj === 'bigint') {
        return obj.toString() as any;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeBigInts) as any;
    }
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, sanitizeBigInts(v)])
        ) as any;
    }
    return obj;
}

/**
 * Maps a chain ID (number or hex string) to a Viem Chain object.
 * @param chainId - The chain ID to map.
 * @returns The corresponding Viem Chain object or undefined if not found.
 */
function getViemChain(chainId: number | string): Chain | undefined {
    const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, chainId.startsWith('0x') ? 16 : 10) : chainId;
    for (const key in viemChains) {
        const chain = (viemChains as any)[key] as Chain;
        if (chain.id === chainIdNum) {
            return chain;
        }
    }
    console.warn(`[getViemChain] Viem chain definition not found for chainId: ${chainIdNum}`);
    return undefined;
}

/**
 * Creates a Viem CustomAccount wrapper around an M3S IEVMWallet.
 * This allows Viem to use the M3S wallet for signing without needing the private key directly.
 *
 * @param wallet - The initialized IEVMWallet instance.
 * @param address - The address associated with the wallet.
 * @returns A Viem CustomAccount object.
 */
function createM3sViemAccount(wallet: IEVMWallet, address: Address): LocalAccount<'custom', Address> {
    return {
        address: address,
        type: 'local',
        source: 'custom',
        publicKey: address,

        async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
            console.log("[ProviderHelper:ViemAccount] Delegating signMessage to M3S wallet");
            const messageContent = typeof message === 'string' ? message : (message.raw as string); // Ensure string
            return await wallet.signMessage(messageContent) as Hex;
        },

        async signTransaction(
            _transaction: TransactionSerializable,
        ): Promise<Hex> {
            console.log("[ProviderHelper:ViemAccount] Delegating signTransaction to M3S wallet");
            const transaction = sanitizeBigInts(_transaction);

            const m3sTx: GenericTransactionData = {
                to: transaction.to as string | undefined,
                value: transaction.value ? ethers.formatEther(transaction.value.toString()) : undefined,
                data: transaction.data,
                options: {
                    chainId: transaction.chainId,
                    nonce: transaction.nonce,
                    gasLimit: transaction.gas?.toString(),
                    gasPrice: transaction.gasPrice?.toString(),
                    maxFeePerGas: transaction.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
                }
            };

            console.log('createM3sViemAccount - signTransaction', m3sTx)

            if (m3sTx.options) {
                Object.keys(m3sTx.options).forEach(key =>
                    (m3sTx.options as any)[key] === undefined && delete (m3sTx.options as any)[key]
                );
                if (Object.keys(m3sTx.options).length === 0) delete m3sTx.options;
            }

            if (m3sTx.to === undefined) delete m3sTx.to;
            if (m3sTx.value === undefined) delete m3sTx.value;
            if (m3sTx.data === undefined) delete m3sTx.data;

            console.log('createM3sViemAccount - signTransaction 2', m3sTx)

            console.log("[ProviderHelper:ViemAccount] Mapped m3sTx for signTransaction:", m3sTx);
            return await wallet.signTransaction(m3sTx) as Hex;
        },

        async signTypedData<
            const TTypedData extends TypedData | Record<string, unknown>,
            TPrimaryType extends keyof TTypedData | 'EIP712Domain' = keyof TTypedData
        >(
            parameters: TypedDataDefinition<TTypedData, TPrimaryType>
        ): Promise<Hex> {

            console.log("[ProviderHelper:ViemAccount] Mapped M3S EIP712TypedData payload:",
                JSON.stringify(parameters, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2)
            );

            console.log("[ProviderHelper:ViemAccount] EVM original wallet", wallet)

            if (!wallet || typeof wallet.signTypedData !== 'function') {
                console.error("[ProviderHelper:ViemAccount] M3S wallet or wallet.signTypedData is not available/valid.");
                throw new Error('M3S wallet is not configured correctly for signTypedData in ViemAccount.');
            }

            if (!parameters.domain) {
                const errMsg = "[ProviderHelper:ViemAccount] Viem TypedDataDefinition is missing a domain, which is required for M3S wallet signing.";
                console.error(errMsg);
                throw new Error('Domain is missing in typed data for signing.');
            }
            if (!parameters.primaryType) {
                const errMsg = "[ProviderHelper:ViemAccount] Viem TypedDataDefinition is missing a primaryType, which is required for M3S wallet signing.";
                console.error(errMsg);
                throw new Error('PrimaryType is missing in typed data for signing.');
            }

            // Assert parameters.types to Viem's TypedData to resolve destructuring error.
            // Viem's TypedData is: { [key: string]: readonly TypedDataParameter[] } & { EIP712Domain?: readonly TypedDataParameter[] }
            // This informs TypeScript about the expected structure, allowing EIP712Domain to be destructured.
            const { EIP712Domain, ...otherTypes } = parameters.types as TypedData;

            // Transform Viem's TypedDataDefinition to M3S's EIP712TypedData
            const m3sPayload: EIP712TypedData = {
                domain: parameters.domain,
                // Ethers' signTypedData(domain, types, value) infers primaryType from the `types` object.
                // `parameters.primaryType` (e.g., "Permit") will be a key in `otherTypes`.
                types: otherTypes as unknown as EIP712TypedData['types'], // otherTypes now correctly excludes EIP712Domain
                value: parameters.message as EIP712TypedData['value'],
            };

            // console.log("[ProviderHelper:ViemAccount] Mapped M3S EIP712TypedData payload:", JSON.stringify(m3sPayload, null, 2));

            try {
                const signature = await wallet.signTypedData(m3sPayload);
                console.log("[ProviderHelper:ViemAccount] M3S wallet.signTypedData successful, signature:", signature);
                return signature as Hex;
            } catch (error: any) {
                console.error("[ProviderHelper:ViemAccount] Error in signTypedData calling M3S wallet.signTypedData:", error);
                throw error;
            }
        }
    };
}

export class M3SLiFiViemProvider {
    private m3sWallet: IEVMWallet;
    private viemAccount: LocalAccount<'custom', Address>;
    public viemWalletClient: WalletClient;
    public readonly address: Address;
    private walletRpcs: Record<string, string[]> = {};

    private constructor(
        m3sWallet: IEVMWallet,
        initialAccountAddress: Address,
        initialViemChain: Chain,
        initialRpcUrls: string[],
        walletRpcs: Record<string, string[]> = {}
    ) {
        this.m3sWallet = m3sWallet;
        this.address = initialAccountAddress;
        // Pass the m3sWallet instance to createM3sViemAccount
        this.viemAccount = createM3sViemAccount(this.m3sWallet, this.address);
        this.walletRpcs = walletRpcs;
        this.viemWalletClient = createWalletClient({
            account: this.viemAccount,
            chain: initialViemChain,
            transport: fallback(initialRpcUrls.map(url => http(url)))
        });
        console.log(`[M3SLiFiViemProvider] Initialized for address ${this.address} on chain ${initialViemChain.id}`);
    }

    static async create(
        m3sWallet: IEVMWallet,
        initialNetworkConfig: NetworkConfig,
    ): Promise<M3SLiFiViemProvider> {
        if (!m3sWallet.isInitialized()) {
            throw new Error("M3S Wallet must be initialized before creating M3SLiFiViemProvider.");
        }
        if (!initialNetworkConfig || !initialNetworkConfig.rpcUrls || initialNetworkConfig.rpcUrls.length === 0) {
            throw new Error("Valid initialNetworkConfig with rpcUrls is required for M3SLiFiViemProvider.");
        }

        const accounts = await m3sWallet.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found in the M3S wallet instance.");
        }
        const accountAddress = accounts[0] as Address;
        console.log(`[M3SLiFiViemProvider.create] Using address from M3S wallet: ${accountAddress}`);

        // --- NEW: Automatically get all RPCs from the wallet ---
        const allWalletRpcs = m3sWallet.getAllChainRpcs();
        console.log(`[M3SLiFiViemProvider.create] Loaded ${Object.keys(allWalletRpcs).length} chain RPC configs from M3S wallet.`);
        // --- END NEW ---

        const initialChainIdNum = parseInt(initialNetworkConfig.chainId, initialNetworkConfig.chainId.startsWith('0x') ? 16 : 10);
        let initialViemChain = getViemChain(initialChainIdNum);

        if (!initialViemChain) {
            console.log(`[M3SLiFiViemProvider.create] Creating new Viem chain object for chainId: ${initialChainIdNum}`);
            initialViemChain = {
                id: initialChainIdNum,
                name: initialNetworkConfig.name || initialNetworkConfig.displayName || `Chain ${initialChainIdNum}`,
                nativeCurrency: { name: initialNetworkConfig.tickerName || 'Ether', symbol: initialNetworkConfig.ticker || 'ETH', decimals: 18 },
                rpcUrls: { default: { http: initialNetworkConfig.rpcUrls }, public: { http: initialNetworkConfig.rpcUrls } },
                blockExplorers: initialNetworkConfig.blockExplorerUrl ? { default: { name: 'Explorer', url: initialNetworkConfig.blockExplorerUrl } } : undefined,
            };
        } else {
            console.log(`[M3SLiFiViemProvider.create] Updating existing Viem chain object for chainId: ${initialChainIdNum}`);
            initialViemChain = {
                ...initialViemChain,
                rpcUrls: { ...initialViemChain.rpcUrls, default: { http: initialNetworkConfig.rpcUrls }, public: { http: initialNetworkConfig.rpcUrls } }
            };
        }
        console.log(`[M3SLiFiViemProvider.create] Using initial Viem chain:`, initialViemChain);
        console.log(`[M3SLiFiViemProvider.create] Using initial RPCs:`, initialNetworkConfig.rpcUrls);

        // Pass the fetched RPCs to the constructor
        return new M3SLiFiViemProvider(m3sWallet, accountAddress, initialViemChain, initialNetworkConfig.rpcUrls, allWalletRpcs);
    }

    public async getWalletClient(): Promise<WalletClient> {
        // LiFi SDK calls switchChain first if it needs a different chain,
        // so returning the current client is usually correct here.
        return this.viemWalletClient;
    }

    public async switchChain(chainId: number): Promise<WalletClient> {
        console.log(`[M3SLiFiViemProvider] switchChain requested for chainId: ${chainId}`);

        if (this.viemWalletClient.chain?.id === chainId) {
            console.log(`[M3SLiFiViemProvider] Already on chain ${chainId}. Returning existing Viem client.`);
            return this.viemWalletClient;
        }

        // pick up user’s private RPCs for this chain
        const cidDec = String(chainId);
        const cidHex = `0x${chainId.toString(16)}`;
        const preferredRpcs = this.walletRpcs[cidDec] || this.walletRpcs[cidHex] || [];

        if (preferredRpcs.length === 0) {
            throw new Error(
                `No private RPCs configured for chain ${cidHex}. ` +
                `Please call wallet.updateAllChainRpcs({ "${cidHex}": ["<yourRpcUrl>"] }) before executing cross-chain operations.`
            );
        }

        const networkHelper = NetworkHelper.getInstance();
        await networkHelper.ensureInitialized();

        const targetNetworkConfig = await networkHelper.getNetworkConfig(
            chainId,
            preferredRpcs  // Use wallet's RPCs for target chain
        )

        if (!targetNetworkConfig) {
            throw new Error(`Could not get network config for chainId: ${chainId}`);
        }

        NetworkHelper.assertConfigIsValid(targetNetworkConfig, `M3SLiFiViemProvider switchChain target (${chainId})`);

        let targetViemChain = getViemChain(chainId);
        if (!targetViemChain) {
            targetViemChain = {
                id: chainId, name: targetNetworkConfig.name || targetNetworkConfig.displayName || `Chain ${chainId}`,
                nativeCurrency: { name: targetNetworkConfig.tickerName || 'Ether', symbol: targetNetworkConfig.ticker || 'ETH', decimals: 18 },
                rpcUrls: { default: { http: targetNetworkConfig.rpcUrls }, public: { http: targetNetworkConfig.rpcUrls } },
                blockExplorers: targetNetworkConfig.blockExplorerUrl ? { default: { name: 'Explorer', url: targetNetworkConfig.blockExplorerUrl } } : undefined,
            };
        } else {
            targetViemChain = {
                ...targetViemChain, rpcUrls: { ...targetViemChain.rpcUrls, default: { http: targetNetworkConfig.rpcUrls }, public: { http: targetNetworkConfig.rpcUrls } }
            };
        }

        const m3sProviderConfig: NetworkConfig = {
            name: targetNetworkConfig.name,
            decimals: targetNetworkConfig.decimals,
            chainId: targetNetworkConfig.chainId, // hex string
            rpcUrls: targetNetworkConfig.rpcUrls,
            displayName: targetNetworkConfig.displayName,
            blockExplorerUrl: targetNetworkConfig.blockExplorerUrl,
            ticker: targetNetworkConfig.ticker,
            tickerName: targetNetworkConfig.tickerName,
        };
        try {
            await this.m3sWallet.setProvider(m3sProviderConfig);
            console.log(`[M3SLiFiViemProvider] M3S wallet provider switched to chain ${targetNetworkConfig.chainId}.`);
        } catch (m3sSwitchError: any) {
            console.error(`[M3SLiFiViemProvider] M3S wallet setProvider error:`, m3sSwitchError);
            throw new Error(`M3S wallet failed to switch to chain ${chainId}: ${m3sSwitchError.message}`);
        }

        this.viemWalletClient = createWalletClient({
            account: this.viemAccount,
            chain: targetViemChain,
            transport: fallback(targetNetworkConfig.rpcUrls.map(url => http(url)))
        });
        console.log(`[M3SLiFiViemProvider] Viem WalletClient recreated for chain ${chainId}.`);
        return this.viemWalletClient;
    }
}
