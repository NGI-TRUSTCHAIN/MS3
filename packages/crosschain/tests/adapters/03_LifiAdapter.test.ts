import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { ethers, JsonRpcProvider } from 'ethers';
import { LiFiExecutionProvider, LiFiConfig, createCrossChain } from '../../src/index.js';
import { testAdapterPattern } from '../01_Core.test.js';
// --- Import the Minimal Adapter ---
import { MinimalLiFiAdapter } from '../../src/adapters/LI.FI.Adapter.js';
import { OperationQuote, OperationResult, OperationIntent, ChainAsset } from '../../src/types/interfaces/index.js';
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';
import { RouteExtended } from '@lifi/sdk';
import { createLifiProviderFromWallet } from 'packages/crosschain/src/helpers/ProviderHelper.js';
import { getWorkingChainConfigAsync } from 'packages/wallet/tests/utils.js';
import { RUN_REAL_EXECUTION } from 'packages/crosschain/src/config.js';
import { TEST_PRIVATE_KEY, LIFI_API_KEY } from '../../src/config.js';
import { OperationMonitor } from 'packages/crosschain/src/helpers/OperationMonitor.js';

// --- Dynamic Network Configs (Same as 03) ---
let polygonConfig: any;
let optimismConfig: any;

// --- Test Assets (Same as 03) ---
let MATIC_POLYGON: ChainAsset;
let USDC_POLYGON: ChainAsset;
let USDC_OPTIMISM: ChainAsset;

// --- Test Intents (Same as 03) ---
let swapIntent: OperationIntent;
let bridgeIntent: OperationIntent;
let quoteIntent: OperationIntent;

// --- Test Setup (Same as 03, but adapter type changes) ---
let adapter: MinimalLiFiAdapter; // <<< Use MinimalLiFiAdapter type
let walletInstance: IEVMWallet;
let testAddress: string;
let providerInstance: JsonRpcProvider;

// Constants (Same as 03)
const QUOTE_TEST_TIMEOUT = 20000;
const MINIMAL_TEST_AMOUNT = '100000000000000'; // 0.0001 MATIC
const SWAP_EXECUTION_TIMEOUT = 120000; // 2 minutes
const BRIDGE_TIMEOUT = 1000 * 1250; // 1250 seconds

// createExecutionProvider helper (Same as 03)
const createExecutionProvider = async (): Promise<LiFiExecutionProvider> => {
  if (!walletInstance || !walletInstance.isInitialized()) {
    throw new Error("Wallet must be initialized before creating a LiFi provider");
  }
  const provider = await createLifiProviderFromWallet(walletInstance);
  return provider
};

