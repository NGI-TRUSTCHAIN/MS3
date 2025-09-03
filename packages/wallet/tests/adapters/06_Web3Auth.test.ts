import { describe, it, expect, vi } from 'vitest';
import { testAdapterPattern } from '../01_Core.test.js';
import { Web3AuthWalletAdapter } from '../../../wallet/src/adapters/web3auth/web3authWallet.js';

// only verify the class follows our factory pattern
describe('Web3AuthWalletAdapter – Basic Factory & API surface', () => {
  vi.spyOn(Web3AuthWalletAdapter.prototype, 'initialize').mockImplementation(async () => { });

  // 1) constructor is private & static create exists
  testAdapterPattern(Web3AuthWalletAdapter, {
    // pass the *shape* of options (we won’t actually call initialize here)
    web3authConfig: {
      clientId: 'x',
      web3AuthNetwork: 'testnet',
      chainConfig: { chainNamespace:'eip155', chainId:'0x1', rpcTarget:'https://x', displayName:'x', blockExplorerUrl:'x', ticker:'ETH', tickerName:'Ethereum'}
    }
  });

  // 2) prototype has the methods we promised
  it('exposes the core IEVMWallet methods on its prototype', () => {
    const proto = Web3AuthWalletAdapter.prototype;
    // pick a few representative ones
    for (const fn of [
      'initialize',
      'disconnect',
      'isConnected',
      'getAccounts',
      'sendTransaction',
      'signTypedData'
    ]) {
      expect(typeof (proto as any)[fn]).toBe('function');
    }
  });
});