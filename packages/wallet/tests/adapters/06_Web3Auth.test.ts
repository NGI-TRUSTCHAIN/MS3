import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Web3AuthWalletAdapter } from '../../src/adapters/web3auth/web3authWallet.js';
import { testAdapterPattern } from '../01_Core.test.js';
import { detectRuntimeEnvironment, NetworkHelper, registry, RuntimeEnvironment } from '@m3s/common';
import { createWallet, GenericTransactionData, WalletEvent } from '@m3s/wallet';
import { ethers } from 'ethers';

// Mock Web3Auth dependencies
vi.mock('@web3auth/no-modal', () => {
  return {
    Web3AuthNoModal: vi.fn().mockImplementation(function (this: any) {
      this.connected = false;
      this.provider = {
        request: vi.fn().mockImplementation(async ({ method, params }: { method: string, params?: any[] }) => {
          if (method === 'eth_accounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          if (method === 'eth_sendRawTransaction') {
            return '0x0000000000000000000000000000000000000000000000000000000000000000';
          }
          if (method === 'eth_sendTransaction') {
            return '0x1111111111111111111111111111111111111111111111111111111111111111';
          }
          if (method === 'eth_chainId') {
            return '0xaa36a7'; // Sepolia chainId
          }
          if (method === 'eth_getTransactionCount') {
            return '0x0';
          }
          if (method === 'eth_gasPrice') {
            return '0x12A05F200';
          }
          if (method === 'eth_maxPriorityFeePerGas') {
            return '0x3B9ACA00';
          }
          if (method === 'eth_blockNumber') {
            return '0x12345';
          }
          if (method === 'eth_getBlockByNumber') {
            return {
              hash: '0x' + 'a'.repeat(64),
              parentHash: '0x' + 'b'.repeat(64),
              number: 12345,
              timestamp: Math.floor(Date.now() / 1000),
              nonce: '0x0000000000000000',
              difficulty: '0x0',
              gasLimit: '0x1c9c380',
              gasUsed: '0x0',
              miner: '0x0000000000000000000000000000000000000000',
              extraData: '0x',
              transactions: [],
              baseFeePerGas: '0x3B9ACA00'
            };
          }
          if (method === 'eth_estimateGas') {
            return '0x5208';
          }
          if (method === 'eth_getTransactionReceipt') {
            const txHash = params && params[0];
            if (txHash && txHash.startsWith('0x')) {
              return {
                blockHash: '0x' + 'c'.repeat(64),
                blockNumber: '0x3039',
                contractAddress: null,
                cumulativeGasUsed: '0x5208',
                from: '0x1234567890123456789012345678901234567890',
                gasUsed: '0x5208',
                logs: [],
                logsBloom: '0x' + '0'.repeat(512),
                status: '0x1',
                to: '0x1234567890123456789012345678901234567890',
                transactionHash: txHash,
                transactionIndex: '0x0',
                type: '0x2'
              };
            }
            return null;
          }

          if (method === 'eth_getTransactionByHash') {
            const txHash = params && params[0];
            if (txHash === '0x1111111111111111111111111111111111111111111111111111111111111111') {
              // Return a minimal valid transaction object that ethers.formatTransactionResponse expects
              return {
                blockHash: '0x' + 'c'.repeat(64), // Can be a mock or null if unmined
                blockNumber: '0x3039',          // Can be a mock or null if unmined
                from: '0x1234567890123456789012345678901234567890', // Mocked sender
                gas: '0x5208', // gasLimit (21000 in hex)
                gasPrice: null, // Set to null if using EIP-1559 fields
                hash: txHash, // Crucial: This must be the transaction hash
                input: '0x', // Transaction data
                nonce: '0x0', // Nonce (0 in hex)
                to: '0x1234567890123456789012345678901234567890', // Mocked recipient
                transactionIndex: '0x0', // Can be a mock or null if unmined
                value: '0x2386f26fc10000', // Value (10000000000000000 in hex)
                type: '0x2', // EIP-1559 transaction type
                chainId: '0xaa36a7', // Sepolia chainId
                // EIP-1559 fields
                maxFeePerGas: '0x2540be400', // 10000000000 in hex
                maxPriorityFeePerGas: '0x3b9aca00', // 1000000000 in hex
                // Signature components (can be valid hex strings of appropriate length)
                v: '0x1b', // Example V value (actual value depends on chainId and signature)
                r: '0x' + '1'.repeat(64), // Example R value
                s: '0x' + '2'.repeat(64), // Example S value
                accessList: [], // Optional, can be empty array
              };
            }
            return null;
          }

          if (method === 'eth_call') {
            const callParams = params && params[0];
            // Check if it's a balanceOf call (selector 0x70a08231)
            if (callParams && typeof callParams.data === 'string' && callParams.data.startsWith('0x70a08231')) {
              // For testing getTokenBalance, return a mock balance.
              // This is '0x000000000000000000000000000000000000000000000003635c9adc5dea00000'
              // which represents 1000 * 10^18 (1000 tokens with 18 decimals).
              // You can generate this with:
              // ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1000n * (10n**18n)])
              return '0x000000000000000000000000000000000000000000000003635c9adc5dea00000';
            }

            // Fallback for other eth_call or if data is not as expected
            return '0x';
          }
        })
      };
      this.init = vi.fn().mockResolvedValue(undefined);
      this.configureAdapter = vi.fn();
      this.connectTo = vi.fn().mockImplementation(() => {
        this.connected = true;
        return Promise.resolve(this.provider);
      });
      this.switchChain = vi.fn().mockResolvedValue(undefined);
      this.addChain = vi.fn().mockResolvedValue(undefined);
    })
  };
});

