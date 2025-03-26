export const NETWORK_CONFIGS = {
    "holesky": {
        chainNamespace: "eip155",
        chainId: "0x4268",
        rpcTarget: "https://ethereum-holesky.publicnode.com",
        displayName: "Holesky Testnet",
        blockExplorer: "https://holesky.etherscan.io/",
        ticker: "ETH",
        tickerName: "Ethereum"

    },
    "sepolia": {
        chainNamespace: "eip155",
        chainId: "0xaa36a7",
        rpcTarget: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
        displayName: "Sepolia Testnet",
        blockExplorer: "https://sepolia.etherscan.io/",
        ticker: "ETH",
        tickerName: "Ethereum"
    }
};
