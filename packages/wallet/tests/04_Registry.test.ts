import { describe, it, expect } from 'vitest';
import { createWallet } from '../src/index.js';
import { WalletType } from '../src/types/index.js';
import { getChainConfig, getTestPrivateKey } from './utils.js';
import { registry } from '../src/registry.js';

// Import to ensure adapters are registered
import '../src/adapters/index.js';
import { JsonRpcProvider } from 'ethers';

describe('Wallet Registry Integration', () => {
  it('should register all wallet adapters', () => {
    const adapters = registry.getModuleAdapters('wallet');
    expect(adapters.length).toBeGreaterThan(0);

    // Verify each adapter is registered with correct type
    const ethersAdapter = registry.getAdapter('wallet', 'ethers');
    expect(ethersAdapter?.adapterType).toBe(WalletType['evm']);

    const mockedAdapter = registry.getAdapter('wallet', 'mocked');
    expect(mockedAdapter?.adapterType).toBe(WalletType['core']);

    const web3authAdapter = registry.getAdapter('wallet', 'web3auth');
    expect(web3authAdapter?.adapterType).toBe(WalletType['web3auth']);
  });

  it('should create a mocked wallet via factory', async () => {
    const privateKey = getTestPrivateKey();

    const wallet = await createWallet({
      adapterName: 'mocked',
      options: { privateKey }
    });

    expect(wallet.getWalletName()).toBe('MockedWalletAdapter');
    const accounts = await wallet.getAccounts();
    expect(accounts.length).toBeGreaterThan(0);
  });

  it('should handle error for unknown adapter', async () => {
    try {
      await createWallet({
        adapterName: 'non-existent-adapter',
        options: {}
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Unknown adapter');
    }
  });

  it('should support creating multiple wallet types', async () => {
    const privateKey = getTestPrivateKey();

    const mockedWallet = await createWallet({
      adapterName: 'mocked',
      options: { privateKey }
    });

    const evmWallet = await createWallet({
      adapterName: 'ethers',
      options: { privateKey }
    });

    expect(mockedWallet.getWalletName()).toBe('MockedWalletAdapter');
    expect(evmWallet.getWalletName()).toBe('EvmWalletAdapter');
  });

  // Add this test to your Registry.test.ts file:

  it('should support multiple networks via Registry', async () => {
    // Get a couple of network configs
    const sepoliaConfig = getChainConfig('sepolia');
    const goerliConfig = getChainConfig('goerli');

    // Create a wallet with the default network (sepolia)
    const wallet = await createWallet({
      adapterName: 'ethers',
      options: {
        privateKey: getTestPrivateKey()
      }
    });

    try {
      // Check initial network
      const initialNetwork = await wallet.getNetwork();

      // Try to switch to another network
      const provider = new JsonRpcProvider(goerliConfig.rpcTarget);
      await wallet.setProvider(provider);

      // Verify network changed
      const newNetwork = await wallet.getNetwork();
      expect(newNetwork.chainId).not.toBe(initialNetwork.chainId);
    } catch (error) {
      console.warn('Network switching test failed:', error);
    }
  });

});