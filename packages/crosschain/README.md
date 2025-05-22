# @m3s/crosschain

A simplified cross-chain transfer library built on top of LI.FI, enabling token transfers between different blockchain networks with minimal configuration.

> ⚠️ **DEVELOPMENT WARNING**  
> This package is in active development (alpha stage). The API, features, and configuration options are subject to breaking changes without notice. Please test thoroughly before integrating into production.

---

## Development Status

This package is currently in **alpha** stage:

- 🚧 Core functionality is implemented and undergoing testing and refinement
- ⚠️ APIs may change without warning between versions
- 🧪 Some features may not work as expected
- 📝 Documentation might be incomplete or outdated until beta version

---

## Installation

```bash
npm install @m3s/crosschain
```

## Features

- 🌉 **Cross-Chain Transfers**: Move tokens between 20+ supported blockchains
- 💱 **Token Swapping**: Automatically swap tokens during transfers when needed
- 🔍 **Route Discovery**: Find optimal paths for token transfers
- 📊 **Gas Estimation**: Get accurate gas estimates before executing transfers
- 🔄 **Status Tracking**: Track the status of ongoing transfers
- 🧩 **Wallet Integration**: Compatible with @m3s/wallet or any ethers-compatible wallet

## Quick Start

```javascript
import { createCrossChain, ILiFiAdapterOptionsV1 } from '@m3s/crosschain';
import { createWallet, IEVMWallet } from '@m3s/wallet'; // Assuming wallet usage

async function main() { // Wrap in async
  // 1. Setup Wallet (from @m3s/wallet)
  const walletOptions /*: IWalletOptions */ = { /* ... wallet options ... */ }; // Add type if desired
  const wallet = await createWallet<IEVMWallet>(walletOptions);
  // Ensure wallet is connected and has an account/provider on the source chain
  // e.g., await wallet.setProvider({ chainId: 137, ... }); await wallet.requestAccounts();


  // 2. Define adapter-specific options (example for LI.FI)
  const lifiOptions: ILiFiAdapterOptionsV1 = {
    // apiKey: 'YOUR_LIFI_API_KEY_HERE', // If required by the adapter
    // integrator: 'M3S_App', // Example
  };

  // 3. Create a cross-chain instance
  const crosschain = await createCrossChain({ // Add ICrossChainOptions type if desired
    adapterName: 'lifi', // Or your registered LI.FI adapter name
    options: lifiOptions
  });

  // (Optional) If the adapter has an initialize method that requires the wallet:
  // await crosschain.initialize({ wallet }); // Or pass wallet to specific methods

  // 4. Get a quote for a cross-chain transfer
  const userAddress = (await wallet.getAccounts())[0]; // Get address from M3S wallet
  // ... rest of quoteIntent, ensure wallet is passed if needed by getOperationQuote
  const quotes = await crosschain.getOperationQuote({ ...quoteIntent, wallet }); // Pass wallet if needed

  if (quotes.length === 0) {
    console.error("No quotes found!");
    return;
  }

  const quote = quotes[0];
  console.log(`Best quote from ${quote.adapterName}: Will receive approx ${quote.toAmount} ${quote.intent.destinationAsset.symbol}`);

  // 5. Execute the cross-chain transfer (ensure wallet has funds and is on source chain)
  // const result = await crosschain.executeOperation(quote);
  // console.log(`Transfer initiated! Operation ID: ${result.operationId}, Status: ${result.status}`);
  // if(result.sourceTx?.hash) console.log(`Source Tx Hash: ${result.sourceTx.hash}`);
}
```

## Supported Chains

The library supports all major EVM chains and Layer 2 networks, including:

| Chain ID | Name             |
|----------|------------------|
| 1        | Ethereum         |
| 10       | Optimism         |
| 56       | BNB Chain        |
| 137      | Polygon          |
| 42161    | Arbitrum         |
| 43114    | Avalanche        |
| 8453     | Base             |

And many more! Use `getSupportedChains()` to get the complete list.

## Working with Quotes

Quotes provide information about potential transfers without executing them. You use `getOperationQuote` with a `CrossChainQuoteIntent`.

