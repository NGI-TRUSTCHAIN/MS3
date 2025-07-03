# @m3s/smart-contract

Generate, compile, deploy, and interact with smart contracts. Built-in support for ERC20, ERC721, and ERC1155 with OpenZeppelin templates.

> ⚠️ **Alpha Release**: APIs may change. Not production-ready.

## Installation

```bash
npm install @m3s/smart-contract
```

## Quick Start

```javascript
import { createContractHandler } from '@m3s/smart-contract';
import { createWallet } from '@m3s/wallet';

// Setup wallet (required for deployment)
const wallet = await createWallet({
  name: 'ethers',
  options: { privateKey: 'YOUR_PRIVATE_KEY' }
});

await wallet.setProvider({
  chainId: '0xaa36a7', // Sepolia
  rpcUrls: ['https://sepolia.infura.io/v3/YOUR_KEY']
});

// Create contract handler
const contractHandler = await createContractHandler({
  name: 'openZeppelin',
  version: '1.0.0'
});

// Generate ERC20 token
const sourceCode = await contractHandler.generateContract({
  language: 'solidity',
  template: 'openzeppelin_erc20',
  options: {
    name: 'MyToken',
    symbol: 'MTK',
    premint: '1000000',
    mintable: true,
    access: 'ownable'
  }
});

// Compile
const compiled = await contractHandler.compile({
  sourceCode,
  language: 'solidity'
});

// Deploy
const deployed = await contractHandler.deploy({
  compiledContract: compiled,
  constructorArgs: [walletAddress, walletAddress],
  wallet
});

console.log(`Token deployed at: ${deployed.contractId}`);
```

## Features

- **Contract Generation** - ERC20, ERC721, ERC1155 with customizable features
- **Compilation** - Built-in Solidity compiler integration  
- **Deployment** - Deploy to any EVM network
- **Interaction** - Call contract methods easily
- **OpenZeppelin** - Battle-tested contract templates

## Supported Standards

| Standard | Features | Status |
|----------|----------|---------|
| **ERC20** | Mintable, Burnable, Pausable, Permit, Votes | ✅ Ready |
| **ERC721** | Mintable, Burnable, Enumerable, URI Storage | ✅ Ready |
| **ERC1155** | Mintable, Burnable, Supply Tracking, Pausable | ✅ Ready |

## Contract Features

### ERC20 Tokens
```javascript
// Basic token with common features
{
  name: 'MyToken',
  symbol: 'MTK',
  premint: '1000000',    // Initial supply
  mintable: true,        // Allow minting new tokens
  burnable: true,        // Allow burning tokens
  pausable: true,        // Allow pausing transfers
  permit: true,          // ERC2612 gasless approvals
  access: 'ownable'      // Access control
}
```

### ERC721 NFTs
```javascript
// NFT collection with metadata
{
  name: 'MyNFTs',
  symbol: 'MNFT',
  baseUri: 'ipfs://QmHash/',
  mintable: true,
  burnable: true,
  enumerable: true,      // Token enumeration
  uriStorage: true,      // Individual token URIs
  incremental: true      // Auto-incrementing IDs
}
```

## Community Adapters

Extend contract support with community adapters:
- 📖 [**Full Documentation**](https://docs.m3s.dev/smart-contract) - Complete API reference
- 🧪 [**Live Demo**](https://demo.m3s.dev) - Deploy contracts in browser
- 🔧 [**Adapter Templates**](https://github.com/m3s-org/community-adapters) - Create custom contract adapters

## License

MIT