import { describe, it, expect, beforeAll } from 'vitest';
import { ethers, JsonRpcProvider } from 'ethers';
import { LiFiExecutionProvider, LiFiConfig, createCrossChain } from '../../src/index.js';
import { LIFI_API_KEY, TEST_PRIVATE_KEY, RUN_REAL_EXECUTION } from '../../config.js';
import { testAdapterPattern } from '../01_Core.test.js';
import { LiFiAdapter } from '../../src/adapters/LI.FI.Adapter.js';
import { OperationQuote, OperationResult, OperationIntent, ChainAsset, TransactionConfirmationHandler } from '../../src/types/interfaces/index.js';
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';
import { getWorkingChainConfigAsync } from '../utils/networks.js'
import { createLifiProviderFromWallet } from '../utils/index.js';

// --- Dynamic Network Configs ---
let polygonConfig: any;
let optimismConfig: any;
// Add others if needed (e.g., mainnetConfig)

// --- Test Assets (will use dynamic chainIds) ---
let MATIC_POLYGON: ChainAsset;
let USDC_POLYGON: ChainAsset;
let USDC_OPTIMISM: ChainAsset;

// --- Test Intents (will use dynamic chainIds) ---
let swapIntent: OperationIntent;
let bridgeIntent: OperationIntent;
let quoteIntent: OperationIntent;

// --- Test Setup ---
let adapter: LiFiAdapter;
let walletInstance: IEVMWallet;
let testAddress: string;
let providerInstance: JsonRpcProvider;

// Constants
const QUOTE_TEST_TIMEOUT = 20000; // Timeout for quote tests
const MINIMAL_TEST_AMOUNT = '100000000000000'; // 0.0001 MATIC
const SWAP_EXECUTION_TIMEOUT = 120000; // 2 minutes for same-chain swap
const BRIDGE_INITIATION_TIMEOUT = 60000; // 1 minute to check bridge initiation 

const createExecutionProvider = async (): Promise<LiFiExecutionProvider> => {
  if (!walletInstance || !walletInstance.isInitialized()) {
    throw new Error("Wallet must be initialized before creating a LiFi provider");
  }
  // Use the helper function which now correctly creates the Viem client structure
  const provider = await createLifiProviderFromWallet(walletInstance);
  // console.log('THE PROVIDER WAS SET TO THIS', provider)
  return provider
};

beforeAll(async () => {
  if (!TEST_PRIVATE_KEY) {
    throw new Error("TEST_PK_ACCOUNT_1 environment variable is not set. Cannot run execution tests.");
  }

  // --- Fetch Network Configurations ---
  console.log("Fetching network configurations...");
  polygonConfig = await getWorkingChainConfigAsync('polygon');
  optimismConfig = await getWorkingChainConfigAsync('optimism');
  // mainnetConfig = await getWorkingChainConfigAsync('ethereum'); // Fetch if needed

  if (!polygonConfig || !optimismConfig) {
    throw new Error("Failed to fetch required network configurations (Polygon, Optimism).");
  }

  console.log("Using Polygon RPC:", polygonConfig.rpcUrl);
  console.log("Using Optimism Chain ID:", optimismConfig.chainId);

  // --- Define Assets using Dynamic Chain IDs ---
  MATIC_POLYGON = { chainId: polygonConfig.chainId, symbol: 'MATIC', decimals: 18, address: '0x0000000000000000000000000000000000000000' };
  // Use a known, reliable USDC address for Polygon PoS
  USDC_POLYGON = { chainId: polygonConfig.chainId, symbol: 'USDC', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' }; // Polygon PoS USDC (Bridged)
  USDC_OPTIMISM = { chainId: optimismConfig.chainId, symbol: 'USDC', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' }; // Optimism Native USDC

  // --- Define Intents using Dynamic Chain IDs ---
  swapIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: USDC_POLYGON, // Use updated USDC address
    amount: MINIMAL_TEST_AMOUNT,
    userAddress: '', // Will be filled below
    slippageBps: 300 // Increase slippage slightly for swaps
  };

  bridgeIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: { // Native ETH on Optimism
      chainId: optimismConfig.chainId,
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18
    },
    amount: MINIMAL_TEST_AMOUNT,
    userAddress: '', // Will be filled below
    slippageBps: 300 // Increase slippage slightly for bridges
  };

  quoteIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: {
      chainId: optimismConfig.chainId,
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18
    },
    amount: '1000000000000000', // 0.001 MATIC
    userAddress: '', // Will be filled below
    slippageBps: 100
  };

  // --- Create Wallet Instance ---
  providerInstance = new JsonRpcProvider(polygonConfig.rpcUrl); // <<< Use fetched RPC URL

  const walletParams: IWalletOptions = {
    adapterName: 'ethers',
    provider: providerInstance,
    options: {
      privateKey: TEST_PRIVATE_KEY
    }
  };

  walletInstance = await createWallet<IEVMWallet>(walletParams);
  await walletInstance.initialize();
  const accounts = await walletInstance.getAccounts();
  testAddress = accounts[0];
  console.log("Test Wallet Address:", testAddress);

  // --- Update Intents with User Address ---
  swapIntent.userAddress = testAddress;
  bridgeIntent.userAddress = testAddress;
  quoteIntent.userAddress = testAddress;

  const executionProvider: LiFiExecutionProvider = await await createExecutionProvider(); // Use helper
  const autoApproveHandler: TransactionConfirmationHandler = {
    onConfirmationRequired: async (operationId: string, txInfo: any) => {
      console.log(`[Test Handler] Auto-approving transaction for ${operationId}`);
      // console.log('[Test Handler] Tx Info:', txInfo); // Optional: log tx details
      return true; // Always approve
    }
  };
  const config: LiFiConfig = {
    apiKey: LIFI_API_KEY,
    provider: executionProvider,
    // autoConfirmTransactions: true,
    confirmationHandler: autoApproveHandler
  };

  adapter = await LiFiAdapter.create({ adapterName: 'lifi', config });

}, 60000);

