# @m3s/crosschain

Cross-chain token transfers and swaps across 20+ blockchains. Built on LI.FI with simple, standardized API.

> ⚠️ **Alpha Release**: APIs may change. Not production-ready.

## Installation

```bash
npm install @m3s/crosschain
```

## Quick Start

```javascript
import { createCrossChain } from '@m3s/crosschain';
import { createWallet } from '@m3s/wallet';

// Setup wallet
const wallet = await createWallet({
  name: 'ethers',
  options: { privateKey: 'YOUR_PRIVATE_KEY' }
});

// Create crosschain adapter
const crosschain = await createCrossChain({
  name: 'lifi',
  version: '1.0.0',
  options: {
    apiKey: process.env.LIFI_API_KEY // Optional for quotes
  }
});

// Get quotes for cross-chain transfer
const quotes = await crosschain.getOperationQuote({
  sourceAsset: {
    chainId: 137,      // Polygon
    address: '0x...', // USDC
    symbol: 'USDC',
    decimals: 6
  },
  destinationAsset: {
    chainId: 10,       // Optimism  
    address: '0x...', // USDC
    symbol: 'USDC',
    decimals: 6
  },
  amount: '100000000', // 100 USDC
  userAddress: await wallet.getAccounts()[0],
  slippageBps: 50      // 0.5%
});

// Execute best quote
const result = await crosschain.executeOperation(quotes[0]);
console.log(`Transfer started: ${result.operationId}`);

// Track status
const status = await crosschain.getOperationStatus(result.operationId);
console.log(`Status: ${status.status}`);
```

## Features

- **20+ Chains** - All major EVM networks supported
- **Route Optimization** - Find best paths automatically  
- **Gas Estimation** - Accurate cost estimates
- **Status Tracking** - Real-time operation monitoring
- **LI.FI Integration** - Access to 15+ bridge protocols

## Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum | 1 | ETH |
| Polygon | 137 | MATIC |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |
| Base | 8453 | ETH |
| BNB Chain | 56 | BNB |
| Avalanche | 43114 | AVAX |

## Examples

### Token Swap + Bridge
```javascript
// MATIC on Polygon → WETH on Arbitrum
const quotes = await crosschain.getOperationQuote({
  sourceAsset: { chainId: 137, address: '0x...', symbol: 'MATIC' },
  destinationAsset: { chainId: 42161, address: '0x...', symbol: 'WETH' },
  amount: ethers.parseEther('100').toString(),
  userAddress: userAddress
});
```

### Advanced Options
```javascript
// Custom slippage and bridge preferences  
const quotes = await crosschain.getOperationQuote({
  // ... assets ...
  options: {
    slippage: 0.005,           // 0.5%
    allowBridges: ['stargate', 'across'],
    denyExchanges: ['paraswap']
  }
});
```

### Status Monitoring
```javascript
// Poll for updates
const checkStatus = async (operationId) => {
  const status = await crosschain.getOperationStatus(operationId);
  
  console.log(`Status: ${status.status}`);
  if (status.sourceTx?.hash) {
    console.log(`Source TX: ${status.sourceTx.hash}`);
  }
  if (status.destinationTx?.hash) {
    console.log(`Destination TX: ${status.destinationTx.hash}`);
  }
};
```

## Community Adapters

Extend to more bridges and protocols:
- 📖 [**Full Documentation**](https://docs.m3s.dev/crosschain) - Complete API reference
- 🧪 [**Live Demo**](https://demo.m3s.dev) - Try cross-chain transfers  
- 🔧 [**Adapter Templates**](https://github.com/m3s-org/community-adapters) - Create bridge adapters

## License

MIT