beforeAll(async () => {
  if (!TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY environment variable is not set. Cannot run execution tests.");
  }

  // --- Fetch Network Configurations (Same as 03) ---
  console.log("Fetching network configurations...");
  polygonConfig = await getWorkingChainConfigAsync('polygon');
  optimismConfig = await getWorkingChainConfigAsync('optimism');

  if (!polygonConfig || !optimismConfig) {
    throw new Error("Failed to fetch required network configurations (Polygon, Optimism).");
  }
  polygonConfig.rpcUrl = "https://polygon-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"
  polygonConfig.rpcUrls = ["https://polygon-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"]
  optimismConfig.rpcUrl = "https://optimism-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"
  optimismConfig.rpcUrls = ["https://optimism-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1"]
  console.log("Using polygonConfig:", polygonConfig);
  console.log("Using optimismConfig:", optimismConfig);
  MATIC_POLYGON = { chainId: polygonConfig.chainId, symbol: 'MATIC', decimals: 18, address: '0x0000000000000000000000000000000000000000' };
  USDC_POLYGON = { chainId: polygonConfig.chainId, symbol: 'USDC', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' };
  USDC_OPTIMISM = { chainId: optimismConfig.chainId, symbol: 'USDC', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' };
  swapIntent = { sourceAsset: MATIC_POLYGON, destinationAsset: USDC_POLYGON, amount: MINIMAL_TEST_AMOUNT, userAddress: '', slippageBps: 300 };
  bridgeIntent = { sourceAsset: MATIC_POLYGON, destinationAsset: USDC_OPTIMISM, amount: MINIMAL_TEST_AMOUNT, userAddress: '', slippageBps: 300 };
  quoteIntent = { sourceAsset: MATIC_POLYGON, destinationAsset: { chainId: optimismConfig.chainId, address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 }, amount: '1000000000000000', userAddress: '', slippageBps: 100 };
  providerInstance = new JsonRpcProvider(polygonConfig.rpcUrl);
  const walletParams: IWalletOptions = { adapterName: 'ethers', provider: providerInstance, options: { privateKey: TEST_PRIVATE_KEY } };
  walletInstance = await createWallet<IEVMWallet>(walletParams);
  await walletInstance.initialize();
  const accounts = await walletInstance.getAccounts();
  testAddress = accounts[0];
  console.log("Test Wallet Address:", testAddress);
  swapIntent.userAddress = testAddress;
  bridgeIntent.userAddress = testAddress;
  quoteIntent.userAddress = testAddress;
  const executionProvider: LiFiExecutionProvider = await createExecutionProvider();
  const config: LiFiConfig = { apiKey: LIFI_API_KEY, provider: executionProvider };
  adapter = await createCrossChain<MinimalLiFiAdapter>({ adapterName: 'lifi-minimal', config: config });
  expect(adapter).toBeInstanceOf(MinimalLiFiAdapter);

}, 60000);


// --- Test Suites ---

// describe('MinimalLiFiAdapter Pattern & Lifecycle Tests', () => {
//   // Test the adapter pattern (private constructor, static create, etc.)
//   testAdapterPattern(MinimalLiFiAdapter, { // <<< Test MinimalLiFiAdapter
//     adapterName: 'lifi-minimal',
//     config: { apiKey: LIFI_API_KEY }
//   });

//   // --- Simplified Lifecycle Tests for Minimal Adapter ---

//   it('1.1: should create adapter with no parameters and be uninitialized', async () => {
//     // Use createCrossChain for consistency, though MinimalLiFiAdapter.create works too
//     const adapterInstance: any = await createCrossChain({
//       adapterName: 'lifi-minimal' // <<< Use minimal name
//     });
//     expect(adapterInstance).toBeInstanceOf(MinimalLiFiAdapter);
//     expect(adapterInstance.isInitialized()).toBe(false);
//     await expect(adapterInstance.getSupportedChains()).rejects.toThrow("MinimalLiFiAdapter not initialized");
//   });

//   it('1.2: should allow setting API key after creation via initialize', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal' });
//     expect(adapterInstance.isInitialized()).toBe(false);
//     await adapterInstance.initialize({ apiKey: LIFI_API_KEY });
//     expect(adapterInstance.isInitialized()).toBe(true);
//     const chains = await adapterInstance.getSupportedChains();
//     expect(chains.length).toBeGreaterThan(0);
//   });

//   it('1.3: should fail when setting provider before initialization', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal' });
//     const executionProvider = await createExecutionProvider();
//     await expect(adapterInstance.setExecutionProvider(executionProvider))
//       .rejects.toThrow("MinimalLiFiAdapter not initialized");
//   });

//   it('2.1: should initialize with API key only and allow adding provider later', async () => {
//     const adapterInstance: any = await createCrossChain({
//       adapterName: 'lifi-minimal',
//       config: { apiKey: LIFI_API_KEY }
//     });
//     expect(adapterInstance.isInitialized()).toBe(true);
//     expect(adapterInstance.hasExecutionProvider()).toBe(false);
//     const chains = await adapterInstance.getSupportedChains(); // Read should work
//     expect(chains.length).toBeGreaterThan(0);

//     const executionProvider = await createExecutionProvider();
//     await adapterInstance.setExecutionProvider(executionProvider);
//     expect(adapterInstance.hasExecutionProvider()).toBe(true);
//   });

//   it('3.1: should initialize with provider only (no API key)', async () => {
//     // Note: LiFi SDK might still require API key for some operations even if provider is set.
//     const executionProvider = await createExecutionProvider();
//     const adapterInstance: any = await createCrossChain({
//       adapterName: 'lifi-minimal',
//       config: { provider: executionProvider }
//     });
//     expect(adapterInstance.isInitialized()).toBe(true); // Initialization itself succeeds
//     expect(adapterInstance.hasExecutionProvider()).toBe(true);
//     // API operations might be rate-limited or fail without API key
//     try {
//       const chains = await adapterInstance.getSupportedChains();
//       expect(chains.length).toBeGreaterThan(0);
//     } catch (e) {
//       console.warn("Getting chains without API key failed (expected for some LiFi endpoints):", e);
//     }
//   });

//   it('4.1: should initialize with both API key and provider', async () => {
//     const executionProvider = await createExecutionProvider();
//     const adapterInstance: any = await createCrossChain({
//       adapterName: 'lifi-minimal',
//       config: {
//         apiKey: LIFI_API_KEY,
//         provider: executionProvider
//       }
//     });
//     expect(adapterInstance.isInitialized()).toBe(true);
//     expect(adapterInstance.hasExecutionProvider()).toBe(true);
//   });
// });

// describe('MinimalLiFiAdapter getOperationQuote Method Tests', () => {
//   // These tests are largely the same as quoting doesn't depend on confirmation/tracking

//   it('5.1: should fail when adapter is not initialized', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal' });
//     await expect(adapterInstance.getOperationQuote(quoteIntent))
//       .rejects.toThrow("MinimalLiFiAdapter not initialized");
//   });

//   // Test 5.2 (quote without API key/provider) might be less reliable, keep it but expect potential failures
//   it('5.2: should attempt quote without API_KEY nor Provider (may fail/timeout)', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal', config: {} });
//     expect(adapterInstance.isInitialized()).toBe(true);
//     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TEST_TIMEOUT));

//     try {
//       const quotes = await Promise.race([
//         adapterInstance.getOperationQuote(quoteIntent),
//         timeoutPromise
//       ]);
//       console.log('[Minimal] Quote 5.2:', quotes);
//       expect(quotes).toBeDefined();
//       // LiFi might require API key, so empty array is acceptable here
//       if (quotes.length > 0) {
//         expect(quotes[0].adapterName).toBe('lifi-minimal');
//       } else {
//         console.warn("⚠️ [Minimal] Quote 5.2 returned empty array (likely needs API key)");
//       }
//     } catch (error) {
//       console.warn("⚠️ [Minimal] Quote 5.2 timed out or failed:", error);
//     }
//   }, QUOTE_TEST_TIMEOUT + 2000);

//   it('5.3: should return quote with API key only', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal', config: { apiKey: LIFI_API_KEY } });
//     const quotes = await adapterInstance.getOperationQuote(quoteIntent);
//     console.log('[Minimal] Quote 5.3:', quotes);
//     expect(quotes).toBeDefined();
//     expect(Array.isArray(quotes)).toBe(true);
//     expect(quotes.length).toBeGreaterThan(0);
//     expect(quotes[0].id).toBeDefined();
//     expect(quotes[0].adapterName).toBe('lifi-minimal');
//     expect(quotes[0].adapterQuote).toBeDefined(); // Raw quote should be stored
//   }, QUOTE_TEST_TIMEOUT);

//   // Test 5.4 (provider only) - keep similar expectations as 5.2
//   it('5.4: should attempt quote with provider only (may fail/timeout)', async () => {
//     const executionProvider = await createExecutionProvider();
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal', config: { provider: executionProvider } });
//     const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TEST_TIMEOUT));

//     try {
//       const quotes = await Promise.race([
//         adapterInstance.getOperationQuote(quoteIntent),
//         timeoutPromise
//       ]);
//       console.log('[Minimal] Quote 5.4:', quotes);
//       expect(quotes).toBeDefined();
//       if (quotes.length > 0) {
//         expect(quotes[0].adapterName).toBe('lifi-minimal');
//       } else {
//         console.warn("⚠️ [Minimal] Quote 5.4 returned empty array (likely needs API key)");
//       }
//     } catch (error) {
//       console.warn("⚠️ [Minimal] Quote 5.4 timed out or failed:", error);
//     }
//   }, QUOTE_TEST_TIMEOUT + 2000);

//   it('5.5: should return quote with both API key and provider', async () => {
//     // Use the globally configured adapter from beforeAll
//     expect(adapter.isInitialized()).toBe(true);
//     expect(adapter.hasExecutionProvider()).toBe(true);
//     const quotes = await adapter.getOperationQuote(quoteIntent);
//     console.log('[Minimal] Quote 5.5:', quotes);
//     expect(quotes).toBeDefined();
//     expect(Array.isArray(quotes)).toBe(true);
//     expect(quotes.length).toBeGreaterThan(0);
//     const quote = quotes[0];
//     expect(quote.id).toBeDefined();
//     expect(quote.estimate).toBeDefined();
//     expect(quote.estimate.toAmountMin).toBeDefined();
//     expect(quote.adapterName).toBe('lifi-minimal'); // <<< Check adapter name
//     expect(quote.adapterQuote).toBeDefined();
//     expect(quote.intent).toEqual(quoteIntent);
//   }, QUOTE_TEST_TIMEOUT);
// });

// describe('MinimalLiFiAdapter executeOperation Method Tests', () => {
//   // Basic checks for prerequisites

//   it('6.1: should fail when adapter is not initialized', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal' });
//     // Create a dummy quote for the test
//     const dummyQuote: OperationQuote = { id: 'dummy', intent: swapIntent, estimate: {} as any, adapterName: 'lifi-minimal', adapterQuote: {} };
//     await expect(adapterInstance.executeOperation(dummyQuote))
//       .rejects.toThrow("MinimalLiFiAdapter not initialized");
//   });

//   it('6.2: should fail when no execution provider is set', async () => {
//     const adapterInstance: any = await createCrossChain({ adapterName: 'lifi-minimal', config: { apiKey: LIFI_API_KEY } });
//     const dummyQuote: OperationQuote = { id: 'dummy', intent: swapIntent, estimate: {} as any, adapterName: 'lifi-minimal', adapterQuote: {} };
//     await expect(adapterInstance.executeOperation(dummyQuote))
//       .rejects.toThrow("Execution provider required");
//   });
// });

describe('MinimalLiFiAdapter Swap Operation Lifecycle', () => {
  let operationMonitor: OperationMonitor;
  beforeEach(() => {
    operationMonitor = new OperationMonitor(); // Create fresh monitor for each test
  });
  afterEach(() => {
    operationMonitor.clearAllOperations(); // Clean up tracked operations
  });
  // Test 7.1 (Get Quote) remains the same
  it('7.1: should get quote for a same-chain swap', async () => {
    console.log("🔄 [Minimal] Testing quote for MATIC to USDC on Polygon");
    expect(adapter.isInitialized()).toBe(true);
    try {
      const quotes = await adapter.getOperationQuote(swapIntent);
      console.log('[Minimal] Swap Quote 7.1:', JSON.stringify(quotes[0], null, 2));
      expect(quotes).toBeDefined();
      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].adapterName).toBe('lifi-minimal');
    } catch (error) {
      console.error("⚠️ [Minimal] Swap Quote 7.1 failed unexpectedly:", error);
      throw error;
    }
  }, QUOTE_TEST_TIMEOUT);

  // Test 7.2 (Execute & Track) - Simplified confirmation
  it('7.2: should execute same-chain swap and track its status', async () => {
    if (!RUN_REAL_EXECUTION) {
      console.log("[Minimal] Skipping real execution test 7.2 - set RUN_REAL_EXECUTION=true to enable");
      return;
    }

    console.log("⚠️ WARNING: [Minimal] Test 7.2 will execute a REAL same-chain swap with fees");
    console.log(`💰 Swapping ${ethers.formatUnits(swapIntent.amount, swapIntent.sourceAsset.decimals)} ${swapIntent.sourceAsset.symbol} to ${swapIntent.destinationAsset.symbol} on Polygon`);

    expect(adapter.hasExecutionProvider()).toBe(true);

    // 1. Get Quote
    let quoteToExecute: OperationQuote;
    try {
      const quotes = await adapter.getOperationQuote(swapIntent);
      expect(quotes.length).toBeGreaterThan(0);
      quoteToExecute = quotes[0];
      console.log("[Minimal] Got quote for swap execution 7.2:", quoteToExecute.id);
    } catch (error) { throw error; }

    // 2. Execute Operation with Hook and Wait for Completion
    let initialResult: OperationResult | null = null;
    const operationPromise = new Promise<void>(async (resolve, reject) => { // <<< Promise resolves void, status checked via monitor
      // Define the hook callback
      const updateHook = (updatedRoute: RouteExtended) => {
        // <<< START Log raw route data >>>
        console.log(`[Minimal Hook 7.2 RAW] SDK Update: ID=${updatedRoute.id}, Status=${updatedRoute.steps[0]?.execution?.status}`);
        // Log details of the last process step if available
        const lastProcess = updatedRoute.steps[0]?.execution?.process?.[updatedRoute.steps[0]?.execution?.process?.length - 1];
        if (lastProcess) {
          console.log(`[Minimal Hook 7.2 RAW] Last Process: Status=${lastProcess.status}, Type=${lastProcess.type}, Substatus=${lastProcess.substatus}, Error=${lastProcess.error?.message}`);
        }
        // <<< END Log raw route data >>>
        const currentStatusResult = adapter['translateRouteToStatus'](updatedRoute); // Use private helper for translation
        console.log(`[Minimal Hook 7.2] Status Update: ${currentStatusResult.status}`, currentStatusResult.statusMessage);

        // <<< Update the external monitor >>>
        operationMonitor.updateOperationStatus(currentStatusResult.operationId, currentStatusResult);

        // Check for terminal state to resolve the wait promise
        if (currentStatusResult.status === 'COMPLETED' || currentStatusResult.status === 'FAILED') {
          console.log(`[Minimal Hook 7.2] Terminal status ${currentStatusResult.status} received.`);
          resolve(); // <<< Resolve the promise (no value needed)
        }
      };

      try {
        // Call executeOperation, passing the hook
        initialResult = await adapter.executeOperation(quoteToExecute, updateHook);
        console.log("✅ [Minimal] Swap initiated 7.2 (hook active):", initialResult);
        expect(initialResult.status).toBe('PENDING');

        // <<< Register initial status in monitor >>>
        operationMonitor.registerOperation(initialResult.operationId, initialResult);

        // Set a timeout for the overall operation
        setTimeout(() => {
          // Check monitor status before rejecting
          const currentStatus = operationMonitor.getOperationStatus(initialResult!.operationId);
          if (currentStatus?.status !== 'COMPLETED' && currentStatus?.status !== 'FAILED') {
            reject(new Error(`Swap operation timed out after ${SWAP_EXECUTION_TIMEOUT}ms (monitor did not report terminal state)`));
          } else {
            resolve(); // Resolve if monitor shows terminal state even if hook missed it
          }
        }, SWAP_EXECUTION_TIMEOUT);

      } catch (execError) {
        reject(execError); // Reject promise if executeOperation fails
      }
    });

    // Wait for the hook to report completion/failure or timeout
    try {
      await operationPromise; // Wait for the operation to reach a terminal state via the hook

      // <<< Get final status from the monitor >>>
      const finalStatus = operationMonitor.getOperationStatus(initialResult!.operationId);
      console.log("[Minimal] Final Swap Status (from Monitor) 7.2:", finalStatus);

      // Assertions on the final result retrieved from the monitor
      expect(finalStatus).not.toBeNull();
      expect(finalStatus!.status).toBe('COMPLETED');
      expect(finalStatus!.receivedAmount).toBeDefined();
      expect(parseFloat(finalStatus!.receivedAmount!)).toBeGreaterThan(0);
      expect(finalStatus!.sourceTx?.hash).toBeDefined();
      expect(finalStatus!.error).toBeUndefined();

    } catch (error) {
      console.error("[Minimal] Error during swap execution/tracking 7.2:", error);
      // If it timed out or failed, check monitor for final state before failing test
      const lastKnownStatus = operationMonitor.getOperationStatus(initialResult!.operationId || 'unknown');
      console.error("[Minimal] Last known status from monitor on error:", lastKnownStatus);
      // Re-throw to fail the test, but log the last known status
      throw error;
    }
  }, SWAP_EXECUTION_TIMEOUT + 10000);
});

