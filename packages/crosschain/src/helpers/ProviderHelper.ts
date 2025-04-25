import { IEVMWallet } from '@m3s/wallet';
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
    TypedData
} from 'viem';

import * as viemChains from 'viem/chains';
import { LiFiExecutionProvider } from '../adapters/LI.FI.Adapter.js';
import { getNetworkConfig, NetworkConfig } from './NetworkConfigHelper.js';

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

        // Implement Viem's required signing methods by delegating to the M3S wallet
        async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
            console.log("[ProviderHelper:ViemAccount] Delegating signMessage to M3S wallet");
            const messageContent = typeof message === 'string' ? message : message.raw;
            return await wallet.signMessage(messageContent) as Hex;
        },

        async signTransaction(
            transaction: TransactionSerializable,
        ): Promise<Hex> {
            console.log("[ProviderHelper:ViemAccount] Delegating signTransaction to M3S wallet");
            const m3sTx: any = {
                to: transaction.to,
                value: transaction.value?.toString(),
                data: transaction.data,
                chainId: transaction.chainId,
                nonce: transaction.nonce,
                gasLimit: transaction.gas?.toString(),
                maxFeePerGas: transaction.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
                gasPrice: transaction.gasPrice?.toString(),
            };
            Object.keys(m3sTx).forEach(key => m3sTx[key] === undefined && delete m3sTx[key]);
            return await wallet.signTransaction(m3sTx) as Hex;
        },

        async signTypedData<
            const TTypedData extends TypedData | { [key: string]: unknown },
            TPrimaryType extends keyof TTypedData | 'EIP712Domain' = keyof TTypedData,
        >(
            // Use 'parameters' as the argument name to match Viem's type
            parameters: TypedDataDefinition<TTypedData, TPrimaryType>
        ): Promise<Hex> {
            console.log("[ProviderHelper:ViemAccount] Delegating signTypedData to M3S wallet");
            // Pass the received 'parameters' directly to the M3S wallet's method
            // Assuming the M3S wallet's signTypedData accepts a compatible structure
            return await wallet.signTypedData(parameters as any) as Hex;
        }
    };
}


/**
 * Creates a LiFiExecutionProvider from an initialized M3S IEVMWallet instance.
 * Uses dynamic RPC fetching and validation via NetworkConfigHelper.
 * Configures Viem client with RPC fallback.
 *
 * @param wallet - An initialized IEVMWallet implementation.
 * @param preferredRpcUrls - Optional preferred RPC URLs for the initial chain.
 * @returns A provider compatible with the MinimalLiFiAdapter.
 */
