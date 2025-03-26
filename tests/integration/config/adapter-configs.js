export const adapterConfigs = {
  mocked: {
    initCode: `
      const params: IWalletOptions = {
        adapterName: 'ethers',
        provider: {rpcTarget: "https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}"},
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  },
  ethers: {
    initCode: `
      const TEST_PRIVATE_KEY = '${process.env.WEB3AUTH_CLIENT_ID}';
      const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}");
      const params: IWalletOptions = {
        adapterName: 'ethers',
        provider: {rpcTarget: "https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}"},
        options: { privateKey: TEST_PRIVATE_KEY }
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  },
  web3auth: {
    initCode: `
      const web3authConfig = {
        clientId: "${process.env.WEB3AUTH_CLIENT_ID}",
        web3AuthNetwork: "sapphire_devnet",
        chainConfig: {
          chainNamespace: "eip155",
          chainId: "0xaa36a7", // Sepolia
          rpcTarget: "https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}",
          displayName: "Sepolia Testnet",
          blockExplorer: "https://sepolia.etherscan.io/",
          ticker: "ETH",
          tickerName: "Ethereum"
        },
        loginConfig: {
          loginProvider: "google"
        }
      };
      
      const params: IWalletOptions = {
        adapterName: 'web3auth',
        options: { web3authConfig }
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  },
};