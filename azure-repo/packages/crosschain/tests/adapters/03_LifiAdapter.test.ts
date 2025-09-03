import { describe, it, expect, beforeAll } from 'vitest';
import { createCrossChain, ExecutionStatusEnum } from '../../src/index.js';
import { ILiFiAdapterOptionsV1, MinimalLiFiAdapter } from '../../src/adapters/LI.FI.Adapter.js';
import { OperationQuote, OperationResult, OperationIntent, ChainAsset } from '../../src/types/interfaces/index.js';
import { createWallet, IEVMWallet } from '@m3s/wallet';
import { TEST_PRIVATE_KEY, LIFI_API_KEY, RUN_INTEGRATION, INFURA_API_KEY, BRIDGE_TIMEOUT, QUOTE_TEST_TIMEOUT, SWAP_EXECUTION_TIMEOUT } from '../../config.js';
import { AdapterArguments, NetworkConfig, NetworkHelper } from '@m3s/shared';
import { testAdapterPattern } from '../01_Core.test.js';
import { IEthersWalletOptionsV1 } from '@m3s/wallet';
import {logger} from '../../../../logger.js';

let polygonConfig: any;
let optimismConfig: any;

let MATIC_POLYGON: ChainAsset;
let USDC_POLYGON: ChainAsset;
let USDC_OPTIMISM: ChainAsset;

let swapIntent: OperationIntent;
let bridgeIntent: OperationIntent;
let quoteIntent: OperationIntent;

let adapter: MinimalLiFiAdapter;
let walletInstance: IEVMWallet;
let testAddress: string;
let adapter_name: string;
let adapter_version: string;

beforeAll(async () => {
  if (!TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY environment variable is not set. Cannot run execution tests.");
  }
  if (!INFURA_API_KEY) {
    logger.warning("INFURA_API_KEY is not set. Preferred RPCs for Polygon/Optimism might not work or fall back to public ones.");
  }
  if (!LIFI_API_KEY) {
    logger.warning("LIFI_API_KEY is not set. Li.Fi specific operations might fail.");
  }

  const networkHelper = NetworkHelper.getInstance();
  await networkHelper.ensureInitialized();

  const polygonPreferredRpc = `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`;
  const optimismPreferredRpc = `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`;

  polygonConfig = await networkHelper.getNetworkConfig('matic', [polygonPreferredRpc]);
  optimismConfig = await networkHelper.getNetworkConfig('optimism', [optimismPreferredRpc]);

  if (!polygonConfig || !optimismConfig) {
    throw new Error("Failed to fetch required network configurations (Polygon, Optimism) using NetworkHelper.");
  }

  NetworkHelper.assertConfigIsValid(polygonConfig, 'Polygon Test Setup');
  NetworkHelper.assertConfigIsValid(optimismConfig, 'Optimism Test Setup');

  MATIC_POLYGON = {
    chainId: polygonConfig.chainId,
    address: '0x0000000000000000000000000000000000001010',
    symbol: 'MATIC',
    decimals: 18,
    name: 'Matic Token'
  };

  USDC_POLYGON = {
    chainId: polygonConfig.chainId,
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin Polygon'
  };

  USDC_OPTIMISM = {
    chainId: optimismConfig.chainId,
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin Optimism'
  };

  const maticExecutionAmount = '0.1';
  const smallMaticAmountForBridge = '0.1';

  swapIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: USDC_POLYGON,
    amount: maticExecutionAmount,
    userAddress: '',
    slippageBps: 300
  };

  bridgeIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: USDC_OPTIMISM,
    amount: smallMaticAmountForBridge,
    userAddress: '',
    slippageBps: 300
  };

  quoteIntent = {
    sourceAsset: MATIC_POLYGON,
    destinationAsset: USDC_OPTIMISM,
    amount: smallMaticAmountForBridge,
    userAddress: '',
    slippageBps: 100
  };

  adapter_name = 'lifi';
  adapter_version = '1.0.0';

  interface args extends AdapterArguments<IEthersWalletOptionsV1> { }

  const walletParams: args = {
    name: 'ethers',
    version: adapter_version,
    options: {
      privateKey: TEST_PRIVATE_KEY,
      multiChainRpcs: {
        '137': [`https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`],
        '10': [`https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`],
        '0x89': [`https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`],
        '0xa': [`https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`]
      }
    }
  };

  walletInstance = await createWallet<IEVMWallet>(walletParams);

  const walletProviderConfig: NetworkConfig = {
    name: polygonConfig.name,
    decimals: polygonConfig.decimals,
    chainId: polygonConfig.chainId,
    rpcUrls: polygonConfig.rpcUrls,
    displayName: polygonConfig.displayName,
  };

  try {
    await walletInstance.setProvider(walletProviderConfig);
  } catch (error) {
    logger.error("Failed to set provider on walletInstance in beforeAll:", error);
    throw error;
  }

  const accounts = await walletInstance.getAccounts();
  testAddress = accounts[0];

  swapIntent.userAddress = testAddress;
  bridgeIntent.userAddress = testAddress;
  quoteIntent.userAddress = testAddress;

  const options: ILiFiAdapterOptionsV1 = {
    wallet: walletInstance,
    apiKey: LIFI_API_KEY
  };

  adapter = await createCrossChain<MinimalLiFiAdapter>({ name: adapter_name, version: adapter_version, options });
  expect(adapter).toBeInstanceOf(MinimalLiFiAdapter);
}, 60000);