vi.mock('@web3auth/ethereum-provider', () => {
  return {
    EthereumPrivateKeyProvider: vi.fn().mockImplementation(() => ({}))
  };
});

vi.mock('@web3auth/auth-adapter', () => {
  return {
    AuthAdapter: vi.fn().mockImplementation(() => ({}))
  };
});

// Mock ethers BrowserProvider
vi.mock('ethers', async () => {
  const actualEthers = await vi.importActual('ethers');

  const mockSignerInstance = (eip1193Provider: any, browserProviderInstance: any) => ({
    getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
    signTransaction: vi.fn().mockResolvedValue('0xmocksignedtransaction'),
    getNonce: vi.fn().mockImplementation(async (blockTag?: any) => {
      // Correctly use the provider associated with this signer instance
      // Simplified: directly use the known mock address if appropriate, or ensure getAddress() is from the *current* mock instance
      const address = '0x1234567890123456789012345678901234567890'; // Use the known mock address
      return browserProviderInstance.getTransactionCount(address, blockTag);
    }),
    sendTransaction: vi.fn().mockImplementation(async (transaction: ethers.TransactionRequest) => {
      if (eip1193Provider && typeof eip1193Provider.request === 'function') {
        try {
          const txHash = await eip1193Provider.request({
            method: 'eth_sendTransaction',
            params: [transaction]
          });
          return {
            hash: txHash,
            wait: async () => {
              const receipt = await eip1193Provider.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash]
              });
              if (!receipt) throw new Error(`Mock: Transaction receipt not found for ${txHash}`);
              if (receipt.status === 0 || receipt.status === '0x0') throw Object.assign(new Error(`Mock: Transaction failed for ${txHash}`), { receipt });
              return receipt;
            }
          };
        } catch (e) {
          console.error("[ethers MOCK][signerInstance.sendTransaction mock] Error:", e);
          throw e;
        }
      }
      console.warn('[ethers MOCK][signerInstance.sendTransaction mock] eip1193Provider or request function not available. Returning fallback.');
      return Promise.resolve({ hash: '0xfallbackhash', wait: async () => ({ status: 1, transactionHash: '0xfallbackhash' }) });
    }),
    provider: browserProviderInstance, // Link back to the BrowserProvider instance
  });

  return {
    ...actualEthers,
    BrowserProvider: vi.fn().mockImplementation((eip1193Provider) => {
      const realProviderInstance = new (actualEthers.BrowserProvider as any)(eip1193Provider);

      // Mock methods on the realProviderInstance
      realProviderInstance.getNetwork = vi.fn().mockResolvedValue({ chainId: 11155111n, name: 'Sepolia' });
      realProviderInstance.getBalance = vi.fn().mockResolvedValue(1000000000000000000n);
      realProviderInstance.getFeeData = vi.fn().mockImplementation(async () => {
        const gasPrice = await eip1193Provider.request({ method: 'eth_gasPrice' });
        const maxPriorityFeePerGas = await eip1193Provider.request({ method: 'eth_maxPriorityFeePerGas' });
        return {
          gasPrice: BigInt(gasPrice || '0'),
          maxFeePerGas: BigInt(gasPrice || '0') * 2n,
          maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas || '0'),
        };
      });
      realProviderInstance.getTransactionReceipt = vi.fn().mockImplementation(async (hash: string) => {
        return eip1193Provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      });
      realProviderInstance.estimateGas = vi.fn().mockImplementation(async (tx: ethers.TransactionRequest) => {
        const gas = await eip1193Provider.request({ method: 'eth_estimateGas', params: [tx] });
        return BigInt(gas);
      });
      realProviderInstance.getTransactionCount = vi.fn(async (address: string, blockTag?: any) => {
        const nonce = await eip1193Provider.request({ method: 'eth_getTransactionCount', params: [address, blockTag || 'latest'] });
        return Number(nonce);
      });
      realProviderInstance.getTransaction = vi.fn().mockImplementation(async (hash: string) => {
        return eip1193Provider.request({ method: 'eth_getTransactionByHash', params: [hash] });
      });

      // THIS IS THE CRUCIAL MOCK
      realProviderInstance.getSigner = vi.fn().mockImplementation(async function (this: ethers.BrowserProvider, addressOrIndex?: string | number) {
        return mockSignerInstance(eip1193Provider, this);
      });

      return realProviderInstance;
    }),
    Contract: vi.fn().mockImplementation(() => ({ /* ... */ })),
    verifyMessage: actualEthers.verifyMessage,
    formatUnits: actualEthers.formatUnits,
    parseUnits: actualEthers.parseUnits,
    utils: actualEthers.utils,
    AbstractSigner: actualEthers.AbstractSigner, // Keep actual AbstractSigner
    Wallet: actualEthers.Wallet, // Keep actual Wallet
  };
});

