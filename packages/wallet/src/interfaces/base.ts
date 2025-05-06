export interface NetworkConfig {
    chainId: string; // Hexadecimal string (e.g., '0x1')
    name: string;
    displayName: string;
    rpcUrls: string[]; // Array of RPC URLs, ordered by preference/validation
    blockExplorer?: string;
    ticker?: string;
    tickerName?: string;
    shortName?: string;
    chainSlug?: string;
  }
  