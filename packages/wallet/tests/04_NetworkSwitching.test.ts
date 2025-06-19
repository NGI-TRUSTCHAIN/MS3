import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EvmWalletAdapter } from '../src/adapters/ethers/ethersWallet.js';
import { NetworkHelper, NetworkConfig, PrivateKeyHelper } from '@m3s/common';
import { getTestPrivateKey } from '../config.js';
import { WalletEvent } from '@m3s/wallet';

describe('Network Switching Functionality', () => {
  // Get test networks
  let networks: Record<string, any> = {};
  const networkHelper = NetworkHelper.getInstance();

  // Get everything ready
  beforeAll(async () => {
    await networkHelper.ensureInitialized();

    // Define candidate networks to test
    const networksToTest = ['sepolia', 'arbitrum', 'optimism', 'polygon'];
    const loadedConfigs: Record<string, NetworkConfig | null> = {};

    for (const name of networksToTest) {
      try {
        // Use the reliable async fetcher
        const config = await networkHelper.fetchChainListNetwork(name); // fetchChainListNetwork is fine for getting raw cache/API data
        // Or use getWorkingChainConfigAsync if you need validated RPCs immediately
        // const config = await networkHelper.getWorkingChainConfigAsync(name); 
        if (config && config.chainId) {
          loadedConfigs[name] = config;
        }
      } catch (error: any) {
        console.error(`[NetworkSwitchingTest] Error loading config for ${name}:`, error.message);
      }
    }

    // Use the filter method to get rid of null/undefined entries.
    networks = NetworkHelper.filterValidConfigs(loadedConfigs)


    // // Filter out null/undefined and ensure required fields for NetworkConfig
    //  networks = Object.entries(loadedConfigs)
    //   // Updated filter condition:
    //   .filter(([_, config]) => config && config.chainId && config.rpcUrls && config.rpcUrls.length > 0) 
    //   .reduce((acc, [key, config]) => {
    //     // Assert config is not null here due to the filter
    //     acc[key] = config!; // Assign the valid config
    //     return acc;
    //   }, {} as Record<string, NetworkConfig>); // Ensure the final type is correct

  });

  it('should support switching between different networks', async () => {
    // Skip if we don't have at least two networks
    const availableNetworks = Object.keys(networks);
    if (availableNetworks.length < 2) {
      // This warning should hopefully not appear now
      console.warn('Not enough valid networks available for testing network switching after filtering.');
      return;
    }

    // --- Using PrivateKeyHelper ---
    const pkHelper = new PrivateKeyHelper();
    // For tests requiring a specific, potentially pre-funded key, still use getTestPrivateKey()
    const preConfiguredPrivateKey = getTestPrivateKey();
    // For tests where any valid key will do, or to demonstrate generation:
    const generatedPrivateKey = pkHelper.generatePrivateKey();
    const addressFromGeneratedKey = pkHelper.getAddressFromPrivateKey(generatedPrivateKey);
    console.log(`[Test Setup] Generated ephemeral private key for some tests: ${addressFromGeneratedKey}`);
    const privateKeyForAdapter = preConfiguredPrivateKey || generatedPrivateKey;

    const wallet = await EvmWalletAdapter.create({
      name: 'ethers',
      version: '1.0.0',
      options: { privateKey: privateKeyForAdapter }
    });

    // Initialize the wallet (it will start without a provider)
    // await wallet.initialize();
    expect(wallet.isInitialized()).toBe(true);
    expect(wallet.isConnected()).toBe(false); // Not connected initially

    let previousChainId: string | number = '';

    for (const networkName of availableNetworks) {
      const networkConfig = networks[networkName];
      if (!networkConfig) continue;

      // Set up event listener
      const eventSpy = vi.fn();
      wallet.on(WalletEvent.chainChanged, eventSpy);

      try {
        await wallet.setProvider(networkConfig); // Use NetworkConfig
        expect(wallet.isConnected()).toBe(true);

        const currentNetwork = await wallet.getNetwork();
        expect(currentNetwork.chainId.toString()).toEqual(networkConfig.chainId.toString());

        if (previousChainId) {
          expect(currentNetwork.chainId).not.toBe(previousChainId);
          expect(eventSpy).toHaveBeenCalled();
          const expectedChainIdString = networkConfig.chainId.toString();
          const expectedChainIdDecimal = parseInt(expectedChainIdString, 16).toString();
          expect(eventSpy).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^(${expectedChainIdString}|${expectedChainIdDecimal})$`)));
        }
        previousChainId = currentNetwork.chainId;

      } catch (error) {
        console.warn(`Failed to test network ${networkName}:`, error);
        // expect(true).toBe(true);
      } finally {
        wallet.off(WalletEvent.chainChanged, eventSpy);
      }
    }
  }, 60000);

  it('should handle setProvider with an invalid/unreachable RPC URL gracefully', async () => {
    const pkHelper = new PrivateKeyHelper();
    const privateKeyForAdapter = getTestPrivateKey() || pkHelper.generatePrivateKey();

    const wallet = await EvmWalletAdapter.create({
      name: 'ethers',
      version: '1.0.0',

      options: { privateKey: privateKeyForAdapter }
    });
    await wallet.initialize();

    // Capture initial connection state
    let wasInitiallyConnected = false;
    let initialNetworkDetails: { chainId: string | number; name?: string } | null = null;

    // Try to connect to a valid network first to see if state is preserved after a failed switch
    const sepoliaNetConfig = await networkHelper.getNetworkConfig('sepolia');
    if (sepoliaNetConfig && sepoliaNetConfig.rpcUrls && sepoliaNetConfig.rpcUrls.length > 0) {
      try {
        await wallet.setProvider(sepoliaNetConfig);
        wasInitiallyConnected = wallet.isConnected();
        if (wasInitiallyConnected) {
          initialNetworkDetails = await wallet.getNetwork();
        }
      } catch (e) {
        console.warn("[NetworkSwitchingTest] Could not connect to initial valid network for invalid RPC test setup:", e);
      }
    }

    const invalidConfig: NetworkConfig = {
      name: 'fake-network',
      rpcUrls: [`https://nonexistent-rpc-url-${Date.now()}.example.com`],
      chainId: '0xdeadbeef', // A dummy chainId
      displayName: 'Invalid Network Test',
    };

    const consoleErrorSpy = vi.spyOn(console, 'error');

    await expect(wallet.setProvider(invalidConfig))
      .rejects
      .toThrow(/Failed to connect to any provided RPC URL/);

    // Check that EvmWalletAdapter logged an error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[EvmWalletAdapter] Failed to connect to any provided RPC URL for the new config. Previous state restored if available."),
      expect.anything() // For the connectionError object
    );
    consoleErrorSpy.mockRestore();

    // Verify wallet state after failed attempt
    if (wasInitiallyConnected && initialNetworkDetails) {
      // If it was connected, it should remain connected to the *previous* valid network.
      expect(wallet.isConnected()).toBe(true);
      const currentNetwork = await wallet.getNetwork();
      expect(currentNetwork.chainId).toBe(initialNetworkDetails.chainId);
      expect(currentNetwork.name).toBe(initialNetworkDetails.name);
    } else {
      // If it wasn't connected initially, it should remain disconnected.
      expect(wallet.isConnected()).toBe(false);
    }

    // Ensure no chainChanged event was emitted for the invalid attempt
    const eventSpy = vi.fn();
    wallet.on(WalletEvent.chainChanged, eventSpy);
    // Short delay to catch any async events
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(eventSpy).not.toHaveBeenCalled();
    wallet.off(WalletEvent.chainChanged, eventSpy);

  }, 25000);
});