describe('Web3AuthWalletAdapter Tests', () => {
  let chainConfig: any;
  const networkHelper = NetworkHelper.getInstance();

  beforeEach(async () => {
    // Get chain config asynchronously before each test
    await networkHelper.ensureInitialized();
    // Ensure networks are loaded if not already
    chainConfig = await networkHelper.getNetworkConfig('sepolia');
  });

  // Test constructor pattern
  testAdapterPattern(Web3AuthWalletAdapter, {
    web3authConfig: {
      clientId: 'test-client-id',
      web3AuthNetwork: 'testnet',
      chainConfig: {
        chainNamespace: 'eip155',
        chainId: chainConfig?.chainId,
        rpcTarget: chainConfig?.rpcUrls?.[0],
        displayName: chainConfig?.name,
        blockExplorerUrl: chainConfig?.blockExplorerUrl,
        ticker: chainConfig?.ticker,
        tickerName: chainConfig?.tickerName
      },
      loginConfig: { // Updated structure
        "google": { // Or your chosen key for the google login
          verifier: "m3s-google", // Match the verifier name from Web3Auth dashboard
          typeOfLogin: "google"
        }
      }
    }
  });

  // Web3Auth tests should focus on method presence since we can't fully test functionality without real Web3Auth
  describe('Method Presence Tests', () => {
    it('should have all required ICoreWallet methods', () => {
      // Core wallet methods
      expect(typeof Web3AuthWalletAdapter.prototype.initialize).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.isInitialized).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.disconnect).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.isConnected).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getAccounts).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getBalance).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.verifySignature).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.on).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.off).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getNetwork).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.setProvider).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.sendTransaction).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.signTransaction).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.signMessage).toBe('function');
    });

    it('should have all required IEVMWallet methods', () => {
      // EVM wallet methods
      expect(typeof Web3AuthWalletAdapter.prototype.signTypedData).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getGasPrice).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.estimateGas).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getTransactionReceipt).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.callContract).toBe('function');
    });

    it('should handle event registration correctly', async () => {
      const adapter = await Web3AuthWalletAdapter.create({
        name: 'web3auth',
        version: '1.0.0',
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: chainConfig.chainId, // chainConfig is NetworkConfig from NetworkHelper
              rpcTarget: chainConfig.rpcUrls?.[0], // Use rpcUrls[0]
              displayName: 'Test Chain',
              blockExplorerUrl: 'https://example.com',
              ticker: 'ETH',
              tickerName: 'Ethereum'
            },
            loginConfig: {
              "google": {
                verifier: "google",
                typeOfLogin: "google",
              }
            }
          }
        }
      });


      const callback = vi.fn();
      adapter.on(WalletEvent.accountsChanged, callback);
      adapter.off(WalletEvent.accountsChanged, callback);
      // If we get here without errors, the test passes
    });
  });

  // Test some mock functionality with mocked Web3Auth
  describe('Mocked Functionality Tests', () => {
    let adapter: Web3AuthWalletAdapter;
    let web3authInstance: any; // To access the mock instance

    beforeEach(async () => {
      adapter = await Web3AuthWalletAdapter.create({
        name: 'Web3AuthWallet',
        version: '1.0.0',
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: chainConfig.chainId, // chainConfig is NetworkConfig from NetworkHelper
              rpcTarget: chainConfig.rpcUrls?.[0], // Use rpcUrls[0]
              displayName: 'Test Chain',
              blockExplorerUrl: 'https://example.com',
              ticker: 'ETH',
              tickerName: 'Ethereum'
            },
            loginConfig: {
              "google": {
                verifier: "google",
                typeOfLogin: "google",
              }
            }
          }
        }
      });
      // await adapter.initialize();
      web3authInstance = (adapter as any).web3auth; // Get the internal instance

      if (!web3authInstance) {
        throw new Error("Failed to access internal web3auth mock instance in beforeEach");
      }

      try {
        await web3authInstance.connectTo();
        web3authInstance.connected = true;

        const adapterIsConnected = adapter.isConnected();
        if (!adapterIsConnected) {
          console.error("!!! [Web3Auth Mock Test] beforeEach ERROR: adapter.isConnected() is false after simulated connection! !!!");
        }
      } catch (error) {
        console.error("[Web3Auth Mock Test] Error during simulated connection in beforeEach:", error);
        throw error;
      }
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should get accounts from provider', async () => {
      if (!adapter || !adapter.isConnected()) { // Add check here
        throw new Error("Adapter not connected at the start of 'get accounts' test");
      }
      // The mock provider's request should be called now
      const accounts = await adapter.getAccounts();
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);

      // Optional: Verify the mock provider's request was called
      expect(web3authInstance.provider.request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    });

    it('should get wallet name', () => {
      if (!adapter) throw new Error("Adapter not created in 'get wallet name' test");
      expect(adapter.name).toBe('Web3AuthWallet');
    });

    it('should get a version string', () => {
      if (!adapter) throw new Error("Adapter not created in 'get version' test");
      expect(adapter.version).toBe('1.0.0');
    });

    it('should send a transaction using the mocked signer', async () => {
      if (!adapter || !adapter.isConnected()) {
        throw new Error("Adapter not connected at the start of 'send transaction' test");
      }

      const txData: GenericTransactionData = {
        to: '0x1234567890123456789012345678901234567890',
        value: '10000000000000000', // 0.01 ETH in wei
        data: '0x',
        options: {
          nonce: 0,
          gasLimit: '21000',
          maxFeePerGas: '10000000000',
          maxPriorityFeePerGas: '1000000000',
          chainId: '0xaa36a7'
        }
      };

      const txHash = await adapter.sendTransaction(txData);

      expect(txHash).toBe('0x1111111111111111111111111111111111111111111111111111111111111111');
      expect(web3authInstance.provider.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'eth_sendTransaction' })
      );

      const getTransactionCountCall = web3authInstance.provider.request.mock.calls.find((call: any) => call[0].method === 'eth_getTransactionCount');
      if (txData.options?.nonce === undefined) {
        expect(getTransactionCountCall).toBeDefined();
      } else {
        expect(getTransactionCountCall).toBeUndefined();
      }

      const gasPriceCall = web3authInstance.provider.request.mock.calls.find((call: any) => call[0].method === 'eth_gasPrice');
      const maxPriorityFeeCall = web3authInstance.provider.request.mock.calls.find((call: any) => call[0].method === 'eth_maxPriorityFeePerGas');

      if (txData.options?.gasPrice === undefined && (txData.options?.maxFeePerGas === undefined || txData.options?.maxPriorityFeePerGas === undefined)) {
        expect(gasPriceCall || maxPriorityFeeCall).toBeDefined();
      } else {
        expect(gasPriceCall).toBeUndefined();
        expect(maxPriorityFeeCall).toBeUndefined();
      }

    }, 30000);
  });
});

