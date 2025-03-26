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
      const TEST_PRIVATE_KEY = '${process.env.TEST_PRIVATE_KEY}';
      const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}");
      const params: IWalletOptions = {
        adapterName: 'ethers',
        provider: {rpcTarget: "https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}"},
        options: { privateKey: TEST_PRIVATE_KEY }
      };
      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);
    `
  }
};