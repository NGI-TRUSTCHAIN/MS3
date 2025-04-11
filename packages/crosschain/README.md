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
import { createCrossChain } from '@m3s/crosschain';
import { ethers } from 'ethers';

// Create a wallet or connect to an existing one
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Create a cross-chain instance
const crosschain = createCrossChain();

// Initialize with your wallet
await crosschain.initialize({
  provider: wallet
});

// Get a quote for a cross-chain transfer
const quote = await crosschain.getQuote({
  fromChain: 137, // Polygon
  toChain: 1, // Ethereum
  fromToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
  fromAmount: '10000000', // 10 USDC (with 6 decimals)
  fromAddress: await wallet.getAddress()
});

// Execute the cross-chain transfer
const result = await crosschain.executeTransfer(quote);
console.log(`Transfer initiated! Transaction hash: ${result.transactionHash}`);
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

Quotes provide information about potential transfers without executing them:

```javascript
// Get a quote to see fees, routes, and estimated time
const quote = await crosschain.getQuote({
  fromChain: 137, // Polygon
  toChain: 56, // BNB Chain
  fromToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
  toToken: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BNB Chain
  fromAmount: '5000000', // 5 USDC (with 6 decimals)
  fromAddress: await wallet.getAddress()
});

console.log(`Estimated gas cost: ${quote.estimate.gasCosts.usd} USD`);
console.log(`Execution time: ~${quote.estimate.executionDuration} seconds`);
console.log(`Bridge used: ${quote.tool}`);
console.log(`Output amount: ${quote.toAmount} (${quote.toAmountMin} minimum)`);
```

## Quote Options

You can customize quotes with additional options:

```javascript
const quote = await crosschain.getQuote({
  fromChain: 137,
  toChain: 1,
  fromToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  toToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  fromAmount: '10000000',
  fromAddress: userAddress,
  options: {
    slippage: 0.5, // 0.5% slippage tolerance
    bridges: {
      include: ['stargate', 'across'], // Only use these bridges
      exclude: [] // Don't exclude any bridges
    },
    exchanges: {
      include: ['1inch'], // Only use 1inch for token swaps
      exclude: []
    }
  }
});
```

## Executing Transfers

```javascript
try {
  // Execute the cross-chain transfer using the quote
  const result = await crosschain.executeTransfer(quote);
  
  console.log(`Transfer started!`);
  console.log(`Transaction hash: ${result.transactionHash}`);
  console.log(`Status: ${result.status}`);
  
  // Save the transaction hash to check status later
  localStorage.setItem('lastTransferTx', result.transactionHash);
} catch (error) {
  console.error('Transfer failed:', error.message);
}
```

## Tracking Transfer Status

```javascript
// Get the transaction hash of a previous transfer
const txHash = localStorage.getItem('lastTransferTx');

if (txHash) {
  // Check the current status
  const status = await crosschain.getTransferStatus(txHash);
  
  console.log(`Overall status: ${status.status}`);
  
  // Detailed step information
  status.steps.forEach((step, index) => {
    console.log(`Step ${index + 1}: ${step.type} - ${step.status}`);
    
    if (step.status === 'DONE') {
      console.log(`  Completed at: ${new Date(step.timestamp).toLocaleString()}`);
    } else if (step.status === 'PENDING') {
      console.log(`  Waiting for confirmation...`);
    }
  });
}
```

## Integration with @m3s/wallet

```javascript
import { createWallet } from '@m3s/wallet';
import { createCrossChain } from '@m3s/crosschain';

// Create and initialize a wallet
const wallet = await createWallet({
  adapterName: 'web3auth',
  options: { web3authConfig }
});

await wallet.requestAccounts();

// Create and initialize crosschain with the wallet
const crosschain = createCrossChain();
await crosschain.initialize({ provider: wallet });

// Now you can use crosschain operations with the connected wallet
const supportedChains = await crosschain.getSupportedChains();
console.log(`You can transfer tokens between ${supportedChains.length} chains`);
```

## API Reference

### Main Functions

| Method                  | Description                                                |
|-------------------------|------------------------------------------------------------|
| createCrossChain()      | Create a new crosschain instance                           |
| initialize(options)     | Set up with a wallet provider                              |
| getSupportedChains()    | Get list of all supported blockchains                      |
| getSupportedTokens(chainId)| Get list of supported tokens on a chain                  |
| getQuote(params)        | Get a quote for a cross-chain transfer                     |
| executeTransfer(quote)  | Execute a transfer based on a quote                        |
| getTransferStatus(txHash)| Check status of an ongoing transfer                       |
| resumeTransfer(txHash)  | Resume a paused or failed transfer                         |
| cancelTransfer(txHash)  | Attempt to cancel an ongoing transfer                      |

### Transfer Parameters

| Parameter   | Description                                             |
|-------------|---------------------------------------------------------|
| fromChain   | Source chain ID (e.g., 1 for Ethereum)                  |
| toChain     | Destination chain ID (e.g., 137 for Polygon)            |
| fromToken   | Token address on source chain                           |
| toToken     | Token address on destination chain                      |
| fromAmount  | Amount to transfer (in token's smallest unit)           |
| fromAddress | Sender address                                          |
| toAddress   | Recipient address (defaults to fromAddress)             |
