# @m3s/wallet

A flexible wallet interface supporting multiple blockchain wallet types, including EVM wallets and Web3Auth integration.

## Installation

```bash
npm install @m3s/wallet
```

## Features

* Universal wallet API for consistent interface across different wallet types
* Support for EVM-based wallets with private key
* Web3Auth integration for OAuth-based blockchain access
* Transaction signing, gas estimation, and network management

## Wallet Types

### EVM Wallet
Standard Ethereum wallet using a private key or generated randomly.

```bash
import { Wallet } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';

// Create a provider
const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

// Initialize wallet with private key (for development/testing only)
const privateKey = '0x...'; // Your private key
const wallet = new Wallet('evmWallet', undefined, provider, privateKey);
await wallet.initialize();

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
Social login wallet using OAuth providers.

```bash
import { Wallet } from '@m3s/wallet';

// Configure Web3Auth
const web3authConfig = {
  clientId: "YOUR_CLIENT_ID",
  web3AuthNetwork: "sapphire_devnet", 
  chainConfig: {
    chainNamespace: "eip155",
    chainId: "0xaa36a7", // Sepolia
    rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
    displayName: "Sepolia Testnet",
    blockExplorer: "https://sepolia.etherscan.io/",
    ticker: "ETH",
    tickerName: "Ethereum"
  },
  loginConfig: {
    loginProvider: "google"
  }
};

// Create the wallet with Web3Auth config
const wallet = new Wallet("web3auth", undefined, null, { web3authConfig });
await wallet.initialize();

// This will trigger the Web3Auth login popup
const accounts = await wallet.requestAccounts();
console.log('Connected account:', accounts[0]);

// Sign a message
const signature = await wallet.signMessage('Hello from Web3Auth');
console.log('Signature:', signature);

// Disconnect
await wallet.disconnect();
```

## API Reference

### Common Methods (All Wallet Types)

| Method   | Description |
| -------- | ------- |
| initialize() |Prepare the wallet for use |
| getWalletName() |Get wallet adapter name |
| getWalletVersion() |Get wallet version |
| isConnected() | Check if wallet is connected |
| requestAccounts() | Request user accounts (may trigger login UI) |
| getAccounts() | Get current accounts |
| getNetwork() | Get current network information |
| switchNetwork(chainId) | Switch to a different network |
| sendTransaction(tx) | Send a transaction |
| signTransaction(tx) | Sign a transaction without sending |
| signMessage(message) | Sign a message|


### EVM-Specific Methods

| Method   | Description |
| -------- | ------- |
| signTypedData(data) | Sign typed data (EIP-712) |
| getGasPrice() | Get current gas price |
| estimateGas(tx) | Estimate gas for transaction |


### Web3Auth-Specific Methods

| Method   | Description |
| -------- | ------- |
| disconnect() | Disconnect from Web3Auth |


## Transaction Format
Transactions use a simplified format:

```bash
const tx = {
  to: '0x0000000000000000000000000000000000000000',
  value: '0.001',  // In ETH for EVM chains
  data: '0x'       // Optional contract data
};
```

### Typed Data Format (EIP-712)

```bash
const typedData = {
  domain: {
    name: 'My App',
    version: '1',
    chainId: 11155111,
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

### Event Handling

```bash
// Listen for account changes
wallet.on('accountsChanged', (accounts) => {
  console.log('Accounts changed:', accounts);
});

// Listen for chain changes
wallet.on('chainChanged', (chainId) => {
  console.log('Chain changed:', chainId);
});

// Remove event listener
wallet.off('accountsChanged', listenerFunction);
```