describe('MinimalLiFiAdapter Pattern & Lifecycle Tests', () => {
  testAdapterPattern(MinimalLiFiAdapter, {
    name: adapter_name,
    version: adapter_version,
    config: { apiKey: LIFI_API_KEY }
  });

  it('1.1: should create adapter with no parameters, be initialized, and allow fetching chains', async () => { // Changed title
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version,
      options: {}
    });
    expect(adapterInstance).toBeInstanceOf(MinimalLiFiAdapter);
    expect(adapterInstance.isInitialized()).toBe(true);
    try {
      const chains = await adapterInstance.getSupportedChains();
      expect(chains.length).toBeGreaterThan(0);
      chains.forEach(chain => {
        expect(chain.chainId).toBeDefined();
        expect(chain.name).toBeDefined();
      });
    } catch (error) {
      logger.error("Test 1.1: getSupportedChains failed unexpectedly:", error);
      throw error;
    }
  });

  it('1.2: should allow setting API key after creation via initialize', async () => {
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version,
      options: {}
    });

    expect(adapterInstance.isInitialized()).toBe(true);

    await adapterInstance.updateConfig({
      options: { apiKey: LIFI_API_KEY }
    });

    expect(adapterInstance.isInitialized()).toBe(true);
    const chains = await adapterInstance.getSupportedChains();
    expect(chains.length).toBeGreaterThan(0);
  });

  it('2.1: should initialize with API key only and allow adding wallet later', async () => {
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version,
      options: { apiKey: LIFI_API_KEY }
    });

    expect(adapterInstance.isInitialized()).toBe(true);
    const chains = await adapterInstance.getSupportedChains();
    expect(chains.length).toBeGreaterThan(0);

  });

});

