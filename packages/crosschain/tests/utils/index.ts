import { polygon, Chain } from 'viem/chains';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Creates a LI.FI compatible provider for testing purposes
 * @param privateKey - The private key to use for signing transactions
 * @param chains - Optional array of chains to support
 * @returns A LI.FI compatible execution provider
 */
export function createLifiTestProvider(privateKey: string, chains?: Chain[]): any {
    // Get primary chain for the provider
    const primaryChain = chains?.[0] || polygon;

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create a standard public client for read operations - using real RPC
    const publicClient = createPublicClient({
        chain: primaryChain,
        transport: http('https://polygon-rpc.com')  // Use a real RPC endpoint
    });

    // Create a standard wallet client with your account
    let walletClient = createWalletClient({
        account,
        chain: primaryChain,
        transport: http('https://polygon-rpc.com')  // Use a real RPC endpoint
    });

    // Return the provider interface expected by the LiFi adapter
    return {
        address: account.address,
        walletClient,
        signTransaction: async (tx: any) => {
            return await account.signTransaction(tx);
        },
        switchChain: async (chainId: number) => {
            // Find the chain in the provided chains list
            const targetChain = chains?.find(chain => chain.id === chainId);
            if (!targetChain) {
                throw new Error(`Chain with ID ${chainId} not supported`);
            }

            // Create a new wallet client for the target chain
            const newWalletClient: any = createWalletClient({
                account,
                chain: targetChain,
                transport: http(getRpcUrl(targetChain.id))  // Get appropriate RPC URL for chain
            });

            // Replace the existing wallet client
            walletClient = newWalletClient;
            return true;
        }
    };
}

/**
 * Creates a LI.FI compatible provider from any wallet implementation
 * @param wallet - An ICoreWallet or IEVMWallet implementation
 * @returns A provider compatible with the LiFiAdapter
 */
export function createLifiProviderFromWallet(wallet: any): any {
    if (!wallet.isInitialized()) {
        throw new Error("Wallet must be initialized before creating a LiFi provider");
    }

    return {
        address: async () => {
            const accounts = await wallet.getAccounts();
            return accounts[0];
        },

        walletClient: {
            account: {
                address: async () => {
                    const accounts = await wallet.getAccounts();
                    return accounts[0];
                }
            },
            sendTransaction: async (tx: any) => {
                // Forward transaction to wallet
                const txHash = await wallet.sendTransaction(tx);
                return { hash: txHash };
            }
        },

        signTransaction: async (tx: any) => {
            return await wallet.signTransaction(tx);
        },

        switchChain: async (chainId: number) => {
            // Use the wallet's chain switching capability
            const chainConfig = {
                chainId: `0x${chainId.toString(16)}`,
                name: getChainNameByChainId(chainId),
                rpcTarget: getRpcUrl(chainId)
            };

            await wallet.setProvider(chainConfig);
            return true;
        }
    };
}

/**
 * Gets the RPC URL for a specific chain
 * @param chainId - The chain ID to get the RPC URL for
 * @returns The RPC URL for the chain
 */
export function getRpcUrl(chainId: number): string {
    // Map of chain IDs to their public RPC endpoints
    const rpcMap: Record<number, string> = {
        1: 'https://eth.llamarpc.com',
        10: 'https://mainnet.optimism.io',
        56: 'https://bsc-dataseed.binance.org',
        137: 'https://polygon-rpc.com',
        42161: 'https://arb1.arbitrum.io/rpc',
        8453: 'https://mainnet.base.org', // Base
        // Add more as needed
    };

    return rpcMap[chainId] || `https://rpc.ankr.com/${getChainNameByChainId(chainId)}`;
}

/**
 * Gets the chain name for a specific chain ID
 * @param chainId - The chain ID to get the name for
 * @returns The chain name
 */
export function getChainNameByChainId(chainId: number): string {
    const chainMap: Record<number, string> = {
        1: 'eth',
        10: 'optimism',
        56: 'bsc',
        137: 'polygon',
        42161: 'arbitrum',
        8453: 'base',
        // Add more as needed
    };

    return chainMap[chainId] || 'eth';
}