// describe('MinimalLiFiAdapter Bridge Operation Lifecycle', () => {
//   let operationMonitor: OperationMonitor;

//   beforeEach(() => {
//     operationMonitor = new OperationMonitor(); // Create fresh monitor for each test
//   });

//   afterEach(() => {
//     operationMonitor.clearAllOperations(); // Clean up tracked operations
//   });

//   // Test 8.1 (Get Quote) remains the same
//   it('8.1: should get quote for a cross-chain bridge', async () => {
//     console.log("🌉 [Minimal] Testing quote for MATIC to ETH bridge (Polygon → Optimism)");
//     expect(adapter.isInitialized()).toBe(true);
//     try {
//       const quotes = await adapter.getOperationQuote(bridgeIntent);
//       console.log('[Minimal] Bridge Quote 8.1:', quotes[0]);
//       expect(quotes).toBeDefined();
//       expect(quotes.length).toBeGreaterThan(0);
//       expect(quotes[0].adapterName).toBe('lifi-minimal');
//       // <<< Add check for correct destination asset in quote intent >>>
//       expect(quotes[0].intent.destinationAsset.symbol).toBe('USDC');
//       expect(quotes[0].intent.destinationAsset.chainId).toBe(optimismConfig.chainId);
//     } catch (error) {
//       console.error("⚠️ [Minimal] Bridge Quote 8.1 failed unexpectedly:", error);
//       throw error;
//     }
//   }, QUOTE_TEST_TIMEOUT);