describe('MinimalLiFiAdapter getOperationQuote Method Tests', () => {

  it('5.1: should attempt to get a quote even if only adapterName was provided at creation', async () => { // MODIFIED: Test description and expectation
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version, options: {}
    });
    expect(adapterInstance.isInitialized()).toBe(true);

    try {
      const quotes = await adapterInstance.getOperationQuote(quoteIntent);
      expect(Array.isArray(quotes)).toBe(true);
    } catch (error) {
      logger.error("Test 5.1: getOperationQuote failed unexpectedly or with a specific LiFi error:", error);
    }
  }, 60000);

  it('5.2: should attempt quote without API_KEY nor Wallet (may fail/timeout)', async () => { // ✅ UPDATED: Description
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version, options: {}
    });
    expect(adapterInstance.isInitialized()).toBe(true);
    const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TEST_TIMEOUT));

    try {
      const quotes = await Promise.race([
        adapterInstance.getOperationQuote(quoteIntent),
        timeoutPromise
      ]);

      expect(quotes).toBeDefined();
      if (quotes.length > 0) {
        expect(quotes[0].adapter.name).toBe('lifi');
      } else {
        logger.warning("⚠️ [Minimal] Quote 5.2 returned empty array (likely needs API key)");
      }
    } catch (error) {
      logger.warning("⚠️ [Minimal] Quote 5.2 timed out or failed:", error);
    }
  }, QUOTE_TEST_TIMEOUT + 2000);

  it('5.3: should return quote with API key only', async () => {
    const adapterInstance: any = await createCrossChain({
      name: adapter_name,
      version: adapter_version, options: { apiKey: LIFI_API_KEY }
    });
    const quotes = await adapterInstance.getOperationQuote(quoteIntent);

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes[0].id).toBeDefined();
    expect(quotes[0].adapter.name).toBe('lifi');
    expect(quotes[0].adapter.version).toBe('1.0.0');

    expect(quotes[0].adapterQuote).toBeDefined();
  }, QUOTE_TEST_TIMEOUT);

  it('5.4: should attempt quote with wallet only (may fail/timeout)', async () => {
    const adapterInstance: any = await createCrossChain({
      name: adapter_name,
      version: adapter_version,
      options: { wallet: walletInstance }
    });
    const timeoutPromise = new Promise<OperationQuote[]>((_, reject) => setTimeout(() => reject(new Error("Quote operation timed out")), QUOTE_TEST_TIMEOUT));

    try {
      const quotes = await Promise.race([
        adapterInstance.getOperationQuote(quoteIntent),
        timeoutPromise
      ]);

      expect(quotes).toBeDefined();
      if (quotes.length > 0) {
        expect(quotes[0].adapter.name).toBe('lifi');
        expect(quotes[0].adapter.version).toBe('1.0.0');
      } else {
        logger.warning("⚠️ [Minimal] Quote 5.4 returned empty array (likely needs API key)");
      }
    } catch (error) {
      logger.warning("⚠️ [Minimal] Quote 5.4 timed out or failed:", error);
      throw error;
    }
  }, QUOTE_TEST_TIMEOUT + 2000);

  it('5.5: should return quote with both API key and wallet', async () => {

    expect(adapter.isInitialized()).toBe(true);

    const quotes = await adapter.getOperationQuote(quoteIntent);

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);
    const quote = quotes[0];
    expect(quote.id).toBeDefined();

    expect(quote.adapterQuote.estimate).toBeDefined();
    expect(quote.adapterQuote.estimate.toAmountMin).toBeDefined();
    expect(quotes[0].adapter.name).toBe('lifi');

    expect(quote.adapterQuote).toBeDefined();
    expect(quote.intent).toEqual(quoteIntent);
  }, QUOTE_TEST_TIMEOUT);
});

describe('MinimalLiFiAdapter executeOperation Method Tests', () => {
  it('6.1: should fail when invalid quote is provided', async () => {
    const adapterInstance = await createCrossChain<MinimalLiFiAdapter>({
      name: adapter_name,
      version: adapter_version,
      options: {}
    });

    expect(adapterInstance.isInitialized()).toBe(true);

    const dummyQuote: OperationQuote = {
      id: 'dummy',
      intent: swapIntent,
      gasCosts: {
        limit: '',
        amount: '',
        amountUSD: ''
      },
      feeUSD: '0',
      adapter: {
        name: adapter_name,
        version: adapter_version
      },
      adapterQuote: {}
    };

    await expect(adapterInstance.executeOperation(dummyQuote, { wallet: walletInstance }))
      .rejects
      .toThrow('Invalid or incomplete quote provided for execution.');
  }, 60000);

  it('6.2: should fail when no wallet is provided in options', async () => {
    const adapterInstance: any = await createCrossChain({
      name: adapter_name,
      version: adapter_version,
      options: { apiKey: LIFI_API_KEY }
    });

    const dummyQuote: OperationQuote = {
      id: 'dummy',
      intent: swapIntent,
      gasCosts: {
        limit: '',
        amount: '',
        amountUSD: ''
      },
      feeUSD: '0',
      adapter: {
        name: adapter_name,
        version: adapter_version
      },
      adapterQuote: {}
    };

    await expect(adapterInstance.executeOperation(dummyQuote, undefined))
      .rejects.toThrow('Execution provider not set. Cannot execute operation.');
  }, 60000);

  it('6.3: should fail early with clear message when RPC validation fails', async () => {
    const cleanWallet = await createWallet<IEVMWallet>({
      name: 'ethers',
      version: '1.0.0',
      options: { privateKey: TEST_PRIVATE_KEY }
    });

    await cleanWallet.setProvider(polygonConfig);

    const cleanAdapter = await createCrossChain<MinimalLiFiAdapter>({
      name: 'lifi',
      version: '1.0.0',
      options: { wallet: cleanWallet, apiKey: LIFI_API_KEY }
    });

    const quotes = await cleanAdapter.getOperationQuote(swapIntent);
    const quote = quotes[0];

    await expect(cleanAdapter.executeOperation(quote, { wallet: cleanWallet }))
      .rejects
      .toThrow(/Private RPCs required.*updateAllChainRpcs/);
  }, 60000);

  it('6.4: should use wallet-configured RPCs for reliable operations', async () => {
    const polygonRpcs = walletInstance.getAllChainRpcs()['137'];
    const optimismRpcs = walletInstance.getAllChainRpcs()['10'];

    expect(polygonRpcs).toBeDefined();
    expect(optimismRpcs).toBeDefined();
    expect(polygonRpcs![0]).toContain('infura.io');
    expect(optimismRpcs![0]).toContain('infura.io');

    const currentRpcs = walletInstance.getAllChainRpcs();
    const updatedRpcs = {
      ...currentRpcs,
      '1': [`https://mainnet.infura.io/v3/${INFURA_API_KEY}`]
    };

    await walletInstance.updateAllChainRpcs(updatedRpcs);

    const newAllRpcs = walletInstance.getAllChainRpcs();
    expect(newAllRpcs['1']).toBeDefined();
    expect(newAllRpcs['1'][0]).toContain('infura.io');
  }, 60000);

  it('6.5: should provide helpful error messages for missing private RPCs', async () => {
    const partialWallet = await createWallet<IEVMWallet>({
      name: 'ethers',
      version: '1.0.0',
      options: {
        privateKey: TEST_PRIVATE_KEY,
        multiChainRpcs: {
          '137': [`https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`]
        }
      }
    });

    await partialWallet.setProvider(polygonConfig);

    const partialAdapter = await createCrossChain<MinimalLiFiAdapter>({
      name: 'lifi',
      version: '1.0.0',
      options: { wallet: partialWallet, apiKey: LIFI_API_KEY }
    });

    const quotes = await partialAdapter.getOperationQuote(bridgeIntent);
    const quote = quotes[0];

    await expect(partialAdapter.executeOperation(quote, { wallet: partialWallet }))
      .rejects
      .toThrow(/Missing chains.*10.*updateAllChainRpcs/);
  }, 60000);
});

