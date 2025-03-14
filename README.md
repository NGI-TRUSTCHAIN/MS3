# M3S - Multi-Chain Smart Contract Toolkit

M3S is a modular toolkit for working with Ethereum-compatible blockchains, offering wallet integrations, cross-chain functionality, and smart contract management.

## Packages

This monorepo contains the following packages:

- **@m3s/wallet**: Wallet connection and management
- **@m3s/crosschain**: Cross-chain transaction functionality
- **@m3s/smart-contract**: Smart contract deployment and interaction
- **@m3s/utils**: Internal utilities (not published separately)

## Getting Started

### Prerequisites

- Node.js v16+
- npm v7+

### Installation

#### For Development

```bash
# Clone the repository
git clone https://github.com/your-username/m3s.git
cd m3s

# Install dependencies
npm install
```

#### For Usage

You can install individual packages as needed:

```bash
# Install the wallet package
npm install @m3s/wallet

# Install the crosschain package
npm install @m3s/crosschain

# Install the smart contract package
npm install @m3s/smart-contract
```

## Testing

### Unit Tests

Unit tests use Mocha and Chai to test individual modules without external dependencies.

```bash
# Run all unit tests
npm test

# Run tests for a specific module
npm run test:wallet
npm run test:crosschain
npm run test:smartContract
```

### Integration Tests

Integration tests use Playwright to test module functionality in a browser environment.

#### Setup for Integration Tests

```bash
# Install Playwright browsers (one-time setup)
npx playwright install chromium

# Build integration test bundles
npm run build:integration
```

#### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration tests
npm run test:web3auth    # Requires manual OAuth interaction
npm run test:evmwallet   # Fully automated test

# Run with browser visible (for debugging)
npm run test:integration:debug
```

#### Web3Auth Integration Test

The Web3Auth test opens a browser window and requires you to manually complete the Google OAuth flow when the popup appears. The test will wait for you to complete this flow before continuing.

#### EVMWallet Integration Test

The EVMWallet test is fully automated and doesn't require manual interaction.

#### Running All Tests Together

```bash
# Run all tests (unit + integration)
npm run test:all

# Build all packages and run all tests
npm run build:test
```

## Building and Publishing

### Building Packages

```bash
# Build all packages
npm run build

# Build individual packages
npm run build:utils
npm run build:wallet
npm run build:crosschain
npm run build:smartContract
```

### Publishing Packages

```bash
# Publish all packages
npm run publish:all

# Publish individual packages
npm run publish:wallet
npm run publish:crosschain
npm run publish:smartContract

# Full build and publish cycle
npm run release
```

The publishing process will:
1. Build the package
2. Increment the patch version
3. Update dependent package references
4. Update version matrix
5. Commit changes
6. Publish to npm with public access

## Usage

### Wallet Integration

The wallet module supports multiple wallet types, including standard EVM wallets and Web3Auth.

#### EVM Wallet Example

```typescript
import { Wallet } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';

// Create a provider
const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

// Initialize wallet with private key (for development/testing only)
const privateKey = '0x...'; // Your private key
const wallet = createWallet('evmWallet', undefined, provider, privateKey);
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

// Sign a transaction
const tx = {
  to: '0x0000000000000000000000000000000000000000',
  value: '0.001',
  data: '0x'
};
const signedTx = await wallet.signTransaction(tx);

// Estimate gas
const gasEstimate = await wallet.estimateGas(tx);

// Get gas price
const gasPrice = await wallet.getGasPrice();

// Sign typed data (EIP-712)
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
const typedDataSignature = await wallet.signTypedData(typedData);
```

#### Web3Auth Example

```typescript
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
const wallet = createWallet("web3auth", undefined, null, { web3authConfig });
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

## License

MIT