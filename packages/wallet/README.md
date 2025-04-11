# @m3s/wallet

A flexible wallet interface supporting multiple blockchain wallet types, including EVM wallets and Web3Auth integration.

> ⚠️ **DEVELOPMENT STATUS**: This package is currently in active development and is not yet ready for production use. The API is subject to breaking changes without notice. Use at your own risk.

## Development Status

This package is currently in **alpha** stage:

- 🚧 Core functionality is being implemented and undergoing testing and refinement
- ⚠️ APIs may change without warning between versions
- 🧪 Some features may not work as expected
- 📝 Documentation might be incomplete or outdated until the beta version

### Versioning During Development

While in development:
- We're using `1.x.y` version numbers during initial development  
- Production-ready releases will be clearly marked  
- Check the GitHub repository for the latest updates and roadmap

### Providing Feedback

We welcome feedback and contributions! Please open issues on our GitHub repository if you encounter bugs or have suggestions for improvements.

---

## Installation

```bash
npm install @m3s/wallet
```

---

## Features

- **Universal wallet API** for a consistent interface across different wallet types  
- **EVM Wallets** support using private keys  
- **Web3Auth Integration** for OAuth-based blockchain access  
- **Transaction Signing, Gas Estimation, & Network Management**  
- **Centralized Network Configuration**  
- **Event Handling** for account and chain changes  
- **Standardized Error Handling**  
- **Network Switching** across EVM chains  
- **Multi-Account Support**

---

## Wallet Types

### EVM Wallet

A standard Ethereum wallet using either a provided private key or one generated randomly.

#### Example

```javascript
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';

// Create a provider
const provider = new JsonRpcProvider('https://ethereum-sepolia.publicnode.com');

// Initialize wallet with the new parameters structure
const params: IWalletOptions = {
  adapterName: 'ethers',
  provider,
  options: {
    privateKey: '0x...' // Your private key for testing
  }
};

// Create the wallet
const wallet = await createWallet<IEVMWallet>(params);

// Get accounts
const accounts = await wallet.getAccounts();
console.log('Connected account:', accounts[0]);

// Get network info
const network = await wallet.getNetwork();
console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

// Sign a message
const signature = await wallet.signMessage('Hello World');
console.log('Signature:', signature);
```

### Web3Auth Wallet

A social login wallet using OAuth providers.

#### Example

```javascript
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';

// Configure Web3Auth with the correct format
const web3authConfig = {
  clientId: "YOUR_CLIENT_ID",
  web3AuthNetwork: "sapphire_devnet",
  chainConfig: {
    chainNamespace: "eip155",
    chainId: "0xaa36a7", // Sepolia
    rpcTarget: "https://sepolia.infura.io/v3/YOUR_INFURA_ID", 
    displayName: "Sepolia Testnet",
    blockExplorer: "https://sepolia.etherscan.io/",
    ticker: "ETH",
    tickerName: "Ethereum"
  },
  loginConfig: {
    loginProvider: "google"
  }
};

// Create the wallet with the standard structure
const params: IWalletOptions = {
  adapterName: 'web3auth',
  options: { web3authConfig }
};

// Create and initialize the wallet
const wallet = await createWallet<IEVMWallet>(params);

// This will trigger the Web3Auth login popup
const accounts = await wallet.requestAccounts();
console.log('Connected account:', accounts[0]);

// Sign a message
const signature = await wallet.signMessage('Hello from Web3Auth');
console.log('Signature:', signature);

// Disconnect
await wallet.disconnect();
```

---

## Common Wallet Operations

### Sending Tokens

```javascript
// Send 0.01 ETH to another address
const tx = {
  to: '0xRecipientAddress',
  value: '0.01', // ETH amount
};

const txHash = await wallet.sendTransaction(tx);
console.log(`Transaction sent: ${txHash}`);

// Get a transaction receipt
const receipt = await wallet.getTransactionReceipt(txHash);
console.log(`Transaction status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
```

### Working with ERC-20 Tokens

```javascript
// Get token balance
const tokenAddress = '0xTokenContractAddress';
const balance = await wallet.getTokenBalance(tokenAddress);
console.log(`Token balance: ${balance}`);

// Send tokens (requires proper contract ABI and data)
const data = '0x...'; // Contract call data for transfer
const tokenTx = {
  to: tokenAddress,
  data,
  value: '0', // No ETH is being sent
};

await wallet.sendTransaction(tokenTx);
```

### Network Switching

```javascript
// Switch to Polygon network with Web3Auth
await wallet.setProvider({
  chainConfig: {
    chainNamespace: "eip155",
    chainId: "0x89", // Polygon
    rpcTarget: "https://polygon-rpc.com",
    displayName: "Polygon",
    blockExplorer: "https://polygonscan.com/",
    ticker: "MATIC",
    tickerName: "Polygon"
  }
});

// Switch networks with ethers wallet
import { JsonRpcProvider } from 'ethers';
const polygonProvider = new JsonRpcProvider("https://polygon-rpc.com");
await wallet.setProvider(polygonProvider);

