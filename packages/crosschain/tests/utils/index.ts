import { polygon, optimism, Chain } from 'viem/chains';
import { createWalletClient, http, PrivateKeyAccount, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { IEVMWallet } from '@m3s/wallet/index.js';
import { LiFiExecutionProvider } from '../../src/index.js';
import { getWorkingChainConfigAsync } from './networks.js'; // <<< Keep this import

// Helper to get Viem Chain object by ID
const getViemChain = (chainId: number): Chain => {
    if (chainId === polygon.id) return polygon;
    if (chainId === optimism.id) return optimism;
    // Add other chains your tests might use
    throw new Error(`Unsupported chainId for Viem in test setup: ${chainId}`);
};

/**
 * Creates a LI.FI compatible provider from an M3S IEVMWallet implementation.
 * @param wallet - An initialized IEVMWallet implementation.
 * @returns A provider compatible with the LiFiAdapter.
 */
/**
 * Creates a LI.FI compatible provider from an M3S IEVMWallet implementation.
 * Uses dynamic RPC fetching and validation.
 * @param wallet - An initialized IEVMWallet implementation.
 * @returns A provider compatible with the LiFiAdapter.
 */
export async function createLifiProviderFromWallet(wallet: IEVMWallet): Promise<LiFiExecutionProvider> {
    if (!wallet.isInitialized()) {
        throw new Error("Wallet must be initialized before creating a LiFi provider");
    }

    const privateKey = (wallet as any).privateKey;
    if (!privateKey || typeof privateKey !== 'string' || !privateKey.startsWith('0x')) {
        throw new Error("Could not retrieve a valid private key from the M3S wallet instance for test setup.");
    }
    const account: PrivateKeyAccount = privateKeyToAccount(privateKey as `0x${string}`);

    let initialViemChain: Chain = polygon; // Default Viem Chain object
    let initialRpcUrl: string | undefined;
    let initialChainIdNum: number = polygon.id; // Default numeric ID

    try {
        const network = await wallet.getNetwork();
        if (network?.chainId) {
            const currentChainId = typeof network.chainId === 'string' ? parseInt(network.chainId) : network.chainId;
            initialChainIdNum = currentChainId; // Store numeric ID

            // Get Viem Chain object
            try {
                initialViemChain = getViemChain(currentChainId);
            } catch (viemChainError) {
                console.warn(`M3S Wallet initial chain ${currentChainId} not mapped in getViemChain, defaulting Viem object to Polygon. Error: ${viemChainError}`);
                initialViemChain = polygon;
                initialChainIdNum = polygon.id; // Reset numeric ID if Viem object defaults
            }

            // Get validated RPC URL using the dynamic helper
            console.log('INITIAL CHAIN ID IS THIS --->>> ', initialChainIdNum)
            const workingConfig = await getWorkingChainConfigAsync(`${initialChainIdNum}`); // Use numeric ID
            if (workingConfig?.rpcUrl) {
                initialRpcUrl = workingConfig.rpcUrl;
                console.log(`[createLifiProviderFromWallet] Using validated RPC for initial chain ${initialChainIdNum}: ${initialRpcUrl}`);
            } else {
                console.warn(`[createLifiProviderFromWallet] Could not get working RPC for initial chain ${initialChainIdNum}, falling back to Viem default.`);
                initialRpcUrl = initialViemChain.rpcUrls.default.http[0];
            }

        } else {
             throw new Error("Could not get chainId from M3S wallet network.");
        }
    } catch (e) {
        console.warn("[createLifiProviderFromWallet] Error getting initial network/RPC from M3S wallet, defaulting Viem client to Polygon.", e);
        initialViemChain = polygon;
        initialChainIdNum = polygon.id;
        initialRpcUrl = initialViemChain.rpcUrls.default.http[0]; // Use Viem default as last resort
    }

    // Ensure we have an RPC URL
    if (!initialRpcUrl) {
        console.error("CRITICAL: No RPC URL determined for initial Viem client. Using Polygon default.");
        initialRpcUrl = polygon.rpcUrls.default.http[0];
    }

    let currentViemWalletClient: WalletClient = createWalletClient({
        account,
        chain: initialViemChain,
        transport: http(initialRpcUrl) // Use the determined (preferably validated) RPC URL
    });

    return {
        address: async () => {
            const accounts = await wallet.getAccounts();
            if (accounts.length === 0) {
                throw new Error("No accounts found in M3S wallet.");
            }
            return accounts[0];
        },
        walletClient: currentViemWalletClient,
        signTransaction: async (tx: any) => {
            console.warn("[createLifiProviderFromWallet] LiFi SDK using signTransaction fallback.");
            const m3sTx: any = { /* ... basic conversion ... */ };
            return await wallet.signTransaction(m3sTx);
        },
        switchChain: async (chainId: number): Promise<WalletClient> => {
            console.log(`[createLifiProviderFromWallet] Received request to switch Viem client to chain ${chainId}`);
            const currentViemChainId = currentViemWalletClient?.chain?.id;

            if (currentViemChainId === chainId) {
                 console.log(`[createLifiProviderFromWallet] Viem client already on chain ${chainId}.`);
                 return currentViemWalletClient;
            }

            try {
                const targetViemChain = getViemChain(chainId); // Get Viem chain object

                // Get validated RPC URL using the dynamic helper
                const workingConfig = await getWorkingChainConfigAsync(`${chainId}`);
                let targetRpcUrl: string;
                if (workingConfig?.rpcUrl) {
                    targetRpcUrl = workingConfig.rpcUrl;
                     console.log(`[createLifiProviderFromWallet] Using validated RPC for target chain ${chainId}: ${targetRpcUrl}`);
                } else {
                    console.warn(`[createLifiProviderFromWallet] Could not get working RPC for target chain ${chainId}, falling back to Viem default.`);
                    targetRpcUrl = targetViemChain.rpcUrls.default.http[0];
                }

                console.log(`[createLifiProviderFromWallet] Creating new Viem client for chain ${chainId} with RPC ${targetRpcUrl}`);

                currentViemWalletClient = createWalletClient({
                    account,
                    chain: targetViemChain,
                    transport: http(targetRpcUrl) // Use the determined (preferably validated) RPC URL
                });
                console.log(`[createLifiProviderFromWallet] Switched Viem client successfully. New client UID: ${currentViemWalletClient.uid}`);

                // Switch underlying M3S wallet (using the same workingConfig if available)
                try {
                    if (workingConfig) { // Use the config we already fetched
                        await wallet.setProvider(workingConfig);
                        console.log(`[createLifiProviderFromWallet] Underlying M3S wallet provider switched to chain ${chainId}.`);
                    } else {
                         console.warn(`[createLifiProviderFromWallet] Could not find M3S config (via getWorkingChainConfigAsync) for chain ${chainId} to switch underlying wallet.`);
                    }
                } catch (m3sSwitchError) {
                    console.error(`[createLifiProviderFromWallet] Error switching underlying M3S wallet to ${chainId}:`, m3sSwitchError);
                }

                return currentViemWalletClient;

            } catch (error) {
                 console.error(`[createLifiProviderFromWallet] Failed to switch Viem client to chain ${chainId}:`, error);
                 throw error;
            }
        }
    };
}