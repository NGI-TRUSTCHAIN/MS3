export const adapterConfigs = {
  mocked: {
    initCode: `
      const params: IWalletOptions = {
        adapterName: 'ethers',
        provider: {rpc: "https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8"}
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  },
  ethers: {
    initCode: `
      const TEST_PRIVATE_KEY = '0x63a648a4c0efeeb4f08207f1682bed9937a4c6cb5f7f1ee39f75c135e8828b2b';
      const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8");
      const params: IWalletOptions = {
        adapterName: 'ethers',
        provider: {rpc: "https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8"},
        options: { privateKey: TEST_PRIVATE_KEY }
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  },
  web3auth: {
    initCode: `
      const web3authConfig = {
        clientId: "BCUGgXUJQX2T90W4YBqJQpvLsjKzNv-fmFzbqdMq5zW7EOsCikCvOrrIIUmbHwFGw8rNp5Cgmc5KQ2cafWVT2tk",
        web3AuthNetwork: "sapphire_devnet",
        chainConfig: {
          chainNamespace: "eip155",
          chainId: "0xaa36a7", // Sepolia
          rpcTarget: "https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8",
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