```javascript
// Assuming 'crosschain' instance and 'wallet' are set up
const userAddress = (await wallet.getAccounts())[0];
const quoteIntent: CrossChainQuoteIntent = {
  fromChainId: 137, // Polygon
  toChainId: 56, // BNB Chain
  fromTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  toTokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BNB Chain
  amount: '5000000', // 5 USDC (with 6 decimals)
  userAddress: userAddress,
  // wallet: wallet, // Optional: Pass wallet if adapter needs it for quoting (e.g., for approvals)
  // options: { slippage: 0.005 } // Adapter-specific options for quoting
};

const quotes: CrossChainQuote[] = await crosschain.getOperationQuote(quoteIntent);

if (quotes.length > 0) {
  const bestQuote = quotes[0]; // Assuming quotes are sorted or you pick one
  console.log(`Estimated gas cost: ${bestQuote.estimate?.gasCosts?.usdAmount || 'N/A'} USD`);
  console.log(`Execution time: ~${bestQuote.estimate?.executionDuration || 'N/A'} seconds`);
  console.log(`Bridge/Tool used: ${bestQuote.toolDetails?.name || 'N/A'}`);
  console.log(`Estimated output amount: ${bestQuote.toAmount} (${bestQuote.toAmountMin || 'N/A'} minimum)`);
} else {
  console.log("No quotes found for the given intent.");
}
```

## Quote Options

You can customize quote generation by passing adapter-specific options within the `CrossChainQuoteIntent`:

```javascript
const quoteIntentWithOptions: CrossChainQuoteIntent = {
  // ... other intent properties ...
  userAddress: userAddress,
  options: { // Adapter-specific options (e.g., for LI.FI)
    slippage: 0.005, // 0.5% slippage tolerance
    allowBridges: ['stargate', 'across'], // Only use these bridges
    denyBridges: [],
    allowExchanges: ['1inch'],
    denyExchanges: [],
    // other LI.FI specific options like 'order', 'integrator', etc.
  }
};
const quotes = await crosschain.getOperationQuote(quoteIntentWithOptions);
```

## Executing Operations

Once you have a `CrossChainQuote`, you can execute it using `executeOperation`.

```javascript
// Assuming 'quoteToExecute' is a valid CrossChainQuote and 'wallet' is set up
try {
  const params: ExecuteCrossChainOperationParams = {
    quote: quoteToExecute,
    wallet: wallet // Wallet is required for signing
  };
  const result: OperationResult = await crosschain.executeOperation(params);
  
  console.log(`Operation submitted!`);
  console.log(`Operation ID: ${result.operationId}`);
  console.log(`Initial Status: ${result.status}`);
  if (result.sourceTx?.hash) {
    console.log(`Source Transaction Hash: ${result.sourceTx.hash}`);
  }
  
  // Save the operationId to check status later
  // localStorage.setItem('lastCrossChainOpId', result.operationId);
} catch (error) {
  console.error('Cross-chain operation execution failed:', error.message);
}
```

## Tracking Operation Status

After an operation is initiated with `executeOperation`, you receive an `OperationResult` containing an `operationId` and the initial status. You can then use `crosschain.getOperationStatus(operationId)` to poll for updates.

### Direct Polling

This is the standard way to get the latest status directly from the adapter.

```javascript
// Assuming 'crosschain' is your ICrossChain instance
// And 'initialResult' is the OperationResult from:
// const initialResult = await crosschain.executeOperation({ quote: selectedQuote, wallet });
const operationId = initialResult.operationId;

async function checkStatusPeriodically(opId) {
  try {
    // Use OperationResult as the type for status, as defined in ICrossChain
    const currentStatus: OperationResult = await crosschain.getOperationStatus(opId);
    
    console.log(`[Poll] Operation ID: ${currentStatus.operationId}`);
    console.log(`[Poll] Status: ${currentStatus.status}`); // e.g., PENDING, COMPLETED, FAILED
    console.log(`[Poll] Message: ${currentStatus.statusMessage || 'N/A'}`);

    if (currentStatus.sourceTx?.hash) {
      console.log(`  Source Tx: ${currentStatus.sourceTx.hash} (Chain: ${currentStatus.sourceTx.chainId})`);
    }
    if (currentStatus.destinationTx?.hash) {
      console.log(`  Destination Tx: ${currentStatus.destinationTx.hash} (Chain: ${currentStatus.destinationTx.chainId})`);
    }
    if (currentStatus.receivedAmount) {
      console.log(`  Received Amount: ${currentStatus.receivedAmount}`); // Amount in destination asset's smallest unit
    }
    if (currentStatus.error) {
      console.error(`  Error: ${currentStatus.error}`);
    }

    // For detailed step-by-step progress, you might need to inspect adapter-specific data
    // if the adapter includes it in the OperationResult (e.g., in an `adapterSpecificData` field),
    // or use adapter-specific methods if available. The generic OperationResult provides an overall status.
    // For instance, the LI.FI adapter's raw `RouteExtended` object (from its onStatusUpdate hook or internal state)
    // contains detailed step information.

    if (currentStatus.status === 'COMPLETED' || currentStatus.status === 'FAILED') {
      console.log(`[Poll] Operation reached terminal state: ${currentStatus.status}`);
      // Stop polling
      return true;
    }
    return false; // Continue polling
  } catch (error) {
    console.error(`[Poll] Error checking status for ${opId}:`, error);
    // Decide if polling should stop on error
    return true; // Stop polling on error
  }
}

// Example of initiating polling:
// if (operationId) {
//   const pollInterval = setInterval(async () => {
//     const done = await checkStatusPeriodically(operationId);
//     if (done) clearInterval(pollInterval);
//   }, 20000); // Poll every 20 seconds
// }
```

