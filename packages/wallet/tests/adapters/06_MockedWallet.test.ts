import { describe, beforeEach, it, expect } from 'vitest';
import { MockedWalletAdapter } from '../../src/adapters/mockedWallet.js';
import { getTestPrivateKey } from '../utils.js';
import { testAdapterPattern } from '../01_Core.test.js';
import { testCoreWalletInterface } from '../02_ICoreWallet.test.js';

describe('MockedWalletAdapter Tests', () => {
  const privateKey = getTestPrivateKey();
  
  // Test constructor pattern
  testAdapterPattern(MockedWalletAdapter, { privateKey });
  
  // Test interface implementation
  let walletInstance!: MockedWalletAdapter; // Use definite assignment assertion
  
  beforeEach(async () => {
    walletInstance = await MockedWalletAdapter.create({ privateKey });
    await walletInstance.initialize();
  });
  
  // Test core wallet interface implementation
  testCoreWalletInterface(walletInstance, false);
  
  // Add specific tests for this adapter
  it('should have the correct wallet name', () => {
    expect(walletInstance.getWalletName()).toBe('MockedWalletAdapter');
  });
  
  it('should return the private key that was used to create it', async () => {
    const returnedKey = await walletInstance.getPrivateKey();
    expect(returnedKey).toBe(privateKey);
  });
});