//   // Test 8.2 (Execute & Track) - Simplified confirmation
//   it('8.2: should execute cross-chain bridge and track its status', async () => {
//     if (!RUN_REAL_EXECUTION) {
//       console.log("[Minimal] Skipping real execution test 8.2 - set RUN_REAL_EXECUTION=true to enable");
//       return;
//     }

//     console.log("⚠️ WARNING: [Minimal] Test 8.2 will execute a REAL cross-chain transaction with fees");
//     console.log(`💰 Bridging ${ethers.formatUnits(bridgeIntent.amount, bridgeIntent.sourceAsset.decimals)} ${bridgeIntent.sourceAsset.symbol} to ${bridgeIntent.destinationAsset.symbol} on Optimism`);

//     expect(adapter.hasExecutionProvider()).toBe(true);

//     // 1. Get Quote
//     let quoteToExecute: OperationQuote;
//     try {
//       // <<< CHANGE: Use the updated bridgeIntent >>>
//       const quotes = await adapter.getOperationQuote(bridgeIntent);
//       expect(quotes.length).toBeGreaterThan(0);
//       quoteToExecute = quotes[0];
//       console.log("[Minimal] Got quote for bridge execution 8.2:", quoteToExecute.id);
//     } catch (error) { throw error; }

//     // 2. Execute Operation with Hook and Wait for Initial Status
//     let initialResult: OperationResult | null = null;
//     let resumeTriggered = false;