### Advanced: Using `OperationMonitor` for Local Status Tracking

The `@m3s/crosschain` package includes an optional `OperationMonitor` helper class (exported from the package root) to simplify client-side tracking of multiple operation statuses. This is useful for UIs that need to display ongoing operations without managing individual polling loops for each.

```javascript
import { 
  createCrossChain, 
  ILiFiAdapterOptionsV1, // Or your specific adapter options type
  ICrossChainOptions,
  OperationResult, 
  OperationMonitor, // Import the helper
  ExecuteCrossChainOperationParams,
  CrossChainQuote // Assuming you have this from getOperationQuote
} from '@m3s/crosschain';
import { IEVMWallet } from '@m3s/wallet'; // Assuming wallet usage

// 1. Initialize the monitor (typically once in your application)
const operationMonitor = new OperationMonitor();

async function executeAndTrackOperationWithMonitor(
  crosschain: ICrossChain, 
  quoteToExecute: CrossChainQuote, 
  wallet: IEVMWallet
) {
  let initialResult: OperationResult;
  try {
    const params: ExecuteCrossChainOperationParams = { quote: quoteToExecute, wallet };
    initialResult = await crosschain.executeOperation(params);
    
    console.log(`Operation initiated: ID ${initialResult.operationId}, Status: ${initialResult.status}`);
    
    // 2. Register the operation with the monitor using its initial status
    operationMonitor.registerOperation(initialResult.operationId, initialResult);

  } catch (error) {
    console.error("Failed to execute operation:", error);
    return; // Exit if execution fails
  }

  const operationId = initialResult.operationId;

  // 3. Periodically update the monitor by polling the adapter for each tracked operation.
  // This can be done in a shared background loop or interval that iterates over monitored operations.
  const pollAndUpdateMonitor = async (opId: string) => {
    try {
      const updatedStatusFromServer = await crosschain.getOperationStatus(opId);
      operationMonitor.updateOperationStatus(opId, updatedStatusFromServer); // Update the monitor

      // Log from the monitor's stored state
      const monitoredStatus = operationMonitor.getOperationStatus(opId);
      if (monitoredStatus) {
        console.log(`[Monitor Update] OpID: ${opId}, Status: ${monitoredStatus.status}, Message: ${monitoredStatus.statusMessage}`);
      }

      if (updatedStatusFromServer.status === 'COMPLETED' || updatedStatusFromServer.status === 'FAILED') {
        console.log(`Operation ${opId} reached terminal state: ${updatedStatusFromServer.status}.`);
        return true; // Indicate polling can stop for this operation
      }
      return false; // Indicate polling should continue
    } catch (pollError) {
      console.error(`Error polling status for ${opId}:`, pollError);
      // Optionally update monitor with an error state or stop tracking
      operationMonitor.updateOperationStatus(opId, { status: 'UNKNOWN', error: `Polling failed: ${pollError.message}` });
      return true; // Indicate polling should stop for this operation due to error
    }
  };

  // Example: Start polling for this specific operation
  // In a real app, you might have a central mechanism that polls for all operations in the monitor.
  if (operationId) {
    const pollIntervalId = setInterval(async () => {
      const done = await pollAndUpdateMonitor(operationId);
      if (done) {
        clearInterval(pollIntervalId);
        console.log(`Stopped polling for ${operationId}.`);
        // Optionally, remove from monitor if it's considered fully resolved and no longer needed for display
        // operationMonitor.removeOperation(operationId); 
      }
    }, 30000); // Poll every 30 seconds
  }

  // 4. Retrieve status from the monitor elsewhere in your app at any time
  // const currentMonitoredStatus = operationMonitor.getOperationStatus(operationId);
  // if (currentMonitoredStatus) {
  //   console.log(`[From Monitor] Current status of ${operationId}: ${currentMonitoredStatus.status}`);
  // }
}

// --- Example Usage ---
// async function demo() {
//   // const wallet = await createWallet(...);
//   // const crosschain = await createCrossChain(...);
//   // const quotes = await crosschain.getOperationQuote(...);
//   // if (quotes.length > 0) {
//   //   await executeAndTrackOperationWithMonitor(crosschain, quotes[0], wallet);
//   // }
// }
// demo();
```