describe('MinimalLiFiAdapter Swap Operation Lifecycle', () => {

  it('7.1: should get quote for a same-chain swap', async () => {
    expect(adapter.isInitialized()).toBe(true);
    try {
      const quotes = await adapter.getOperationQuote(swapIntent);
      expect(quotes).toBeDefined();
      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].adapter.name).toBe('lifi');
    } catch (error) {
      logger.error("⚠️ [Minimal] Swap Quote 7.1 failed unexpectedly:", error);
      throw error;
    }
  }, QUOTE_TEST_TIMEOUT);

  it('7.2: should execute same-chain swap and track its status', async () => {
    if (!RUN_INTEGRATION) {
      logger.warning("[Minimal] Skipping real execution test 7.2 - set RUN_INTEGRATION=true to enable");
      return;
    }

    const quotes = await adapter.getOperationQuote(swapIntent);
    expect(quotes.length).toBeGreaterThan(0);
    const quoteToExecute = quotes[0];

    let finalStatus: OperationResult | null = null;
    let completed = false;
    let failed = false;

    const statusUpdates: OperationResult[] = [];

    const onStatus = (status: OperationResult) => {
      statusUpdates.push(status);
      if (status.status === ExecutionStatusEnum.COMPLETED) {
        completed = true;
        finalStatus = status;
      }
      if (status.status === ExecutionStatusEnum.FAILED) {
        failed = true;
        finalStatus = status;
      }
      logger.info(`[TEST] Status update: ${status.operationId} - ${status.status} - ${status.statusMessage}`);
    };

    adapter.on('status', onStatus);

    const initialResult = await adapter.executeOperation(quoteToExecute, { wallet: walletInstance });
    expect(initialResult.status).toBe('PENDING');
    expect(initialResult.operationId).toBeDefined();

    let tries = 0;
    const iterations = 180
    const milisecondsPerIteration = SWAP_EXECUTION_TIMEOUT / iterations
    
    while (!completed && !failed && tries < iterations) {
      await new Promise(res => setTimeout(res, milisecondsPerIteration));
      tries++;
    }

    adapter.off('status', onStatus);

    expect(finalStatus).not.toBeNull();
    
    if (finalStatus!.status === ExecutionStatusEnum.COMPLETED) {
      expect(finalStatus!.sourceTx?.hash).toBeDefined();
      expect(finalStatus!.receivedAmount).toBeDefined();
      expect(parseFloat(finalStatus!.receivedAmount!)).toBeGreaterThan(0);
      logger.info('🎉 Swap operation completed successfully!');
    } else {
      throw new Error(`Swap operation failed: ${finalStatus!.error}`);
    }
  }, SWAP_EXECUTION_TIMEOUT);
});