//     const bridgePromise = new Promise<void>(async (resolve, reject) => { // <<< Promise resolves void
//       const updateHook = async (updatedRoute: RouteExtended) => {
//         // <<< START Log raw route data >>>
//         console.log(`[Minimal Hook 8.2 RAW] SDK Update: ID=${updatedRoute.id}`);
//         updatedRoute.steps.forEach((step, index) => {
//           console.log(`[Minimal Hook 8.2 RAW] Step ${index}: Type=${step.type}, Tool=${step.toolDetails.key}, Status=${step.execution?.status}`);
//           const lastProcess = step.execution?.process?.[step.execution?.process?.length - 1];
//           if (lastProcess) {
//             console.log(`[Minimal Hook 8.2 RAW]   Last Process: Status=${lastProcess.status}, Type=${lastProcess.type}, Substatus=${lastProcess.substatus}, Error=${lastProcess.error?.message}`);
//           }
//         });
//         // <<< END Log raw route data >>>

//         const currentStatusResult = adapter['translateRouteToStatus'](updatedRoute);
//         console.log(`[Minimal Hook 8.2] Status Update: ${currentStatusResult.status}`, currentStatusResult.statusMessage);
//         operationMonitor.updateOperationStatus(currentStatusResult.operationId, currentStatusResult);

