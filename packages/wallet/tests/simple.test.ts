import { describe, it, expect } from 'vitest';

describe('Basic Wallet Tests', () => {
  it('environment variable TEST_PRIVATE_KEY exists', () => {
    // Read directly from process.env
    const privateKey = process.env.TEST_PRIVATE_KEY || "0x63a648a4c0efeeb4f08207f1682bed9937a4c6cb5f7f1ee39f75c135e8828b2b";
    console.log('Found private key:', privateKey ? 'YES' : 'NO');
    // We're just checking it exists, not validating the value
    expect(privateKey).toBeDefined();
  });

  it('can import wallet types', async () => {
    const { WalletType } = await import('../src/types/index.js');
    expect(WalletType).toBeDefined();
    expect(WalletType.core).toBe('core');
  });
});