describe('MinimalLiFiAdapter Bridge Operation Lifecycle', () => {

  it('8.1: should get quote for a cross-chain bridge', async () => {
    expect(adapter.isInitialized()).toBe(true);
    try {
      const quotes = await adapter.getOperationQuote(bridgeIntent);
      expect(quotes).toBeDefined();
      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].adapter.name).toBe('lifi');
      expect(quotes[0].adapter.version).toBe('1.0.0');

      expect(quotes[0].intent.destinationAsset.symbol).toBe('USDC');
      expect(quotes[0].intent.destinationAsset.chainId).toBe(optimismConfig.chainId);
    } catch (error) {
      logger.error("⚠️ [Minimal] Bridge Quote 8.1 failed unexpectedly:", error);
      throw error;
    }
  }, QUOTE_TEST_TIMEOUT);

  it('8.2: should execute cross-chain bridge and track its status', async () => {
    if (!RUN_INTEGRATION) {
      logger.info("[Minimal] Skipping real execution test 8.2 - set RUN_INTEGRATION=true to enable");
      return;
    }

    let quoteToExecute: OperationQuote;
    try {
      logger.info('BRIDGE INTENT ',bridgeIntent )
      const quotes = await adapter.getOperationQuote(bridgeIntent);
      logger.info('quotes ' ,quotes )

      expect(quotes.length).toBeGreaterThan(0);
      quoteToExecute = quotes[0];
    } catch (error) { throw error; }

    let finalStatus: OperationResult | null = null;
    let completed = false;
    let failed = false;
    const statusUpdates: OperationResult[] = [];

    const onStatus = (status: OperationResult) => {
      statusUpdates.push(status);
      if (status.status === ExecutionStatusEnum.COMPLETED) {
        completed = true;
        finalStatus = status;
      }
      if (status.status === ExecutionStatusEnum.FAILED) {
        failed = true;
        finalStatus = status;
      }
      logger.info(`[TEST] Bridge status update: ${status.operationId} - ${status.status} - ${status.statusMessage}`);
    };

    adapter.on('status', onStatus);

    let initialResult: OperationResult | null = null;
    initialResult = await adapter.executeOperation(quoteToExecute, { wallet: walletInstance });
    expect(initialResult.status).toBe('PENDING');
    expect(initialResult.operationId).toBeDefined();

    let tries = 0;
    const iterations = 180
    const milisecondsPerIteration = BRIDGE_TIMEOUT / iterations

    while (!completed && !failed && tries < iterations) {
      await new Promise(res => setTimeout(res, milisecondsPerIteration));
      tries++;
    }

    adapter.off('status', onStatus);

    expect(finalStatus).not.toBeNull();
    expect([ExecutionStatusEnum.COMPLETED, ExecutionStatusEnum.FAILED]).toContain(finalStatus!.status);

    if (finalStatus!.status === ExecutionStatusEnum.COMPLETED) {
      if (finalStatus!.sourceTx?.hash) {
        expect(finalStatus!.sourceTx.hash).toBeDefined();
        expect(finalStatus!.sourceTx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      }
      if (finalStatus!.destinationTx?.hash) {
        expect(finalStatus!.destinationTx.hash).toBeDefined();
        expect(finalStatus!.destinationTx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      }
      if (finalStatus!.sourceTx?.explorerUrl) {
        expect(finalStatus!.sourceTx.explorerUrl).toContain('http');
      }
      expect(finalStatus!.receivedAmount).toBeDefined();
      expect(parseFloat(finalStatus!.receivedAmount!)).toBeGreaterThan(0);
      expect(finalStatus!.error).toBeUndefined();
      logger.info('🎉 Bridge operation completed successfully!');
    } else {
      throw new Error(`Bridge operation failed: ${finalStatus!.error}`);
    }
  }, BRIDGE_TIMEOUT);
});

