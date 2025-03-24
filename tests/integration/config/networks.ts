export const NETWORK_CONFIGS = {
    "holesky": {
        chainConfig: {
            chainNamespace: "eip155",
            chainId: "0x4268",
            rpcTarget: "https://ethereum-holesky.publicnode.com",
            displayName: "Holesky Testnet",
            blockExplorer: "https://holesky.etherscan.io/",
            ticker: "ETH",
            tickerName: "Ethereum"
        }
    },
    "sepolia": {
        chainConfig: {
            chainNamespace: "eip155",
            chainId: "0xaa36a7",
            rpcTarget: "https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8",
            displayName: "Sepolia Testnet",
            blockExplorer: "https://sepolia.etherscan.io/",
            ticker: "ETH",
            tickerName: "Ethereum"
        }
    }
};