describe('createWallet with Web3Auth - Validation Tests', () => {
  it.skip('should throw AdapterError if web3authConfig.clientId is missing', async () => {
    const invalidParams: Partial<any> = { // Using Partial<IWalletOptions> or any for test setup
      name: 'web3auth',
      version: '1.0.0',
      options: {
        web3authConfig: {
          web3AuthNetwork: 'testnet',
          chainConfig: {
            chainNamespace: 'eip155',
            chainId: '0xaa36a7',
            rpcTarget: 'https://rpc.sepolia.org/',
            displayName: 'Sepolia',
            blockExplorerUrl: 'https://sepolia.etherscan.io',
            ticker: 'ETH',
            tickerName: 'Sepolia ETH'
          },
          loginConfig: { loginProvider: 'google' }
        }
      }
    };

    try {
      await createWallet(invalidParams as any); // Cast to IWalletOptions if needed by createWallet signature
      throw new Error('createWallet should have thrown');
    } catch (e: any) { // Catch as any to inspect properties
      console.error('Error log', JSON.stringify(e, null, 2))
      expect(e.name).toContain('AdapterError'); // Check the error name
      expect(e).toHaveProperty('code');    // Check for a property specific to AdapterError
      expect(e.code).toBe('MISSING_ADAPTER_REQUIREMENT');
      expect(e.message).toContain("options.web3authConfig.clientId");
    }
  });

  it.skip('should throw AdapterError if web3authConfig.clientId is not a string', async () => {
    const invalidParams: any = { // Using IWalletOptions or any for test setup
      name: 'web3auth',
      version: '1.0.0',
      options: {
        web3authConfig: {
          clientId: 12345, // Incorrect type
          web3AuthNetwork: 'testnet',
          chainConfig: {
            chainNamespace: 'eip155',
            chainId: '0xaa36a7',
            rpcTarget: 'https://rpc.sepolia.org/',
            displayName: 'Sepolia',
            blockExplorerUrl: 'https://sepolia.etherscan.io',
            ticker: 'ETH',
            tickerName: 'Sepolia ETH'
          },
          loginConfig: { loginProvider: 'google' }
        }
      }
    };

    try {
      await createWallet(invalidParams);
      throw new Error('createWallet should have thrown');
    } catch (e: any) {
      expect(e.name).toContain('AdapterError');
      expect(e).toHaveProperty('code');
      console.log('ERROR LOG---> ', e);
      expect(e.code).toBe('INVALID_ADAPTER_REQUIREMENT_TYPE');   // ✅ Fixed error code
      expect(e.details.path).toContain("options.web3authConfig.clientId");
      expect(e.details.message).toContain("options.web3authConfig.clientId is required and must be a string.");
    }
  });
});

