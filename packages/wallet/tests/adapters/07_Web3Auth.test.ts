import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Web3AuthWalletAdapter } from '../../src/adapters/web3authWallet.js';
import { WalletEvent } from '../../src/types/index.js';
import { getChainConfigAsync } from '../utils.js';
import { testAdapterPattern } from '../01_Core.test.js';

// Mock Web3Auth dependencies
vi.mock('@web3auth/no-modal', () => ({
  Web3AuthNoModal: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    configureAdapter: vi.fn(),
    connected: false,
    connectTo: vi.fn().mockResolvedValue(true),
    switchChain: vi.fn().mockResolvedValue(undefined),
    addChain: vi.fn().mockResolvedValue(undefined),
    provider: {
      request: vi.fn().mockImplementation(({ method }: any) => {
        if (method === 'eth_accounts') return ['0x1234567890123456789012345678901234567890'];
        if (method === 'eth_chainId') return '0x1';
        if (method === 'eth_private_key') return '0x1234567890123456789012345678901234567890123456789012345678901234';
        if (method === 'eth_getBalance') return '0x1';
        return null;
      })
    }
  }))
}));

vi.mock('@web3auth/ethereum-provider', () => ({
  EthereumPrivateKeyProvider: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@web3auth/auth-adapter', () => ({
  AuthAdapter: vi.fn().mockImplementation(() => ({}))
}));

// Mock ethers BrowserProvider
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getNetwork: vi.fn().mockResolvedValue({ chainId: '1', name: 'Mainnet' }),
      getBalance: vi.fn().mockResolvedValue('1000000000000000000'),
      getFeeData: vi.fn().mockResolvedValue({ gasPrice: '5000000000' }),
      getTransactionReceipt: vi.fn().mockResolvedValue({}),
      estimateGas: vi.fn().mockResolvedValue('21000'),
      getSigner: vi.fn().mockImplementation(() => ({
        getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
        signMessage: vi.fn().mockResolvedValue('0xsignature'),
        signTransaction: vi.fn().mockResolvedValue('0xsignedtx'),
        sendTransaction: vi.fn().mockResolvedValue({ hash: '0xtxhash' })
      })),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      balanceOf: vi.fn().mockResolvedValue('1000000000000000000'),
      decimals: vi.fn().mockResolvedValue(18)
    })),
    verifyMessage: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
    formatEther: vi.fn().mockReturnValue('1.0'),
    parseEther: vi.fn().mockReturnValue('1000000000000000000')
  };
});

describe('Web3AuthWalletAdapter Tests', () => {
  let chainConfig: any;

  beforeEach(async () => {
    // Get chain config asynchronously before each test
    chainConfig = await getChainConfigAsync('sepolia', true);
  });

  // Test constructor pattern
  testAdapterPattern(Web3AuthWalletAdapter, {
    options: {
      web3authConfig: {
        clientId: 'test-client-id',
        web3AuthNetwork: 'testnet',
        chainConfig: {
          chainNamespace: 'eip155',
          chainId: chainConfig?.chainId || '0xaa36a7',
          rpcTarget: chainConfig?.rpcTarget || 'https://rpc.sepolia.org',
          displayName: chainConfig?.name || 'Sepolia Testnet',
          blockExplorer: chainConfig?.blockExplorer || 'https://sepolia.etherscan.io',
          ticker: chainConfig?.ticker || 'ETH',
          tickerName: chainConfig?.tickerName || 'Ethereum'
        },
        loginConfig: {
          loginProvider: 'google'
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
      expect(typeof Web3AuthWalletAdapter.prototype.getWalletName).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getWalletVersion).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.isConnected).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.requestAccounts).toBe('function');
      expect(typeof Web3AuthWalletAdapter.prototype.getPrivateKey).toBe('function');
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
      expect(typeof Web3AuthWalletAdapter.prototype.getTokenBalance).toBe('function');
    });

    it('should handle event registration correctly', async () => {
      const adapter = await Web3AuthWalletAdapter.create({ 
        adapterName: 'web3auth',
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: chainConfig.chainId,
              rpcTarget: chainConfig.rpcTarget,
              displayName: chainConfig.name,
              blockExplorer: chainConfig.blockExplorer,
              ticker: chainConfig.ticker,
              tickerName: chainConfig.tickerName
            },
            loginConfig: { loginProvider: 'google' }
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

    beforeEach(async () => {
      adapter = await Web3AuthWalletAdapter.create({
        adapterName: 'Web3AuthWallet', 
        options: {
          web3authConfig: {
            clientId: 'test-client-id',
            web3AuthNetwork: 'testnet',
            chainConfig: {
              chainNamespace: 'eip155',
              chainId: chainConfig.chainId,
              rpcTarget: chainConfig.rpcTarget,
              displayName: 'Test Chain',
              blockExplorer: 'https://example.com',
              ticker: 'ETH',
              tickerName: 'Ethereum'
            },
            loginConfig: { loginProvider: 'google' }
          }
        }
      });
      await adapter.initialize();
    });

    it('should get accounts from provider', async () => {
      const accounts = await adapter.getAccounts();
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);
    });

    it('should get wallet name', () => {
      expect(adapter.getWalletName()).toBe('Web3AuthWallet');
    });

    it('should get a version string', () => {
      expect(adapter.getWalletVersion()).toBe('1.0.0');
    });
  });
});