//         // Handle ACTION_REQUIRED for resume
//         if (currentStatusResult.status === 'ACTION_REQUIRED' && !resumeTriggered) {
//           resumeTriggered = true;
//           console.log(`[Minimal Hook 8.2] ACTION_REQUIRED detected. Resuming operation ${currentStatusResult.operationId}...`);
//           try {
//             // Call resume, but don't rely on its return value for status
//             await adapter.resumeOperation(currentStatusResult.operationId);
//             console.log(`[Minimal Hook 8.2] Resume called for ${currentStatusResult.operationId}. Waiting for next status update via hook...`);
//           } catch (resumeError) {
//             console.error(`[Minimal Hook 8.2] Error calling resumeOperation:`, resumeError);
//             // Update monitor with failure if resume fails critically
//             operationMonitor.updateOperationStatus(currentStatusResult.operationId, { status: 'FAILED', error: `Resume failed: ${resumeError}`, statusMessage: `Resume failed: ${resumeError}` });
//             reject(new Error(`Bridge resume failed: ${resumeError}`)); // Reject the main promise
//             return;
//           }
//         }

//         // Log source and destination TX hashes when they appear (keep this logging)
//         if (currentStatusResult.sourceTx?.hash) {
//           console.log(`[Minimal Hook 8.2] Source Tx captured: ${currentStatusResult.sourceTx.hash}`);
//         }