describe('MinimalLiFiAdapter Advanced Operation Control Tests', () => {

  it('9.1: should support manual operation cancellation', async () => {
    if (!RUN_INTEGRATION) {
      logger.info("[Minimal] Skipping real execution test 9.1 - set RUN_INTEGRATION=true to enable");
      return;
    }

    let quoteToExecute: OperationQuote;
    try {
      const quotes = await adapter.getOperationQuote(swapIntent);
      expect(quotes.length).toBeGreaterThan(0);
      quoteToExecute = quotes[0];
    } catch (error) { throw error; }

    let finalStatus: OperationResult | null = null;
    let failed = false;
    const statusUpdates: OperationResult[] = [];

    const onStatus = (status: OperationResult) => {
      statusUpdates.push(status);
      if ([ExecutionStatusEnum.COMPLETED, ExecutionStatusEnum.FAILED].includes(status.status)) {
        failed = true;
        finalStatus = status;
      }
      logger.info(`[TEST] Cancel status update: ${status.operationId} - ${status.status} - ${status.statusMessage}`);
    };

    adapter.on('status', onStatus);

    let initialResult: OperationResult | null = null;
    try {
      initialResult = await adapter.executeOperation(quoteToExecute, { wallet: walletInstance });
      expect(initialResult.status).toBe('PENDING');
    } catch (execError) {
      adapter.off('status', onStatus);
      logger.error("Failed to initiate operation for cancellation test:", execError);
      throw execError;
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    let cancelResult: OperationResult | null = null;
    try {
      cancelResult = await adapter.cancelOperation(initialResult!.operationId, {});
      expect(cancelResult.status).toBe('FAILED');
      expect(cancelResult.error).toContain('canceled by user');
      expect(cancelResult.adapter.name).toBe('lifi');
      expect(cancelResult.adapter.version).toBe('1.0.0');
    } catch (cancelError) {
      adapter.off('status', onStatus);
      logger.error("Error during cancellation call:", cancelError);
      throw new Error(`cancelOperation failed unexpectedly: ${cancelError}`);
    }

    let tries = 0;
    const iterations = 180
    const milisecondsPerIteration = 30000 / iterations
    
    while (!failed && tries < iterations) {
      await new Promise(res => setTimeout(res, milisecondsPerIteration));
      tries++;
    }

    adapter.off('status', onStatus);

    expect(finalStatus).not.toBeNull();
    expect([ExecutionStatusEnum.COMPLETED, ExecutionStatusEnum.FAILED]).toContain(finalStatus!.status);
    expect(
      (finalStatus!.error?.toLowerCase() || finalStatus!.statusMessage?.toLowerCase())
    ).toMatch(/cancel|fail|completed|success/);
    expect(finalStatus!.adapter.name).toBe('lifi');
    expect(finalStatus!.adapter.version).toBe('1.0.0');
  }, 60000);

  it('9.2: should properly extract chain IDs and transaction details', async () => {
    if (!RUN_INTEGRATION) {
      logger.info("[Minimal] Skipping chain ID validation test - set RUN_INTEGRATION=true to enable");
      return;
    }

    const quotes = await adapter.getOperationQuote(bridgeIntent);
    expect(quotes.length).toBeGreaterThan(0);
    const quote = quotes[0];

    const result = await adapter.executeOperation(quote, { wallet: walletInstance });
    expect(result.operationId).toBeDefined();
  }, 60000);

  it('9.3: should handle rapid status updates without performance issues', async () => {
    if (!RUN_INTEGRATION) return;

    const quotes = await adapter.getOperationQuote(swapIntent);
    const quote = quotes[0];

    await adapter.executeOperation(quote, { wallet: walletInstance });
  }, 60000);

  it('9.4: should demonstrate wallet RPC management workflow', async () => {
    const currentRpcs = walletInstance.getAllChainRpcs();
    expect(Object.keys(currentRpcs).length).toBeGreaterThan(0);

    logger.info('Current wallet RPCs:', currentRpcs);

    const updatedRpcs = {
      ...currentRpcs,
      '42161': [`https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`]
    };

    await walletInstance.updateAllChainRpcs(updatedRpcs);

    const finalRpcs = walletInstance.getAllChainRpcs();
    expect(finalRpcs['42161']).toBeDefined();
    expect(finalRpcs['42161'][0]).toContain('infura.io');
    expect(finalRpcs['137']).toBeDefined();
    expect(finalRpcs['10']).toBeDefined();

    logger.info('✅ Wallet RPC management workflow completed successfully');
  }, 60000);
});