// --- Helper function to create execution provider (REVISED) ---
// This now uses the globally created walletInstance for consistency

describe('LiFiAdapter Pattern & Lifecycle Tests', () => {
  // Test the adapter pattern (private constructor, static create, etc.)
  testAdapterPattern(LiFiAdapter, {
    adapterName: 'lifi',
    config: { apiKey: LIFI_API_KEY }
  });

  // describe('1. Initialize with Nothing', () => {
  //   it('should create adapter with no parameters', async () => {
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi'
  //     });

  //     expect(adapter).toBeInstanceOf(LiFiAdapter);
  //     expect(adapter.isInitialized()).toBe(false);

  //     // Read operations should fail when not initialized
  //     await expect(adapter.getSupportedChains()).rejects.toThrow("LiFiAdapter not initialized");
  //   });

  //   it('1.2: should allow setting API key after creation', async () => {
  //     const adapter = await createCrossChain({
  //       adapterName: 'lifi'
  //     });

  //     expect(adapter.isInitialized()).toBe(false);

  //     await adapter.initialize({ apiKey: LIFI_API_KEY });
  //     expect(adapter.isInitialized()).toBe(true);

  //     // Read operations should work now
  //     const chains = await adapter.getSupportedChains();
  //     expect(chains.length).toBeGreaterThan(0);
  //   });

  //   it('1.3: should fail when setting provider before initialization', async () => {
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi'
  //     });

  //     const executionProvider = await await createExecutionProvider();

  //     // Should throw error
  //     await expect(adapter.setExecutionProvider(executionProvider))
  //       .rejects.toThrow("LiFiAdapter must be initialized before setting execution provider");
  //   });
  // });

  // describe('2. Initialize with API Key Only', () => {
  //   it('should initialize with API key only', async () => {
  //     const adapter = <any>await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { apiKey: LIFI_API_KEY }
  //     });

  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(false);

  //     // Read operations should work
  //     const chains = await adapter.getSupportedChains();
  //     expect(chains.length).toBeGreaterThan(0);
  //   });

  //   it('2.1: should allow adding execution provider after initialization', async () => {
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { apiKey: LIFI_API_KEY }
  //     });

  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(false);

  //     const executionProvider = await createExecutionProvider();
  //     await adapter.setExecutionProvider(executionProvider);

  //     expect(adapter.hasExecutionProvider()).toBe(true);
  //   });
  // });

  // describe('3. Initialize with Provider Only', () => {
  //   it('should initialize with provider only (no API key)', async () => {
  //     const executionProvider = await createExecutionProvider();

  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { provider: executionProvider }
  //     });

  //     // Should indicate it's properly initialized, just with rate limits
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(true);

  //     // API operations should work (with rate limits)
  //     const chains = await adapter.getSupportedChains();
  //     expect(chains.length).toBeGreaterThan(0);
  //   });

  //   // it('3.1: should allow adding API key after failed provider-only initialization', async () => {
  //   //   const executionProvider = await createExecutionProvider();

  //   //   const adapter: any = await createCrossChain({
  //   //     adapterName: 'lifi',
  //   //     config: { provider: executionProvider }
  //   //   });

  //   //   expect(adapter.isInitialized()).toBe(false);

  //   //   // Now initialize with API key
  //   //   await adapter.initialize({ apiKey: LIFI_API_KEY });
  //   //   expect(adapter.isInitialized()).toBe(true);

  //   //   // Read operations should work now
  //   //   const chains = await adapter.getSupportedChains();
  //   //   expect(chains.length).toBeGreaterThan(0);

  //   //   // Should need to set provider again after proper initialization
  //   //   expect(adapter.hasExecutionProvider()).toBe(false);
  //   // });
  // });

  // describe('4. Initialize with Both API Key and Provider', () => {
  //   it('should initialize with both API key and provider at once', async () => {
  //     const executionProvider = await createExecutionProvider();

  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: {
  //         apiKey: LIFI_API_KEY,
  //         provider: executionProvider
  //       }
  //     });

  //     // Check everything is set up
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(true);
  //   });
  // });

  // describe('5. getOperationQuote Method Tests', () => {
  //   // Sample test parameters for quote operations
  //   it('5.1: should fail when adapter is not initialized', async () => {
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //     });
  //     expect(adapter.isInitialized()).toBe(false);
  //     await expect(adapter.getOperationQuote(quoteIntent))
  //       .rejects.toThrow("LiFiAdapter not initialized");
  //   });

  //   it('5.2: should return quote without API_KEY nor Provider', async () => {
  //     const adapter: any = await createCrossChain({ adapterName: 'lifi', config: {} });
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(false);
  //     const QUOTE_TIMEOUT = 15000; // Increase timeout slightly
  //     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TIMEOUT)); // <<< Type Promise

  //     try {
  //       const quotes = await Promise.race([
  //         adapter.getOperationQuote(quoteIntent),
  //         timeoutPromise
  //       ]);
  //       console.log('Quote 5.2:', quotes);
  //       expect(quotes).toBeDefined();
  //       expect(Array.isArray(quotes)).toBe(true);
  //       if (quotes.length > 0) {
  //         const quote = quotes[0];
  //         expect(quote.id).toBeDefined();
  //         expect(quote.estimate).toBeDefined();
  //         expect(quote.estimate.fromAmount).toBeDefined();
  //         expect(quote.estimate.toAmount).toBeDefined();
  //         expect(quote.estimate.toAmountMin).toBeDefined();
  //         expect(quote.estimate.feeUSD).toBeDefined();
  //       } else { console.warn("⚠️ Quote 5.2 returned empty array"); }
  //     } catch (error) {
  //       console.warn("⚠️ Quote 5.2 timed out or failed:", error);
  //       // Allow pass for now, LiFi might require API key or provider always
  //     }
  //   }, QUOTE_TEST_TIMEOUT);

  //   it('5.3: should return quote with API key only', async () => {
  //     const adapter: any = await createCrossChain({ adapterName: 'lifi', config: { apiKey: LIFI_API_KEY } });
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(false);
  //     const QUOTE_TIMEOUT = 15000;
  //     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TIMEOUT)); // <<< Type Promise

  //     try {
  //       const quotes = await Promise.race([
  //         adapter.getOperationQuote(quoteIntent),
  //         timeoutPromise
  //       ]);
  //       console.log('Quote 5.3:', quotes);
  //       expect(quotes).toBeDefined();
  //       expect(Array.isArray(quotes)).toBe(true);
  //       expect(quotes.length).toBeGreaterThan(0);
  //       const quote = quotes[0];
  //       expect(quote.id).toBeDefined();
  //       expect(quote.estimate).toBeDefined();
  //       expect(quote.estimate.toAmountMin).toBeDefined();
  //       expect(quote.estimate.feeUSD).toBeDefined();
  //       expect(quote.adapterQuote).toBeDefined();
  //     } catch (error) {
  //       console.error("⚠️ Quote 5.3 failed unexpectedly:", error);
  //       throw error;
  //     }
  //   }, QUOTE_TEST_TIMEOUT);

  //   it('5.4: should return quote with provider only (rate limited)', async () => {
  //     const executionProvider = await createExecutionProvider();
  //     const adapter: any = await createCrossChain({ adapterName: 'lifi', config: { provider: executionProvider } });
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(true);
  //     const QUOTE_TIMEOUT = 15000;
  //     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TIMEOUT)); // <<< Type Promise

  //     try {
  //       const quotes = await Promise.race([
  //         adapter.getOperationQuote(quoteIntent),
  //         timeoutPromise
  //       ]);
  //       console.log('Quote 5.4:', quotes);
  //       expect(quotes).toBeDefined();
  //       expect(Array.isArray(quotes)).toBe(true);
  //       if (quotes.length > 0) {
  //         const quote = quotes[0];
  //         expect(quote.id).toBeDefined();
  //         expect(quote.estimate).toBeDefined();
  //         expect(quote.estimate.toAmountMin).toBeDefined();
  //         expect(quote.estimate.feeUSD).toBeDefined();
  //       } else { console.warn("⚠️ Quote 5.4 returned empty array (might require API key)"); }
  //     } catch (error) {
  //       console.warn("⚠️ Quote 5.4 timed out or failed:", error);
  //     }
  //   }, QUOTE_TEST_TIMEOUT);

  //   it('5.5: should return quote with both API key and provider', async () => {
  //     const executionProvider = await createExecutionProvider();
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { apiKey: LIFI_API_KEY, provider: executionProvider }
  //     });
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(true);
  //     const QUOTE_TIMEOUT = 15000;
  //     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TIMEOUT)); // <<< Type Promise

  //     try {
  //       const quotes = await Promise.race([
  //         adapter.getOperationQuote(quoteIntent),
  //         timeoutPromise
  //       ]);
  //       console.log('Quote 5.5:', quotes);
  //       expect(quotes).toBeDefined();
  //       expect(Array.isArray(quotes)).toBe(true);
  //       expect(quotes.length).toBeGreaterThan(0);
  //       const quote = quotes[0];
  //       expect(quote.id).toBeDefined();
  //       expect(quote.estimate).toBeDefined();
  //       expect(quote.estimate.fromAmount).toBeDefined();
  //       expect(quote.estimate.toAmount).toBeDefined();
  //       expect(quote.estimate.toAmountMin).toBeDefined();
  //       expect(quote.estimate.feeUSD).toBeDefined();
  //       expect(quote.estimate.executionDuration).toBeDefined();
  //       expect(quote.adapterName).toBe('lifi');
  //       expect(quote.adapterQuote).toBeDefined();
  //       expect(quote.intent).toEqual(quoteIntent);
  //       expect(quote.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

  //     } catch (error) {
  //       console.error("⚠️ Quote 5.5 failed unexpectedly:", error);
  //       throw error;
  //     }
  //   }, QUOTE_TEST_TIMEOUT);

  // });

  // describe('6. executeOperation Method Tests', () => {
  //   // Use intent for getting quote first
  //   const executionIntent = { // <<< Use intent structure
  //     sourceAsset: { chainId: '137', address: '0x0000000000000000000000000000000000000000', symbol: 'MATIC', decimals: 18 },
  //     destinationAsset: { chainId: '137', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
  //     amount: '100000', // Small amount
  //     userAddress: '0xc4aD6Db1C266E1FF9229aEea524731c1379f4A37', // <<< Use userAddress
  //     slippageBps: 100 // <<< Use slippageBps
  //   };
  //   // Placeholder for a real quote - tests will need to get this first
  //   let sampleQuote: OperationQuote = { // <<< Type OperationQuote
  //     id: 'dummy-quote-id',
  //     intent: executionIntent,
  //     estimate: { fromAmount: '0', toAmount: '0', toAmountMin: '0', routeDescription: '', executionDuration: 0, feeUSD: '0' },
  //     expiresAt: 0,
  //     adapterName: 'lifi',
  //     adapterQuote: { id: 'dummy-lifi-step' } // <<< Add minimal adapterQuote structure
  //   };

  //   it('6.1: should fail when adapter is not initialized', async () => {
  //     const adapter: any = await createCrossChain({ adapterName: 'lifi' });
  //     expect(adapter.isInitialized()).toBe(false);
  //     await expect(adapter.executeOperation(sampleQuote))
  //       .rejects.toThrow("LiFiAdapter not initialized");
  //   });

  //   it('6.2: should fail when no execution provider is set', async () => {
  //     const adapter: any = await createCrossChain({ adapterName: 'lifi', config: { apiKey: LIFI_API_KEY } });
  //     expect(adapter.isInitialized()).toBe(true);
  //     expect(adapter.hasExecutionProvider()).toBe(false);
  //     await expect(adapter.executeOperation(sampleQuote))
  //       .rejects.toThrow("Execution provider required for transaction execution");
  //   });
  // });

  describe('7. Swap Operation Lifecycle', () => {
    it('7.1: should get quote for a same-chain swap', async () => {
      console.log("🔄 Testing quote for MATIC to USDT on Polygon");
      // Use the global adapter instance configured in beforeAll
      expect(adapter.isInitialized()).toBe(true);

      try {
        const quotes = await adapter.getOperationQuote(swapIntent);
        console.log('Swap Quote 7.1:', JSON.stringify(quotes, null, 2)); // Use JSON.stringify for better readability
        expect(quotes).toBeDefined();
        expect(Array.isArray(quotes)).toBe(true);
        expect(quotes.length).toBeGreaterThan(0);
        // Add more specific checks for the quote structure if needed
        const quote = quotes[0];
        expect(quote.id).toBeDefined();
        expect(quote.intent).toEqual(swapIntent);
        expect(quote.estimate.toAmountMin).toBeDefined();
        expect(parseFloat(quote.estimate.toAmountMin)).toBeGreaterThanOrEqual(0); // Should be >= 0
        expect(quote.adapterName).toBe('lifi');
        expect(quote.adapterQuote).toBeDefined();

      } catch (error) {
        console.error("⚠️ Swap Quote 7.1 failed unexpectedly:", error);
        throw error;
      }
    }, QUOTE_TEST_TIMEOUT);

    it('7.2: should execute same-chain swap and track its status', async () => {
      if (!RUN_REAL_EXECUTION) {
        console.log("Skipping real execution test 7.2 - set RUN_REAL_EXECUTION=true to enable");
        return;
      }
      console.log("⚠️ WARNING: Test 7.2 will execute a REAL same-chain swap with fees");
      console.log(`💰 Swapping ${ethers.formatUnits(swapIntent.amount, swapIntent.sourceAsset.decimals)} ${swapIntent.sourceAsset.symbol} to ${swapIntent.destinationAsset.symbol} on Polygon`);

      // Use the global adapter instance configured in beforeAll (has autoConfirm=true)
      expect(adapter.hasExecutionProvider()).toBe(true);

      // 1. Get the quote first
      let quoteToExecute: OperationQuote;
      try {
        const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use dynamic swapIntent
        expect(quotes.length).toBeGreaterThan(0);
        quoteToExecute = quotes[0];
        console.log("Got quote for swap execution 7.2:", quoteToExecute.id);
        console.log("Estimated Output (Min):", quoteToExecute.estimate.toAmountMin, swapIntent.destinationAsset.symbol);
        console.log("Estimated Duration:", quoteToExecute.estimate.executionDuration, "seconds");
      } catch (error) {
        console.error("Failed to get quote for test 7.2:", error);
        throw error;
      }
      // TODO: We need to somehow change the timeout of the test, either calculating this before, just to get the timeout.
      // Then build this entire test block with the quote timeout.
      // Timeout is: quoteToExecute.estimate.executionDuration (seconds)

      // 2. Execute the operation using the obtained quote
      let result: OperationResult;
      try {
        result = await adapter.executeOperation(quoteToExecute);
        console.log("✅ Swap initiated 7.2:", result);
        expect(result).toBeDefined();
        expect(result.operationId).toBe(quoteToExecute.id);
        // Initial status might briefly be PENDING or directly ACTION_REQUIRED if approval needed instantly
        expect(['PENDING', 'ACTION_REQUIRED']).toContain(result.status);
      } catch (execError) {
        console.error("🚨 Failed to initiate swap execution 7.2:", execError);
        throw execError;
      }

       // 3. Track status
       let currentStatus: OperationResult = result;
       let attempts = 0;
       // Use the increased timeout defined earlier
       const maxAttempts = Math.floor(SWAP_EXECUTION_TIMEOUT / 10000) - 2; // ~4 mins worth of 10s checks
       const checkInterval = 10000; // 10 seconds
 
       while (['PENDING', 'ACTION_REQUIRED'].includes(currentStatus.status) && attempts < maxAttempts) {
         await new Promise(resolve => setTimeout(resolve, checkInterval));
         attempts++;
         try {
           currentStatus = await adapter.getOperationStatus(result.operationId);
           console.log(`Status check 7.2 ${attempts}/${maxAttempts}:`, currentStatus.status, currentStatus.statusMessage);
 
           // Log transaction hashes when they appear
           if (currentStatus.sourceTx?.hash && attempts === 1) { // Log only once
              console.log(`   Source Tx Hash: ${currentStatus.sourceTx.hash}`);
           }
 
         } catch (statusError) {
           console.error(`Error fetching status in attempt ${attempts}:`, statusError);
           // Decide if you want to break or continue on status fetch error
           // For now, let's break to avoid masking the error
           throw statusError;
         }
       }
 
       console.log("Final Swap Status 7.2:", currentStatus);
 
       // Assert final status - should be COMPLETED
       expect(currentStatus.status).toBe('COMPLETED');
       expect(currentStatus.receivedAmount).toBeDefined();
       // Ensure received amount is a positive number string
       expect(currentStatus.receivedAmount).toMatch(/^\d+(\.\d+)?$/);
       expect(parseFloat(currentStatus.receivedAmount!)).toBeGreaterThan(0);
       expect(currentStatus.sourceTx?.hash).toBeDefined();
       expect(currentStatus.error).toBeUndefined();
 
     }, SWAP_EXECUTION_TIMEOUT + 10000);
  });

  describe('8. Bridge Operation Lifecycle', () => {
    it('8.1: should get quote for a cross-chain bridge', async () => {
      console.log("🌉 Testing quote for MATIC to ETH bridge (Polygon → Optimism)");
      // Use the global adapter instance
      expect(adapter.isInitialized()).toBe(true);

      try {
        const quotes = await adapter.getOperationQuote(bridgeIntent);
        console.log('Bridge Quote 8.1:', quotes);
        expect(quotes).toBeDefined();
        expect(Array.isArray(quotes)).toBe(true);
        expect(quotes.length).toBeGreaterThan(0);

      } catch (error) {
        console.error("⚠️ Bridge Quote 8.1 failed unexpectedly:", error);
        throw error;
      }
    }, QUOTE_TEST_TIMEOUT);

    it('8.2: should execute cross-chain bridge and track its status', async () => {
      if (!RUN_REAL_EXECUTION) {
        console.log("Skipping real execution test 8.2 - set RUN_REAL_EXECUTION=true to enable");
        return;
      }
      console.log("⚠️ WARNING: Test 8.2 will execute a REAL cross-chain transaction with fees");
      console.log(`💰 Bridging ${ethers.formatUnits(bridgeIntent.amount, bridgeIntent.sourceAsset.decimals)} ${bridgeIntent.sourceAsset.symbol} to ${bridgeIntent.destinationAsset.symbol} on Optimism`);

      // Use the global adapter instance (has autoConfirm=true)
      expect(adapter.hasExecutionProvider()).toBe(true);

      // 1. Get Quote
      let quoteToExecute: OperationQuote;
      try {
        const quotes = await adapter.getOperationQuote(bridgeIntent); // <<< Use dynamic bridgeIntent
        expect(quotes.length).toBeGreaterThan(0);
        quoteToExecute = quotes[0];
        console.log("Got quote for bridge execution 8.2:", quoteToExecute.id);
      } catch (error) {
        console.error("Failed to get quote for test 8.2:", error);
        throw error;
      }

      // 2. Execute Operation
      const result: OperationResult = await adapter.executeOperation(quoteToExecute);
      console.log("✅ Bridge initiated 8.2:", result);
      expect(result).toBeDefined();
      expect(result.operationId).toBe(quoteToExecute.id);
      expect(result.status).toBe('PENDING');

      console.log("Waiting 15s to check initial bridge status...");
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds

      const initialStatus = await adapter.getOperationStatus(result.operationId);
      console.log("Initial Bridge Status Check 8.2:", initialStatus);

      // Assert that it's still PENDING and hasn't immediately failed or required action
      expect(initialStatus.status).toBe('PENDING');
      expect(initialStatus.error).toBeUndefined();

      // 3. Track Status
      // let currentStatus: OperationResult = result;
      // let attempts = 0;
      // const maxAttempts = 60; // Increased attempts for bridging

      // while (['PENDING', 'ACTION_REQUIRED'].includes(currentStatus.status) && attempts < maxAttempts) {
      //   await new Promise(resolve => setTimeout(resolve, 15000)); // 15 sec check for bridges
      //   attempts++;
      //   currentStatus = await adapter.getOperationStatus(result.operationId);
      //   console.log(`Status check 8.2 ${attempts}/${maxAttempts}:`, currentStatus.status, currentStatus.statusMessage);
      // }

      // console.log("Final Bridge Status 8.2:", currentStatus);
      // expect(currentStatus.status).toBe('COMPLETED');
      // expect(currentStatus.receivedAmount).toBeDefined();
      // expect(parseFloat(currentStatus.receivedAmount!)).toBeGreaterThan(0);
      // expect(currentStatus.sourceTx?.hash).toBeDefined();
      // expect(currentStatus.destinationTx?.hash).toBeDefined();
    }, BRIDGE_INITIATION_TIMEOUT);

    // Add this test to the Bridge Operation Lifecycle tests
    it('8.3: should support explicit pause and resume of operations', async () => {
      if (!RUN_REAL_EXECUTION) {
        console.log("Skipping real execution test 8.3 - set RUN_REAL_EXECUTION=true to enable");
        return;
      }
      console.log("⚙️ Testing explicit pause and resume functionality 8.3");

      let handlerCalled = false;
      let resumeDecisionMade = false;
      let shouldApprove = false;

      const pauseResumeHandler: TransactionConfirmationHandler = {
        onConfirmationRequired: async (operationId: string, txInfo: any) => {
          console.log(`⏸️ Handler called for ${operationId} (8.3) - Pausing...`);
          console.log('Transaction Info (8.3):', txInfo); // <<< ADD THIS LINE TO USE txInfo
          handlerCalled = true;
          // Wait until the test decides to resume
          while (!resumeDecisionMade) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Short wait
          }
          console.log(`▶️ Handler resuming for ${operationId} (8.3) with approval: ${shouldApprove}`);
          return shouldApprove;
        }
      };

      // Create a specific adapter instance for this test with the handler
      const executionProvider = await createExecutionProvider();
      const pauseAdapter: any = await createCrossChain({
        adapterName: 'lifi',
        config: {
          apiKey: LIFI_API_KEY,
          provider: executionProvider,
          confirmationHandler: pauseResumeHandler // <<< Use the pause handler
        }
      });

      // 1. Get Quote (use cheaper swapIntent)
      let quoteToExecute: OperationQuote;
      try {
        const quotes = await pauseAdapter.getOperationQuote(swapIntent); // <<< Use swapIntent
        expect(quotes.length).toBeGreaterThan(0);
        quoteToExecute = quotes[0];
        console.log("Got quote for pause/resume test 8.3:", quoteToExecute.id);
      } catch (error) { throw error; }

      // 2. Execute Operation (will pause in handler)
      // Don't await the executeOperation fully if the handler pauses indefinitely initially
      let executePromise = pauseAdapter.executeOperation(quoteToExecute);
      let result: OperationResult | null = null;

      // Wait for the handler to be called or execution to finish/fail early
      let waitAttempts = 0;
      while (!handlerCalled && waitAttempts < 40) { // Wait up to 20 seconds
        await new Promise(resolve => setTimeout(resolve, 500));
        waitAttempts++;
        // Check if the promise resolved/rejected early
        const promiseStatus = await Promise.race([executePromise.then(() => 'resolved'), executePromise.catch(() => 'rejected'), Promise.resolve('pending')]);
        if (promiseStatus !== 'pending') {
          console.warn("Execution finished before handler was called in 8.3");
          result = await executePromise; // Get the result/error
          break;
        }
      }

      // If execution finished early, check the result
      if (result) {
        console.log("Early execution result 8.3:", result);
        // Potentially fail the test if it shouldn't have finished early
        // expect(result.status).not.toBe('COMPLETED');
      }


      // Expect handler to have been called
      expect(handlerCalled).toBe(true); // <<< This might fail if execution finishes too fast

      // Check status should be ACTION_REQUIRED
      let status: OperationResult = await pauseAdapter.getOperationStatus(quoteToExecute.id);
      console.log("Status while paused 8.3:", status);
      // Allow PENDING initially if handler is called very fast
      expect(['ACTION_REQUIRED', 'PENDING']).toContain(status.status);


      // 4. Decide to resume and approve
      console.log("Making decision to resume and approve 8.3...");
      shouldApprove = true;
      resumeDecisionMade = true;

      // 5. Wait for completion
      let attempts = 0;
      const maxAttempts = 30; // Increased attempts
      // Ensure status is fetched again after resuming
      status = await pauseAdapter.getOperationStatus(quoteToExecute.id);
      while (status.status !== 'COMPLETED' && status.status !== 'FAILED' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 sec check
        attempts++;
        status = await pauseAdapter.getOperationStatus(quoteToExecute.id);
        console.log(`Status check 8.3 ${attempts}/${maxAttempts}:`, status.status, status.statusMessage);
      }

      console.log("Final status after pause/resume 8.3:", status);
      expect(status.status).toBe('COMPLETED');
      expect(status.sourceTx?.hash).toBeDefined();
    }, 180000 * 2);
  });

  // describe('9. Transaction Confirmation Tests', () => {
  //   // Create a simple auto-approving confirmation handler for testing
  //   const createApproveHandler = (): TransactionConfirmationHandler => { // <<< Type handler
  //     return {
  //       onConfirmationRequired: async (operationId: string, txInfo: any) => {
  //         console.log('✅ Auto-approving transaction for', operationId);
  //         console.log('Transaction Info (9 -createApproveHandler):', txInfo);
  //         return true; // Always approve
  //       }
  //     };
  //   };

  //   // Create a rejecting confirmation handler for testing rejection flow
  //   const createRejectHandler = (): TransactionConfirmationHandler => { // <<< Type handler
  //     return {
  //       onConfirmationRequired: async (operationId: string, txInfo: any) => {
  //         console.log('❌ Auto-rejecting transaction for', operationId);
  //         console.log('Transaction Info (9 - createRejectHandler):', txInfo);
  //         return false; // Always reject
  //       }
  //     };
  //   };

  //   it('9.1: should execute transaction with auto-confirm enabled', async () => {
  //     if (!RUN_REAL_EXECUTION) { /* ... */ }
  //     console.log("⚙️ Testing transaction 9.1 with autoConfirmTransactions=true");

  //     // Use the global adapter instance (already configured with autoConfirm=true)
  //     expect(adapter.hasExecutionProvider()).toBe(true);

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for auto-confirm test 9.1:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Execute (should auto-confirm)
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute);
  //     console.log("✅ Operation initiated 9.1:", result);
  //     expect(result.status).toBe('PENDING');

  //     // 3. Wait for completion
  //     let status: OperationResult = result;
  //     let attempts = 0;
  //     let maxAttempts = 12;
  //     while (['PENDING', 'ACTION_REQUIRED'].includes(status.status) && attempts < maxAttempts) {
  //       await new Promise(resolve => setTimeout(resolve, 10000)); // 10 sec check
  //       attempts++;
  //       status = await adapter.getOperationStatus(result.operationId);
  //       console.log(`Status check 9.1 ${attempts}/${maxAttempts}:`, status.status);
  //     }

  //     console.log("Status after auto-confirm wait 9.1:", status);
  //     expect(status.status).toBe('COMPLETED');
  //     expect(status.sourceTx?.hash).toBeDefined();
  //   }, 180000 * 2);

  //   it('9.2: should execute transaction with approval confirmation handler', async () => {
  //     if (!RUN_REAL_EXECUTION) {
  //       console.log("Skipping real execution test 9.2 - set RUN_REAL_EXECUTION=true to enable");
  //       return;
  //     }
  //     console.log("⚙️ Testing transaction 9.2 with approval confirmation handler");
  //     const approvalHandler = createApproveHandler();
  //     const executionProvider = await createExecutionProvider();
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { apiKey: LIFI_API_KEY, provider: executionProvider, confirmationHandler: approvalHandler }
  //     });

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for approval handler test 9.2:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Execute (should pause for handler, which then approves)
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute); // <<< Type result
  //     console.log("✅ Operation initiated 9.2:", result);
  //     expect(result.status).toBe('PENDING'); // Initial status

  //     // 3. Wait for completion
  //     let status: OperationResult = result; // <<< Type status
  //     let attempts = 0;
  //     while (status.status !== 'COMPLETED' && status.status !== 'FAILED' && attempts < 15) {
  //       await new Promise(resolve => setTimeout(resolve, 10000));
  //       attempts++;
  //       status = await adapter.getOperationStatus(result.operationId);
  //       console.log(`Status check 9.2 ${attempts}/15:`, status.status);
  //     }

  //     console.log("Status after approval handler 9.2:", status);
  //     expect(status.status).toBe('COMPLETED');
  //     expect(status.sourceTx?.hash).toBeDefined(); // <<< Check sourceTx.hash
  //   }, 180000);

  //   it('9.3: should handle transaction rejection properly', async () => {
  //     if (!RUN_REAL_EXECUTION) {
  //       console.log("Skipping real execution test 9.3 - set RUN_REAL_EXECUTION=true to enable");
  //       return;
  //     }
  //     console.log("⚙️ Testing transaction 9.3 rejection");
  //     const rejectionHandler = createRejectHandler();
  //     const executionProvider = await createExecutionProvider();
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: { apiKey: LIFI_API_KEY, provider: executionProvider, confirmationHandler: rejectionHandler }
  //     });

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for rejection test 9.3:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Execute (should pause for handler, which then rejects)
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute); // <<< Type result
  //     console.log("Transaction started 9.3:", result.operationId);

  //     // 3. Wait a bit for the handler to be called and rejection to process
  //     await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s

  //     // 4. Check status - should be FAILED
  //     const status: OperationResult = await adapter.getOperationStatus(result.operationId); // <<< Type status
  //     console.log("Status after rejection 9.3:", status);
  //     expect(status.status).toBe('FAILED');
  //     expect(status.error).toContain('Transaction rejected by user');
  //   }, 180000);
  // });

  // describe('10. Advanced Operation Control Tests', () => {
  //   it('10.1: should support manual operation cancellation', async () => {
  //     if (!RUN_REAL_EXECUTION) {
  //       console.log("Skipping real execution test 10.1 - set RUN_REAL_EXECUTION=true to enable");
  //       return;
  //     }
  //     console.log("⚙️ Testing operation cancellation 10.1");

  //     const executionProvider = await createExecutionProvider();
  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: {
  //         apiKey: LIFI_API_KEY,
  //         provider: executionProvider,
  //         confirmationHandler: { // Handler delays to allow cancellation
  //           onConfirmationRequired: async (operationId: string, txInfo: any) => {
  //             console.log(`⏸️ Handler called for ${operationId} (10.1)...`);
  //             console.log('Transaction Info (10.1):', txInfo);

  //             await new Promise(resolve => setTimeout(resolve, 2000));
  //             console.log('... approving after wait 10.1 (cancellation might have happened)');
  //             return true;
  //           }
  //         }
  //       }
  //     });

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for cancellation test 10.1:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Start a swap operation
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute); // <<< Type result
  //     console.log("✅ Operation initiated 10.1:", result.operationId);

  //     // 3. Wait briefly for the operation to potentially hit ACTION_REQUIRED
  //     await new Promise(resolve => setTimeout(resolve, 3000));

  //     // 4. Cancel the operation
  //     console.log("🛑 Cancelling operation 10.1:", result.operationId);
  //     const cancelResult: OperationResult = await adapter.cancelOperation(result.operationId); // <<< Type result
  //     console.log("Cancellation result 10.1:", cancelResult);

  //     // 5. Verify cancellation result
  //     expect(cancelResult.status).toBe('FAILED');
  //     expect(cancelResult.error).toContain('canceled by user');

  //     // 6. Verify status via getOperationStatus
  //     await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for state update
  //     const finalStatus: OperationResult = await adapter.getOperationStatus(result.operationId); // <<< Type status
  //     console.log("Final status after cancellation 10.1:", finalStatus);
  //     expect(finalStatus.status).toBe('FAILED');
  //     expect(finalStatus.error).toContain('canceled by user');
  //   }, 30000);

  //   it('10.2: should timeout confirmations after specified period', async () => {
  //     if (!RUN_REAL_EXECUTION) {
  //       console.log("Skipping real execution test 10.2 - set RUN_REAL_EXECUTION=true to enable");
  //       return;
  //     }
  //     console.log("⚙️ Testing confirmation timeout 10.2");

  //     const confirmationTimeout = 3000; // 3 seconds

  //     const executionProvider = await createExecutionProvider();
  //     // Create a custom confirmation handler that deliberately takes longer than timeout
  //     const slowConfirmationHandler: TransactionConfirmationHandler = { // <<< Type handler
  //       onConfirmationRequired: async (operationId: string, txInfo: any) => {
  //         console.log(`🕒 Confirmation handler called for ${operationId} (10.2) - waiting ${confirmationTimeout * 2}ms`);
  //         console.log('Transaction Info (10.2):', txInfo);
  //         await new Promise(resolve => setTimeout(resolve, confirmationTimeout * 2));
  //         console.log(`... Handler finished wait for ${operationId} (10.2) - should have timed out`);
  //         return true; // This approval should not be processed
  //       }
  //     };

  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: {
  //         apiKey: LIFI_API_KEY,
  //         provider: executionProvider,
  //         confirmationTimeout, // Set the short timeout
  //         confirmationHandler: slowConfirmationHandler
  //       }
  //     });

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for timeout test 10.2:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Execute operation - this should trigger the handler and then timeout
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute); // <<< Type result
  //     console.log("✅ Operation initiated 10.2:", result.operationId);

  //     // 3. Wait longer than the timeout for the failure to register
  //     console.log(`Waiting ${confirmationTimeout * 3}ms for timeout to occur...`);
  //     await new Promise(resolve => setTimeout(resolve, confirmationTimeout * 3));

  //     // 4. Check the operation status - it should be FAILED due to timeout
  //     const status: OperationResult = await adapter.getOperationStatus(result.operationId); // <<< Type status
  //     console.log('Operation status after expected timeout 10.2:', status);

  //     expect(status.status).toBe('FAILED');
  //     expect(status.error?.toLowerCase()).toContain('confirmation timed out');
  //   }, 30000);

  //   it('10.3: should auto-cancel operations after specified pendingOperationTimeout', async () => {
  //     if (!RUN_REAL_EXECUTION) {
  //       console.log("Skipping real execution test 10.3 - set RUN_REAL_EXECUTION=true to enable");
  //       return;
  //     }
  //     console.log("⚙️ Testing auto-cancellation 10.3");
  //     const PENDING_TIMEOUT = 5000; // 5 second timeout

  //     const executionProvider = await createExecutionProvider();
  //     // Create adapter with pending timeout and a handler that NEVER approves,
  //     // keeping the operation in ACTION_REQUIRED (which counts as pending for timeout)
  //     const neverApproveHandler: TransactionConfirmationHandler = { // <<< Type handler
  //       onConfirmationRequired: async (operationId: string, txInfo: any) => {
  //         console.log(`🕒 Confirmation handler called for ${operationId} (10.3) - NOT approving.`);
  //         console.log('Transaction Info (10.3):', txInfo);

  //         await new Promise(resolve => setTimeout(resolve, PENDING_TIMEOUT * 3)); // Wait long
  //         return false; // Or just never resolve
  //       }
  //     };

  //     const adapter: any = await createCrossChain({
  //       adapterName: 'lifi',
  //       config: {
  //         apiKey: LIFI_API_KEY,
  //         provider: executionProvider,
  //         pendingOperationTimeout: PENDING_TIMEOUT, // Set short pending timeout
  //         confirmationHandler: neverApproveHandler // Use handler that gets stuck
  //       }
  //     });
  //     const privateAdapter = adapter as LiFiAdapter; // Cast for calling check method

  //     // 1. Get Quote
  //     let quoteToExecute: OperationQuote;
  //     try {
  //       const quotes = await adapter.getOperationQuote(swapIntent); // <<< Use swapIntent
  //       expect(quotes.length).toBeGreaterThan(0);
  //       quoteToExecute = quotes[0];
  //       console.log("Got quote for auto-cancel test 10.3:", quoteToExecute.id);
  //     } catch (error) { throw error; }

  //     // 2. Start a swap operation - it should get stuck in ACTION_REQUIRED
  //     const result: OperationResult = await adapter.executeOperation(quoteToExecute); // <<< Type result
  //     console.log("✅ Operation initiated 10.3:", result.operationId);

  //     // 3. Wait longer than the PENDING_TIMEOUT
  //     console.log(`Waiting ${PENDING_TIMEOUT + 2000}ms for operation to time out...`);
  //     await new Promise(resolve => setTimeout(resolve, PENDING_TIMEOUT + 2000));

  //     // 4. Run the adapter's check for timed-out operations
  //     console.log("Running checkForTimedOutOperations 10.3...");
  //     await privateAdapter.checkForTimedOutOperations();

  //     // 5. Wait a bit for the cancellation to potentially take effect
  //     await new Promise(resolve => setTimeout(resolve, 1000));

  //     // 6. Get the operation status
  //     const status: OperationResult = await adapter.getOperationStatus(result.operationId); // <<< Type status
  //     console.log("Status after auto-cancellation check 10.3:", status);

  //     // 7. Check that the operation is marked as failed/canceled due to timeout
  //     expect(status.status).toBe('FAILED');
  //     expect(status.error?.toLowerCase()).toContain('timed out');
  //   }, 30000);
  // });

});