// Replace the existing Environment Validation Tests section with this enhanced version:
describe('Environment Validation Tests', () => {
  describe('Environment Error Handling', () => {
    it('should catch and validate Web3Auth environment error structure', async () => {
      const web3authParams: any = {
        name: 'web3auth',
        version: '1.0.0',
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: '0xaa36a7',
              rpcTarget: 'https://rpc.sepolia.org/',
              displayName: 'Sepolia',
              blockExplorerUrl: 'https://sepolia.etherscan.io',
              ticker: 'ETH',
              tickerName: 'Sepolia ETH'
            },
            loginConfig: {
              "google": {
                verifier: "google",
                typeOfLogin: "google"
              }
            }
          }
        }
      };

      let caughtError: any = null;

      try {
        await createWallet(web3authParams);
        throw new Error('❌ Expected createWallet to throw environment error');
      } catch (error: any) {
        caughtError = error;
      }

      // ✅ Validate the error structure thoroughly
      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(Error);
      
      // Check error properties
      expect(caughtError.name).toContain('AdapterError');
      expect(caughtError.message).toMatch(/Cannot be used in Node\.js server environments/i);
      
      // Verify helpful error details
      expect(caughtError.message).toMatch(/web3auth/i);
      expect(caughtError.message).toMatch(/browser/i);
      
      // Check that it has proper error metadata
      expect(typeof caughtError.message).toBe('string');
      expect(caughtError.message.length).toBeGreaterThan(20);
      
      console.log('✅ Environment error structure validated:', {
        name: caughtError.name,
        message: caughtError.message.substring(0, 100) + '...',
        hasCode: !!caughtError.code,
        hasDetails: !!caughtError.details
      });
    });

    it('should handle environment validation gracefully with different configurations', async () => {
      const testConfigs: any = [
        {
          name: 'minimal-config',
          params: {
            name: 'web3auth',
            version: '1.0.0',
            options: { web3authConfig: { clientId: 'test' } }
          }
        },
        {
          name: 'complete-config',
          params: {
            name: 'web3auth',
            version: '1.0.0',
            options: {
              web3authConfig: {
                clientId: 'test-client-id',
                web3AuthNetwork: 'testnet',
                chainConfig: {
                  chainNamespace: 'eip155',
                  chainId: '0x1',
                  rpcTarget: 'https://mainnet.infura.io',
                  displayName: 'Ethereum Mainnet'
                }
              }
            }
          }
        }
      ];

      for (const config of testConfigs) {
        let environmentErrorCaught = false;
        
        try {
          await createWallet(config.params);
        } catch (error: any) {
          environmentErrorCaught = true;
          
          // ✅ All configs should fail with environment error
          expect(error.message).toMatch(/Cannot be used in Node\.js server environments/i);
          expect(error.name).toContain('AdapterError');
        }
        
        expect(environmentErrorCaught).toBe(true);
        console.log(`✅ Environment validation working for ${config.name}`);
      }
    });

    it('should demonstrate error precedence - environment vs parameter validation', async () => {
      // Test with intentionally bad parameters to see if environment validation happens first
      const badParams: any = {
        name: 'web3auth',
        version: '1.0.0',
        options: {
          web3authConfig: {
            // Missing clientId - should trigger parameter validation
            // BUT environment validation should happen first
            web3AuthNetwork: 'testnet'
          }
        }
      };

      try {
        await createWallet(badParams);
        throw new Error('Should have thrown an error');
      } catch (error: any) {
        // ✅ Should get environment error, NOT parameter validation error
        expect(error.message).toMatch(/Cannot be used in Node\.js server environments/i);
        expect(error.message).not.toMatch(/clientId.*required/i);
        
        console.log('✅ Environment validation has correct precedence over parameter validation');
      }
    });

    it('should provide actionable error messages for developers', async () => {
      const web3authParams: any = {
        name: 'web3auth',
        version: '1.0.0',
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: '0xaa36a7',
              rpcTarget: 'https://rpc.sepolia.org/'
            }
          }
        }
      };

      try {
        await createWallet(web3authParams);
        throw new Error('Should have thrown environment error');
      } catch (error: any) {
        const message = error.message.toLowerCase();
        
        // ✅ Error message should be helpful for developers
        expect(message).toMatch(/cannot be used/i);
        expect(message).toMatch(/server environment/i);
        expect(message).toMatch(/browser/i);
        
        // Should mention the specific adapter
        expect(message).toMatch(/web3auth/i);
        
        // Should not be just a generic error
        expect(message.length).toBeGreaterThan(30);
        
        console.log('✅ Error message is developer-friendly:', error.message);
      }
    });
  });

  describe('Environment Detection Validation', () => {
    it('should correctly detect server environment in tests', () => {
      const currentEnv = detectRuntimeEnvironment();
      
      // ✅ Should detect server environment
      expect(currentEnv).toEqual([RuntimeEnvironment.SERVER]);
      
      // ✅ Verify Node.js environment indicators
      expect(typeof process).toBe('object');
      expect(process.versions?.node).toBeDefined();
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');
      
      console.log(`✅ Environment detection working: ${currentEnv}`);
    });

    it('should validate registry environment requirements', () => {
      // ✅ Test Web3Auth requirements
      const web3authEnv = registry.getEnvironmentRequirements('wallet', 'web3auth', '1.0.0');
      expect(web3authEnv).toBeDefined();
      expect(web3authEnv?.supportedEnvironments).toEqual(['browser']);
      expect(web3authEnv?.supportedEnvironments).not.toContain('server');

      // ✅ Test Ethers requirements
      const ethersEnv = registry.getEnvironmentRequirements('wallet', 'ethers', '1.0.0');
      expect(ethersEnv).toBeDefined();
      expect(ethersEnv?.supportedEnvironments).toContain('server');
      expect(ethersEnv?.supportedEnvironments).toContain('browser');

      console.log('✅ Registry environment requirements properly configured');
    });
  });

  describe('Positive Environment Validation', () => {
    it('should allow ethers wallet creation in server environment', async () => {
      const ethersParams: any = {
        name: 'ethers',
        version: '1.0.0',
        options: {
          privateKey: '0x' + '1'.repeat(64) // Valid test private key
        }
      };

      let ethersWallet: any = null;
      let creationError: any = null;

      try {
        ethersWallet = await createWallet(ethersParams);
      } catch (error: any) {
        creationError = error;
      }

      // ✅ Should succeed because ethers supports server environment
      expect(creationError).toBeNull();
      expect(ethersWallet).toBeDefined();
      expect(ethersWallet.name).toBe('ethers');
      expect(typeof ethersWallet.isInitialized).toBe('function');
      
      console.log('✅ Ethers wallet created successfully in server environment');
    });

    it('should handle multiple environment-compatible wallet creations', async () => {
      const ethersConfigs: any = [
        {
          name: 'ethers',
          version: '1.0.0',
          options: { privateKey: '0x' + '1'.repeat(64) }
        },
        {
          name: 'ethers',
          version: '1.0.0',
          options: { privateKey: '0x' + '2'.repeat(64) }
        }
      ];

      for (const config of ethersConfigs) {
        try {
          const wallet = await createWallet(config);
          expect(wallet).toBeDefined();
          expect(wallet.name).toBe('ethers');
        } catch (error: any) {
          throw new Error(`Server-compatible wallet should not fail: ${error.message}`);
        }
      }

      console.log('✅ Multiple ethers wallets created successfully in server environment');
    });
  });

  describe('Error Recovery and Handling', () => {
    it('should allow continued operation after environment validation failures', async () => {
      // ✅ First, fail with Web3Auth
      try {
        await createWallet({
          name: 'web3auth',
          version: '1.0.0',
          options: { web3authConfig: { clientId: 'test' } as any }
        });
        throw new Error('Should have failed');
      } catch (error: any) {
        expect(error.message).toMatch(/server environment/i);
      }

      // ✅ Then, succeed with Ethers
      const ethersWallet = await createWallet({
        name: 'ethers',
        version: '1.0.0',
        options: { privateKey: '0x' + '3'.repeat(64) }
      });

      expect(ethersWallet).toBeDefined();
      expect(ethersWallet.name).toBe('ethers');

      console.log('✅ System continues to work after environment validation failures');
    });

    it('should provide consistent error behavior across multiple attempts', async () => {
      const web3authParams: any = {
        name: 'web3auth',
        version: '1.0.0',
        options: {
          web3authConfig: {
            clientId: 'consistent-test',
            web3AuthNetwork: 'testnet'
          }
        }
      };

      const errors: any[] = [];

      // ✅ Try multiple times to ensure consistent behavior
      for (let i = 0; i < 3; i++) {
        try {
          await createWallet(web3authParams);
          throw new Error('Should have failed');
        } catch (error: any) {
          errors.push(error);
        }
      }

      // ✅ All errors should be consistent
      expect(errors).toHaveLength(3);
      
      for (const error of errors) {
        expect(error.name).toContain('AdapterError');
        expect(error.message).toMatch(/server environment/i);
      }

      console.log('✅ Environment validation provides consistent error behavior');
    });
  });
});