**Note on Adapter-Specific Update Hooks:**

Some adapters might provide specific mechanisms for more real-time status updates, such as an `onStatusUpdate` callback that can be passed to their `executeOperation` method. If your chosen adapter supports this (e.g., the included `MinimalLiFiAdapter` has an optional `onStatusUpdate` parameter in its `executeOperation` method that receives LI.FI SDK's `RouteExtended` updates), you can use these hooks to feed updates to the `OperationMonitor` more directly, potentially reducing the need for frequent polling.

Using such hooks would involve:
1.  Passing your callback to the adapter's `executeOperation`.
2.  Inside your callback, you'd receive adapter-specific data (e.g., `RouteExtended` for LI.FI).
3.  You would then need to either:
    *   Manually translate this data into a `Partial<OperationResult>` to update the `OperationMonitor`.
    *   Or, if the adapter provides a utility for this translation, use that.
    *   Alternatively, after receiving a hook update, you could trigger a call to `crosschain.getOperationStatus()` to get the standardized `OperationResult` and update the monitor.

This approach is more advanced and depends on the specific adapter's capabilities. For generic usage, polling `crosschain.getOperationStatus()` is the standard way to update the `OperationMonitor`.


## Integration with @m3s/wallet

```javascript
import { createWallet } from '@m3s/wallet';
import { createCrossChain } from '@m3s/crosschain';

// Create and initialize a wallet
async function setupCrossChainWithWallet() { // Wrap in async
  // Create and initialize a wallet
  const walletOptions /*: IWalletOptions */ = {
    adapterName: 'ethers', // or 'web3auth'
    options: { /* your wallet adapter options */ }
  };
  const wallet = await createWallet(walletOptions);
  await wallet.requestAccounts(); // Ensure accounts are available

  // Create crosschain instance with its options
  const crossChainAdapterOpts: ILiFiAdapterOptionsV1 = { /* ... LI.FI specific options ... */ };
  const crosschain = await createCrossChain({ // Add ICrossChainOptions type if desired
    adapterName: 'lifi', // Example
    options: crossChainAdapterOpts
  });

  // (Optional) If the adapter has an initialize method that requires the wallet:
  // await crosschain.initialize({ wallet }); // Or pass wallet to specific methods

  // Now you can use crosschain operations
  const supportedChains = await crosschain.getSupportedChains();
  console.log(`You can transfer tokens between ${supportedChains.length} chains using the '${crosschain.getAdapterName()}' adapter.`);
}
```

## API Reference

### Main Package Export

| Function             | Arguments                               | Returns                   | Description                                                                 |
|----------------------|-----------------------------------------|---------------------------|-----------------------------------------------------------------------------|
| `createCrossChain()` | `params: ICrossChainOptions`            | `Promise<ICrossChain>`    | Creates and initializes a new crosschain adapter instance.                  |

### `ICrossChain` Adapter Interface Methods

These methods are available on the instance returned by `createCrossChain()`.

| Method                       | Arguments                                                                 | Returns                               | Description                                                                    |
|------------------------------|---------------------------------------------------------------------------|---------------------------------------|--------------------------------------------------------------------------------|
| `initialize(args?)`          | `args?: any` (Adapter-specific, e.g., `{ wallet: IEVMWallet }`)           | `Promise<void>`                       | Optional: Further initialize or update the adapter.                            |
| `getAdapterName()`           | -                                                                         | `string`                              | Returns the name of the adapter (e.g., "lifi").                                |
| `getSupportedChains()`       | -                                                                         | `Promise<ChainAsset[]>`               | Get a list of chains supported by the adapter.                                 |
| `getSupportedTokens(chainId?)`| `chainId?: string \| number` (Optional)                                   | `Promise<ChainAsset[]>`               | Get a list of supported tokens, optionally filtered by chain.                  |
| `getOperationQuote(intent)`  | `intent: CrossChainQuoteIntent`                                           | `Promise<CrossChainQuote[]>`          | Get one or more quotes for a cross-chain operation.                            |
| `executeOperation(params)`   | `params: ExecuteCrossChainOperationParams`                                | `Promise<OperationResult>`            | Execute a cross-chain operation. Returns initial operation result.             |
| `getOperationStatus(opId)`   | `opId: string`                                                            | `Promise<OperationResult>`            | Check the status of an ongoing or completed cross-chain operation.             |

---

## Key Data Types

This section provides an overview of important data structures and interfaces used by the `@m3s/crosschain` package. For detailed definitions, please refer to the source files, primarily within `packages/crosschain/src/types/`.

*   **`ICrossChain`**:
    *   The fundamental interface that all crosschain adapters must implement. It defines common operations like getting quotes and executing crosschain operations.
    *   *Key Methods*: `getAdapterName`, `getSupportedChains`, `getSupportedTokens`, `getOperationQuote`, `executeOperation`, `getOperationStatus`.
    *   *Defined in: `packages/crosschain/src/types/interface.ts`*

*   **`ICrossChainOptions`**:
    *   The primary configuration object passed to `createCrossChain` to instantiate an adapter. It extends `ModuleArguments` from `@m3s/common`.
    *   *Key Properties*:
        *   `adapterName: string` (e.g., `"lifi"`) - Specifies the registered name of the adapter.
        *   `options?: CrossChainAdapterOptionsV1` - Adapter-specific options (e.g., `ILiFiAdapterOptionsV1`).
    *   *Defined in: `packages/crosschain/src/index.ts`*

*   **`CrossChainAdapterOptionsV1`**:
    *   A union type representing all possible adapter-specific options for the `options` field of `ICrossChainOptions`.
    *   Currently: `ILiFiAdapterOptionsV1`.
    *   *Defined in: `packages/crosschain/src/types/types/index.ts` (or `types/options.ts` if created)*
    *   *Exported from: `packages/crosschain/src/types/index.ts`*

*   **`ILiFiAdapterOptionsV1`**:
    *   Specific options for the LI.FI adapter.
    *   *Key Properties*: `apiKey?: string`, `integrator?: string`, `defaultRouteOptions?: LifiRouteOptions` (refer to LI.FI SDK for `LifiRouteOptions` structure), etc.
    *   *Defined in: `packages/crosschain/src/adapters/LI.FI.Adapter.ts`*
    *   *Exported from: `packages/crosschain/src/adapters/options.ts` and subsequently from `packages/crosschain/src/index.ts`*

*   **`CrossChainQuoteIntent`**:
    *   Input object for `getOperationQuote`.
    *   *Key Properties*: `fromChainId: number | string`, `toChainId: number | string`, `fromTokenAddress: string`, `toTokenAddress: string`, `amount: string`, `userAddress: string`, `wallet?: IEVMWallet` (optional, if adapter needs signer for quotes), `options?: any` (adapter-specific quote options).
    *   *Defined in: `packages/crosschain/src/types/interface.ts`*

*   **`CrossChainQuote`**:
    *   Output object from `getOperationQuote`, representing a potential crosschain route.
    *   *Key Properties*: `id: string`, `adapterName: string`, `intent: CrossChainQuoteIntent`, `fromAmount: string`, `toAmount: string`, `toAmountMin?: string`, `estimate: object` (fees, duration), `toolDetails?: any`, `adapterQuote?: any` (raw quote from adapter, e.g., LI.FI Step object).
    *   *Defined in: `packages/crosschain/src/types/interface.ts`*

*   **`ExecuteCrossChainOperationParams`**:
    *   Input object for `executeOperation`.
    *   *Key Properties*: `quote: CrossChainQuote`, `wallet: IEVMWallet` (required for signing).
    *   *Defined in: `packages/crosschain/src/types/interface.ts`*

*   **`OperationResult`**:
    *   Output object from both `executeOperation` (initial status) and `getOperationStatus` (updated status).
    *   *Key Properties*: `operationId: string`, `status: string` (e.g., 'PENDING', 'COMPLETED', 'FAILED', 'ACTION_REQUIRED', 'UNKNOWN'), `sourceTx?: { hash?: string, chainId?: string | number, explorerUrl?: string }`, `destinationTx?: { hash?: string, chainId?: string | number, explorerUrl?: string }`, `receivedAmount?: string` (in destination asset's smallest unit), `error?: string`, `statusMessage?: string`, `adapterName: string`. May include adapter-specific data if populated by the adapter.
    *   *Defined in: `packages/crosschain/src/types/interfaces/index.ts`*

*   **`CrossChainOperationStatus`**:
    *   Output object from `getOperationStatus`.
    *   *Key Properties*: `operationId: string`, `status: string`, `sourceTx?: object`, `destinationTx?: object`, `steps?: any[]`.
    *   *Defined in: `packages/crosschain/src/types/interface.ts`*

---