export async function createLifiProviderFromWallet(
    wallet: IEVMWallet,
    preferredRpcUrls?: string[]
): Promise<LiFiExecutionProvider> {
    if (!wallet.isInitialized()) {
        throw new Error("Wallet must be initialized before creating a LiFi provider");
    }
    let accountAddress: Address;
    try {
        const accounts = await wallet.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found in the M3S wallet instance.");
        }
        accountAddress = accounts[0] as Address;
        console.log(`[ProviderHelper] Using address from M3S wallet: ${accountAddress}`);
    } catch (error: any) {
        throw new Error(`Failed to get account address from M3S wallet: ${error.message}`);
    }

    const localAccount = createM3sViemAccount(wallet, accountAddress);

    // ... (Determine Initial Chain and RPCs logic remains the same) ...
    let initialNetworkConfig: NetworkConfig | null = null;
    let initialViemChain: Chain | undefined;
    let initialChainIdNum: number;
    try {
        const currentM3sNetwork = await wallet.getNetwork();
        initialChainIdNum = typeof currentM3sNetwork.chainId === 'string'
            ? parseInt(currentM3sNetwork.chainId, currentM3sNetwork.chainId.startsWith('0x') ? 16 : 10)
            : currentM3sNetwork.chainId;
        initialNetworkConfig = await getNetworkConfig(initialChainIdNum, preferredRpcUrls);
        if (!initialNetworkConfig || initialNetworkConfig.rpcUrls.length === 0) {
            throw new Error(`Failed to get working RPC config for initial chain ${initialChainIdNum}`);
        }
        initialViemChain = getViemChain(initialChainIdNum);
        if (!initialViemChain) {
            initialViemChain = { /* ... create basic chain ... */
                id: initialChainIdNum,
                name: initialNetworkConfig.name || `Chain ${initialChainIdNum}`,
                nativeCurrency: { name: initialNetworkConfig.tickerName || 'Ether', symbol: initialNetworkConfig.ticker || 'ETH', decimals: 18 },
                rpcUrls: { default: { http: initialNetworkConfig.rpcUrls }, public: { http: initialNetworkConfig.rpcUrls } },
                blockExplorers: initialNetworkConfig.blockExplorer ? { default: { name: 'Explorer', url: initialNetworkConfig.blockExplorer } } : undefined,
            };
        } else {
            initialViemChain = { /* ... update existing chain with RPCs ... */
                ...initialViemChain,
                rpcUrls: { ...initialViemChain.rpcUrls, default: { http: initialNetworkConfig.rpcUrls }, public: { http: initialNetworkConfig.rpcUrls } }
            };
        }
        console.log(`[ProviderHelper] Using RPCs for initial chain ${initialChainIdNum}:`, initialNetworkConfig.rpcUrls);
    } catch (e: any) {
        console.error(`[ProviderHelper] Error getting initial network/RPC: ${e.message}.`);
        throw new Error(`Failed to configure initial provider: ${e.message}`);
    }

    let currentViemWalletClient: WalletClient = createWalletClient({
        account: localAccount,
        chain: initialViemChain,
        transport: fallback(initialNetworkConfig.rpcUrls.map(url => http(url)))
    });
    console.log(`[ProviderHelper] Initial Viem client created for chain ${initialViemChain.id} with fallback and custom M3S local account.`);

    // --- Define LiFiExecutionProvider ---
    return {
        address: accountAddress,
        walletClient: currentViemWalletClient,
        signTransaction: async (tx: any): Promise<string> => {
            console.warn("[ProviderHelper] LiFi SDK using signTransaction fallback.");
            return await localAccount.signTransaction(tx) as Hex;
        },
        switchChain: async (chainId: number): Promise<WalletClient> => {
            if (currentViemWalletClient?.chain?.id === chainId) return currentViemWalletClient;
            try {
                const targetNetworkConfig = await getNetworkConfig(chainId);
                if (!targetNetworkConfig || targetNetworkConfig.rpcUrls.length === 0) throw new Error(`Failed RPC config for ${chainId}`);
                let targetViemChain = getViemChain(chainId);
                if (!targetViemChain) {
                    targetViemChain = { /* ... create basic chain ... */
                        id: chainId, name: targetNetworkConfig.name || `Chain ${chainId}`,
                        nativeCurrency: { name: targetNetworkConfig.tickerName || 'Ether', symbol: targetNetworkConfig.ticker || 'ETH', decimals: 18 },
                        rpcUrls: { default: { http: targetNetworkConfig.rpcUrls }, public: { http: targetNetworkConfig.rpcUrls } },
                        blockExplorers: targetNetworkConfig.blockExplorer ? { default: { name: 'Explorer', url: targetNetworkConfig.blockExplorer } } : undefined,
                    };
                } else {
                    targetViemChain = { /* ... update existing chain ... */
                        ...targetViemChain, rpcUrls: { ...targetViemChain.rpcUrls, default: { http: targetNetworkConfig.rpcUrls }, public: { http: targetNetworkConfig.rpcUrls } }
                    };
                }
                console.log(`[ProviderHelper] Creating new Viem client for chain ${chainId} with RPCs:`, targetNetworkConfig.rpcUrls);
                currentViemWalletClient = createWalletClient({
                    account: localAccount,
                    chain: targetViemChain,
                    transport: fallback(targetNetworkConfig.rpcUrls.map(url => http(url)))
                });
                console.log(`[ProviderHelper] Switched Viem client successfully.`);
                try { await wallet.setProvider(targetNetworkConfig); console.log(`[ProviderHelper] M3S wallet switched.`); }
                catch (m3sSwitchError) { console.error(`[ProviderHelper] M3S switch error:`, m3sSwitchError); }
                return currentViemWalletClient;
            } catch (error: any) {
                console.error(`[ProviderHelper] Failed to switch Viem client to chain ${chainId}:`, error);
                throw error;
            }
        }
    };
}