//         if (currentStatusResult.destinationTx?.hash) {
//           console.log(`[Minimal Hook 8.2] Destination Tx captured: ${currentStatusResult.destinationTx.hash}`);
//         }

//         // Check for source transaction hash *after* potential resume
//         if (currentStatusResult.status === 'COMPLETED' || currentStatusResult.status === 'FAILED') {
//           console.log(`[Minimal Hook 8.2] Terminal status ${currentStatusResult.status} received.`);
//           resolve(); // <<< Resolve the promise (void)
//         }
//       };

//       try {
//         initialResult = await adapter.executeOperation(quoteToExecute, updateHook);
//         console.log("✅ [Minimal] Bridge initiated 8.2 (hook active):", initialResult);
//         expect(initialResult.status).toBe('PENDING');

//         // <<< Register initial status in monitor >>>
//         operationMonitor.registerOperation(initialResult.operationId, initialResult);

//         // Timeout for the *entire* bridge operation
//         setTimeout(() => {
//           // Check monitor status before rejecting
//           const currentStatus = operationMonitor.getOperationStatus(initialResult!.operationId);
//           if (currentStatus?.status !== 'COMPLETED' && currentStatus?.status !== 'FAILED') {
//             reject(new Error(`Bridge operation timed out after ${BRIDGE_TIMEOUT}ms (monitor did not report terminal state)`));
//           } else {
//             resolve(); // Resolve if monitor shows terminal state even if hook missed it
//           }
//         }, BRIDGE_TIMEOUT);

//       } catch (execError) {
//         reject(execError); // Reject promise if executeOperation fails
//       }
//     });

//     try {
//       // Wait for the completion promise
//       await bridgePromise;

//       // <<< Get final status from the monitor >>>
//       const finalStatus = operationMonitor.getOperationStatus(initialResult!.operationId);
//       console.log("[Minimal] Final Bridge Status (from Monitor) 8.2:", finalStatus);

//       // Assertions on the final result retrieved from the monitor
//       expect(finalStatus).not.toBeNull();
//       expect(finalStatus!.status).toBe('COMPLETED'); // <<< Expect completion
//       expect(finalStatus!.sourceTx?.hash).toBeDefined();
//       expect(finalStatus!.destinationTx?.hash).toBeDefined(); // <<< Expect destination hash
//       expect(finalStatus!.receivedAmount).toBeDefined();
//       expect(parseFloat(finalStatus!.receivedAmount!)).toBeGreaterThan(0);
//       expect(finalStatus!.error).toBeUndefined();

//     } catch (error) {
//       console.error("[Minimal] Error during bridge execution/tracking 8.2:", error);
//       // If it timed out or failed, check monitor for final state before failing test
//       const lastKnownStatus = operationMonitor.getOperationStatus(initialResult!.operationId || 'unknown');
//       console.error("[Minimal] Last known status from monitor on error:", lastKnownStatus);
//       // Re-throw to fail the test
//       throw error;
//     }

