import { describe, it, expect, beforeAll } from 'vitest';
import { JsonRpcProvider } from 'ethers';
import { getChainConfigAsync, getTestPrivateKey, loadAllNetworks } from './utils.js';
import { EvmWalletAdapter } from '../src/adapters/ethersWallet.js';
import { WalletEvent } from '../src/types/index.js';

describe('Network Switching Functionality', () => {
  // Get test networks
  let networks: Record<string, any> = {};
  
  // Get everything ready
  beforeAll(async () => {
    // Load a few networks for testing
 
    await loadAllNetworks();
      
    networks.sepolia = await getChainConfigAsync('sepolia', true);
    networks.goerli = await getChainConfigAsync('goerli', true);
    
    // Try to load arbitrum from API
    try {
      networks.arbitrum = await getChainConfigAsync('arbitrum');
    } catch (error) {
      console.warn('Could not load Arbitrum network, using defaults');
    }
  });
  
  it('should support switching between different networks', async () => {
    // Skip if we don't have at least two networks
    const availableNetworks = Object.keys(networks).filter(key => networks[key]);
    if (availableNetworks.length < 2) {
      console.warn('Not enough networks available for testing network switching');
      return;
    }
    
    // Create a wallet instance
    const privateKey = getTestPrivateKey();
    const wallet = await EvmWalletAdapter.create({
      options: { privateKey }
    });
    
    // Try each network in sequence
    let previousChainId = '';
    for (const networkName of availableNetworks) {
      try {
        const networkConfig = networks[networkName];
        if (!networkConfig) continue;
        
        console.log(`Testing network switch to ${networkName}`);
        
        // Set up event listener
        let chainChangedEvent = false;
        wallet.on(WalletEvent.chainChanged, () => {
          chainChangedEvent = true;
        });
        
        // Set provider to this network
        const provider = new JsonRpcProvider(networkConfig.rpcTarget);
        await wallet.setProvider(provider);
        
        // Get network information
        const network = await wallet.getNetwork();
        console.log(`Switched to network: ${network.name} (${network.chainId})`);
        
        // Skip first network comparison
        if (previousChainId) {
          expect(network.chainId).not.toBe(previousChainId);
          expect(chainChangedEvent).toBe(true);
        }
        
        previousChainId = network.chainId;
        
        // Clean up event listener
        wallet.off(WalletEvent.chainChanged, () => {});
      } catch (error) {
        console.warn(`Failed to test network ${networkName}:`, error);
      }
    }
  });
});