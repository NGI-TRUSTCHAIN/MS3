import { describe, beforeEach, it, expect, beforeAll } from 'vitest';
import { MockedWalletAdapter, MockWalletArgs } from '../../src/adapters/mockedWallet.js';
import { getTestPrivateKey, getWorkingChainConfigAsync } from '../utils.js';
import { testAdapterPattern } from '../01_Core.test.js';
import { testCoreWalletInterface } from '../02_ICoreWallet.test.js';
import { GenericTransactionData, ProviderConfig } from '@m3s/wallet/index.js';
import { ethers } from 'ethers';

describe('MockedWalletAdapter Tests', () => {
  const privateKey = getTestPrivateKey();
  let sepoliaConfig: ProviderConfig | null; // Use real config
  let walletAddress: string | undefined;

  // Pre-fetch working Sepolia config
  beforeAll(async () => {
    console.log("[MockedWalletAdapter Test] beforeAll: Fetching working Sepolia config...");
    sepoliaConfig = await getWorkingChainConfigAsync('sepolia');
    if (!sepoliaConfig) {
      console.error("FATAL: Could not find a working Sepolia RPC for MockedWalletAdapter tests. Tests will likely fail.");
    } else {
      console.log("[MockedWalletAdapter Test] beforeAll: Using Sepolia config:", sepoliaConfig.rpcUrl);
      // Pre-calculate wallet address
      try {
        walletAddress = new ethers.Wallet(privateKey).address;
        console.log(`[MockedWalletAdapter Test] beforeAll: Test wallet address: ${walletAddress}`);
      } catch (e) {
        console.error("[MockedWalletAdapter Test] beforeAll: Failed to derive wallet address from private key.");
      }
    }
  }, 60000);  // Give beforeAll enough time

  // Define args matching the expected structure
  const adapterArgs: MockWalletArgs = {
    adapterName: 'mocked',
    options: {
      privateKey: privateKey
    }
    // Provider is set in beforeEach now
  };

  // Test constructor pattern using the correct args structure
  testAdapterPattern(MockedWalletAdapter, adapterArgs);

  // Test interface implementation
  let walletInstance!: MockedWalletAdapter; // Use definite assignment assertion
  let setupFailed = false;

  beforeEach(async () => {
    setupFailed = false;
    walletInstance = undefined as any; // Reset

    if (!sepoliaConfig) {
      console.error("[MockedWalletAdapter Test] beforeEach: Skipping setup, Sepolia config unavailable.");
      setupFailed = true;
      return;
    }

    try {
      // Create instance using the correct args structure
      walletInstance = await MockedWalletAdapter.create(adapterArgs);
      // Initialize (creates the internal ethers Wallet)
      await walletInstance.initialize();
      console.log("[MockedWalletAdapter Test] beforeEach: Wallet initialized.");
      // Set provider using real config
      await walletInstance.setProvider(sepoliaConfig);
      console.log("[MockedWalletAdapter Test] beforeEach: Provider set.");

    } catch (error) {
      console.error("[MockedWalletAdapter Test] beforeEach setup failed:", error);
      setupFailed = true;
    }
  }, 60000);

  const itif = (condition: boolean) => condition ? it.skip : it;

  // Test core wallet interface implementation
  // Note: testCoreWalletInterface might need adjustments if it assumes mock data
  // For now, run it but be aware some internal checks might fail if they expect specific mock values
  itif(setupFailed)('implements ICoreWallet interface', () => {
    // Run the shared test suite, skip connectivity checks as it now depends on real network
    testCoreWalletInterface(walletInstance, false); // false = don't skip connectivity
  });


  // Add specific tests for this adapter (now using real data)
  itif(setupFailed)('should have the correct wallet name', () => {
    expect(walletInstance.getWalletName()).toBe('mocked');
  });

  itif(setupFailed)('should be connected after setting provider', () => {
    expect(walletInstance.isConnected()).toBe(true);
  });

  itif(setupFailed)('should return the correct network chainId', async () => {
    const network = await walletInstance.getNetwork();
    // Compare with the config used (allow hex/decimal string comparison)
    const expectedChainIdStr = sepoliaConfig!.chainId!.toString();
    const expectedChainIdHex = expectedChainIdStr.startsWith('0x') ? expectedChainIdStr : `0x${parseInt(expectedChainIdStr).toString(16)}`;
    const expectedChainIdDec = expectedChainIdStr.startsWith('0x') ? parseInt(expectedChainIdStr, 16).toString() : expectedChainIdStr;

    const actualChainIdStr = network.chainId.toString();

    expect([expectedChainIdHex, expectedChainIdDec]).toContain(actualChainIdStr);
  });

  itif(setupFailed)('should return a real balance', async () => {
    const balance = await walletInstance.getBalance();
    expect(balance.symbol).toBe(sepoliaConfig!.ticker || 'ETH'); // Check symbol from config
    expect(balance.amount).toBeTypeOf('string'); // Check type
    expect(BigInt(balance.amount)).toBeGreaterThanOrEqual(0n); // Check it's a non-negative number
    expect(balance.formattedAmount).toBeTypeOf('string');
    console.log(`[MockedWalletAdapter Test] Fetched balance: ${balance.formattedAmount} ${balance.symbol}`);
  }, 60000);


  // --- Transaction and Signing Tests ---

  itif(setupFailed)('should sign a message correctly', async () => {
    const message = "Test message for signing";
    const signature = await walletInstance.signMessage(message);
    expect(signature).toBeTypeOf('string');
    expect(signature.startsWith('0x')).toBe(true);
    console.log(`[MockedWalletAdapter Test] Signed message: ${signature}`);

    // Verify signature (optional but good practice)
    const recoveredAddress = ethers.verifyMessage(message, signature);
    expect(recoveredAddress.toLowerCase()).toBe(walletAddress!.toLowerCase());
  }, 60000);

  itif(setupFailed)('should verify a correct signature', async () => {
    const message = "Another test message";
    const signature = await walletInstance.signMessage(message); // Sign with the adapter's wallet
    const isValid = await walletInstance.verifySignature(message, signature, walletAddress!);
    expect(isValid).toBe(true);
  }, 60000);

  itif(setupFailed)('should fail to verify an incorrect signature', async () => {
    const message = "Message for bad signature";
    const otherWallet = ethers.Wallet.createRandom(); // Create a different wallet
    const badSignature = await otherWallet.signMessage(message);
    const isValid = await walletInstance.verifySignature(message, badSignature, walletAddress!);
    expect(isValid).toBe(false);
  }, 60000);

  itif(setupFailed)('should estimate gas for a simple transfer', async () => {
    const tx: GenericTransactionData = {
      to: walletAddress, // Sending to self
      value: ethers.parseUnits("0.00001", "ether").toString(), // Small amount in wei string
    };
    const gasEstimate = await walletInstance.estimateGas(tx); // Access private method for test if needed, or test via sendTransaction
    expect(gasEstimate).toBeTypeOf('bigint');
    expect(gasEstimate).toBeGreaterThan(0n);
    console.log(`[MockedWalletAdapter Test] Estimated gas: ${gasEstimate.toString()}`);
  }, 60000);

  itif(setupFailed)('should send a simple transaction and get receipt', async () => {
    const recipient = ethers.Wallet.createRandom().address; // Send to a new random address
    const amountToSend = "0.000001"; // ETH string
    const txData: GenericTransactionData = {
      to: recipient,
      value: amountToSend, // Adapter should handle parsing this string via ethers.parseUnits
      // Let adapter populate gas etc.
    };

    console.log(`[MockedWalletAdapter Test] Sending ${amountToSend} ETH to ${recipient}...`);
    const txHash = await walletInstance.sendTransaction(txData);
    console.log(`[MockedWalletAdapter Test] Transaction sent with hash: ${txHash}`);

    expect(txHash).toBeTypeOf('string');
    expect(txHash.startsWith('0x')).toBe(true);
    expect(txHash.length).toBe(66); // Standard Ethereum tx hash length

    // Wait for receipt
    console.log(`[MockedWalletAdapter Test] Waiting for transaction receipt for ${txHash}...`);
    let receipt = null;
    const maxAttempts = 10;
    let attempts = 0;
    while (!receipt && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds between checks
      receipt = await (walletInstance as any).getTransactionReceipt(txHash); // Assuming getTransactionReceipt exists
      console.log(`[MockedWalletAdapter Test] Attempt ${attempts}: Receipt status: ${receipt ? receipt.status : 'null'}`);
    }

    expect(receipt).not.toBeNull();
    expect(receipt!.status).toBe(1); // 1 = success
    expect(receipt!.to?.toLowerCase()).toBe(recipient.toLowerCase());
    expect(receipt!.from.toLowerCase()).toBe(walletAddress!.toLowerCase());
    console.log(`[MockedWalletAdapter Test] Transaction confirmed successfully in block ${receipt!.blockNumber}`);

  }, 60000 * 2); // Increase timeout significantly for send + receipt

  itif(setupFailed)('should sign a transaction', async () => {
    const txData: GenericTransactionData = {
      to: walletAddress, // Sign tx to self
      value: "0.0000001", // ETH string
      data: '0x1234',
      options: {
        // nonce: await walletInstance.getNonce(), // Use current nonce
        gasLimit: 25000n // Provide explicit gas limit for signing test
      }
    };
    const signedTx = await walletInstance.signTransaction(txData);
    expect(signedTx).toBeTypeOf('string');
    expect(signedTx.startsWith('0x')).toBe(true);
    console.log(`[MockedWalletAdapter Test] Signed transaction data: ${signedTx.substring(0, 50)}...`);

    // Optional: Decode and verify parts of the signed tx
    const decodedTx = ethers.Transaction.from(signedTx);
    expect(decodedTx.to?.toLowerCase()).toBe(walletAddress!.toLowerCase());
    expect(decodedTx.data).toBe('0x1234');
    // We can't easily predict the exact nonce fetched internally without querying,
    // but we can check it's a number >= 0
    expect(decodedTx.nonce).toBeGreaterThanOrEqual(0);
    console.log(`[MockedWalletAdapter Test] Decoded nonce: ${decodedTx.nonce}`);
    expect(decodedTx.from?.toLowerCase()).toBe(walletAddress!.toLowerCase());

  }, 60000);

});