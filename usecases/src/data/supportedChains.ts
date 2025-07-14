export const supportedChains = [
  { chainId: 1, name: "Ethereum", symbol: "ETH" },
  { chainId: 137, name: "Polygon", symbol: "MATIC" },
  { chainId: 10, name: "Optimism", symbol: "ETH" },
  { chainId: 42161, name: "Arbitrum One", symbol: "ETH" },
  { chainId: 56, name: "BNB Smart Chain", symbol: "BNB" },
  { chainId: 100, name: "Gnosis Chain", symbol: "xDAI" },
  { chainId: 43114, name: "Avalanche C-Chain", symbol: "AVAX" },
  { chainId: 250, name: "Fantom", symbol: "FTM" },
  { chainId: 324, name: "zkSync Era", symbol: "ETH" },
  { chainId: 1101, name: "Polygon zkEVM", symbol: "ETH" },
  { chainId: 5000, name: "Mantle", symbol: "MNT" },
  { chainId: 42220, name: "Celo", symbol: "CELO" },
];

export const providerConfig = {
  decimals: 18,
  name: "Sepolia",
  chainId: "11155111",
  rpcUrls: ["https://rpc.sepolia.org", "https://sepolia.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"],
  displayName: "Sepolia Testnet",
};

// export const providerConfig = {
//   decimals: 18,
//   name: "Holesky",
//   chainId: "17000",
//   rpcUrls: [
//     "https://ethereum-holesky.publicnode.com",
//     "https://holesky.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"
//   ],
//   displayName: "Holesky Testnet",
// };