// Get current network after switching
const network = await wallet.getNetwork();
console.log(`Current network: ${network.name} (Chain ID: ${network.chainId})`);
```

---

## GitHub Copilot - README Improvements

### Improved Wallet README (Example .txt Format)

#### Features

- Universal wallet API for a consistent interface across different wallet types  
- Support for EVM-based wallets with private key  
- Web3Auth integration for OAuth-based blockchain access  
- Transaction signing, gas estimation, and network management  
- Centralized network configuration  
- Event handling for account and chain changes  
- Error handling and standardized error types  
- Network switching capabilities across EVM chains  
- Multi-account support  

#### Wallet Types

**EVM Wallet**  
Standard Ethereum wallet using a private key or generated randomly.

**Web3Auth Wallet**  
Social login wallet using OAuth providers.

#### Common Wallet Operations

- **Sending Tokens**  
- **Working with ERC-20 Tokens**  
- **Network Switching**  
- **Error Handling**

#### Error Handling Example

```javascript
import { WalletErrorCode } from '@m3s/wallet';

try {
  await wallet.sendTransaction(tx);
} catch (error) {
  if (error.code === WalletErrorCode.UserRejected) {
    console.log('User rejected the transaction');
  } else if (error.code === WalletErrorCode.InsufficientFunds) {
    console.log('Not enough funds to complete the transaction');
  } else if (error.code === WalletErrorCode.NetworkError) {
    console.log('Network connection issue, please try again');
  } else {
    console.error('Unknown error:', error);
  }
}
```

#### API Reference

**Common Methods (All Wallet Types)**

| Method                 | Description                                    |
|------------------------|------------------------------------------------|
| `initialize()`         | Prepare the wallet for use                     |
| `isInitialized()`      | Check if wallet is properly initialized        |
| `getWalletName()`      | Get wallet adapter name                        |
| `getWalletVersion()`   | Get wallet version                             |
| `isConnected()`        | Check if wallet is connected                   |
| `requestAccounts()`    | Request user accounts (may trigger login UI)   |
| `getAccounts()`        | Get current accounts                           |
| `getNetwork()`         | Get current network information              |
| `setProvider(provider)`| Change the provider or network                 |
| `sendTransaction(tx)`  | Send a transaction                             |
| `signTransaction(tx)`  | Sign a transaction without sending             |
| `signMessage(message)` | Sign a message                                 |
| `disconnect()`         | Disconnect the wallet                          |
| `on(event, callback)`  | Listen for wallet events                       |
| `off(event, callback)` | Remove an event listener                       |

**EVM-Specific Methods**

| Method                                  | Description                              |
|-----------------------------------------|------------------------------------------|
| `signTypedData(data)`                   | Sign typed data (EIP-712)                |
| `getGasPrice()`                         | Get current gas price                    |
| `estimateGas(tx)`                       | Estimate gas for transaction             |
| `getTokenBalance(tokenAddress)`         | Get ERC-20 token balance                 |
| `getTransactionReceipt(txHash)`         | Get receipt for a transaction            |
| `getBalance(address)`                   | Get native token balance for an address  |
| `getPrivateKey()`                       | Get wallet's private key                 |
| `verifySignature(message, signature, address)` | Verify a message signature         |

#### Transaction Format

```javascript
const tx = {
  to: '0x0000000000000000000000000000000000000000',
  value: '0.001',  // In ETH for EVM chains
  data: '0x',      // Optional contract data
  gasLimit: '21000', // Optional gas limit
  gasPrice: '5000000000' // Optional gas price in wei
};
```

#### Typed Data Format (EIP-712)

```javascript
const typedData = {
  domain: {
    name: 'My App',
    version: '1',
    chainId: 11155111, // Sepolia
    verifyingContract: '0x0000000000000000000000000000000000000000'
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' }
    ]
  },
  value: {
    name: 'John Doe',
    wallet: '0x0000000000000000000000000000000000000000'
  }
};
```

#### Event Handling

```javascript
// Listen for account changes
wallet.on(WalletEvent.accountsChanged, (accounts) => {
  console.log('Accounts changed:', accounts);
});

// Listen for chain changes
wallet.on(WalletEvent.chainChanged, (chainId) => {
  console.log('Chain changed:', chainId);
});

// Remove event listener
wallet.off(WalletEvent.accountsChanged, listenerFunction);
```

#### Network Configuration

- **Web3Auth Adapter** expects network configuration in the following format:

  ```javascript
  await wallet.setProvider({
    chainConfig: {
      chainNamespace: "eip155",
      chainId: "0x4268", // Holesky chain ID in hex
      rpcTarget: "https://ethereum-holesky.publicnode.com",
      displayName: "Holesky Testnet",
      blockExplorer: "https://holesky.etherscan.io/",
      ticker: "ETH",
      tickerName: "Ethereum"
    }
  });
  ```

- **EVM Wallet Adapter** accepts a standard ethers.js provider:

  ```javascript
  import { JsonRpcProvider } from 'ethers';
  const provider = new JsonRpcProvider("https://ethereum-holesky.publicnode.com");
  await wallet.setProvider(provider);
  ```

#### Supported Networks

The wallet supports all EVM-compatible networks, including but not limited to:

- Ethereum (Mainnet, Sepolia, Holesky)
- Polygon (Mainnet, Mumbai)
- Arbitrum
- Optimism
- BNB Chain
- Avalanche
- Base

Custom networks can be configured through the appropriate provider settings.
