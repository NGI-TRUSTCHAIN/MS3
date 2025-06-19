# @m3s/wallet

Universal wallet interface supporting multiple blockchain wallet types with consistent API across EVM wallets and Web3Auth integration.

> ⚠️ **Alpha Release**: APIs may change. Not production-ready.

## Installation

```bash
npm install @m3s/wallet
```

## Quick Start

```javascript
import { createWallet } from '@m3s/wallet';

// EVM Wallet (Private Key)
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  options: { 
    privateKey: 'YOUR_PRIVATE_KEY' 
  }
});

// Set network
await wallet.setProvider({
  chainId: '0xaa36a7', // Sepolia
  rpcUrls: ['https://sepolia.infura.io/v3/YOUR_KEY']
});

// Use wallet
const accounts = await wallet.getAccounts();
const balance = await wallet.getBalance();
const txHash = await wallet.sendTransaction({
  to: '0x...',
  value: '0.01'
});
```

## Features

- **Universal API** - Same interface for all wallet types
- **EVM Support** - Private key wallets with ethers.js
- **Web3Auth** - Social login with OAuth providers  
- **Network Management** - Easy network switching
- **Transaction Signing** - Messages, transactions, typed data
- **Event Handling** - Account/chain change notifications

## Supported Wallets

| Adapter | Description | Status |
|---------|-------------|---------|
| `ethers` | Private key wallets | ✅ Ready |
| `web3auth` | Social login wallets | ✅ Ready |

## Examples

### Web3Auth Social Login
```javascript
const wallet = await createWallet({
  name: 'web3auth',
  version: '1.0.0',
  options: {
    web3authConfig: {
      clientId: 'YOUR_CLIENT_ID',
      web3AuthNetwork: 'sapphire_devnet',
      chainConfig: {
        chainId: '0xaa36a7',
        rpcTarget: 'https://sepolia.infura.io/v3/YOUR_KEY'
      }
    }
  }
});
```

### ERC20 Token Transfer
```javascript
const transferData = erc20Interface.encodeFunctionData('transfer', [
  recipientAddress, 
  ethers.parseUnits('100', 18)
]);

const txHash = await wallet.sendTransaction({
  to: tokenAddress,
  data: transferData
});
```

## Community Adapters

Want to add support for more wallets? Check out our:
- 📖 [**Full Documentation**](https://docs.m3s.dev/wallet) - Complete API reference  
- 🧪 [**Live Demo**](https://demo.m3s.dev) - Try all features
- 🔧 [**Adapter Templates**](https://github.com/m3s-org/community-adapters) - Create new wallet adapters

## License

MIT