//   }, BRIDGE_TIMEOUT + 10000);

// });

// Describe block 9 (Transaction Confirmation Tests) is REMOVED as MinimalLiFiAdapter delegates confirmation

// describe('MinimalLiFiAdapter Advanced Operation Control Tests', () => {
//   // <<< Instantiate OperationMonitor for this suite >>>
//   let operationMonitor: OperationMonitor;

//   beforeEach(() => {
//     operationMonitor = new OperationMonitor(); // Create fresh monitor for each test
//   });

//   afterEach(() => {
//     operationMonitor.clearAllOperations(); // Clean up tracked operations
//   });

//   // Test 10.1 (Cancellation) - Simplified setup
//   it('10.1: should support manual operation cancellation', async () => {
//     if (!RUN_REAL_EXECUTION) {
//       console.log("[Minimal] Skipping real execution test 10.1 - set RUN_REAL_EXECUTION=true to enable");
//       return;
//     }
//     console.log("⚙️ [Minimal] Testing operation cancellation 10.1");

//     // Use the global adapter instance
//     expect(adapter.hasExecutionProvider()).toBe(true);

//     // 1. Get Quote
//     let quoteToExecute: OperationQuote;
//     try {
//       const quotes = await adapter.getOperationQuote(swapIntent);
//       expect(quotes.length).toBeGreaterThan(0);
//       quoteToExecute = quotes[0];
//       console.log("[Minimal] Got quote for cancellation test 10.1:", quoteToExecute.id);
//     } catch (error) { throw error; }

//     // 2. Start a swap operation (no hook needed for cancellation test)
//     let initialResult: OperationResult | null = null;
//     try {
//       initialResult = await adapter.executeOperation(quoteToExecute);
//       console.log("✅ [Minimal] Operation initiated 10.1:", initialResult.operationId);
//       expect(initialResult.status).toBe('PENDING');

//       // <<< Register initial status in monitor >>>
//       operationMonitor.registerOperation(initialResult.operationId, initialResult);

//     } catch (execError) {
//       console.error("Failed to initiate operation for cancellation test:", execError);
//       throw execError;
//     }

//     // 3. Wait briefly
//     await new Promise(resolve => setTimeout(resolve, 3000));

//     // 4. Cancel the operation
//     console.log("🛑 [Minimal] Cancelling operation 10.1:", initialResult!.operationId);
//     let cancelResult: OperationResult | null = null;
//     try {
//       cancelResult = await adapter.cancelOperation(initialResult!.operationId);
//       console.log("[Minimal] Cancellation result 10.1:", cancelResult);
//       // Direct cancellation result should be FAILED
//       expect(cancelResult.status).toBe('FAILED');
//       expect(cancelResult.error).toContain('canceled by user');
//       expect(cancelResult.adapterName).toBe('lifi-minimal');

//       // <<< Update monitor explicitly based on cancel result (as no hook runs on cancel) >>>
//       // This ensures the monitor reflects the immediate FAILED state from cancelOperation
//       operationMonitor.updateOperationStatus(initialResult!.operationId, cancelResult);

//     } catch (cancelError) {
//       console.error("Error during cancellation call:", cancelError);
//       // If cancelOperation itself throws, fail the test
//       throw new Error(`cancelOperation failed unexpectedly: ${cancelError}`);
//     }

//     // 5. Verify status in OperationMonitor
//     const finalStatusFromMonitor = operationMonitor.getOperationStatus(initialResult!.operationId);
//     console.log("[Minimal] Final Status from Monitor after cancellation 10.1:", finalStatusFromMonitor);

//     expect(finalStatusFromMonitor).not.toBeNull();
//     expect(finalStatusFromMonitor!.status).toBe('FAILED');
//     expect(finalStatusFromMonitor!.error?.toLowerCase() || finalStatusFromMonitor!.statusMessage?.toLowerCase()).toMatch(/cancel|fail/);
//     expect(finalStatusFromMonitor!.adapterName).toBe('lifi-minimal');

//   }, 30000);

//   // Test 10.2 (Confirmation Timeout) is REMOVED
//   // Test 10.3 (Auto-Cancel Pending) is REMOVED
// });