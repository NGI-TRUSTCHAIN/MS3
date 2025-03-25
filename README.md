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

# Install test dependencies (required for integration testing)
cd tests
npm install
cd ..
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
# Build all packages
npm run build

# Build integration test bundles
npm run build:integration

# Run the manual test server
npm test
```

This will start a local server at http://localhost:8080 with links to test different wallet adapters:

- EVM Wallet Test: http://localhost:8080/evmwallet.html
- Web3Auth Test: http://localhost:8080/web3auth.html


#### Web3Auth Integration Test

The Web3Auth test requires you to manually complete the Google OAuth flow when the popup appears.

#### Network Configuration
Tests use centralized network configurations from packages/wallet/src/config.ts:

```typescript
export const NETWORK_CONFIGS = {
    "holesky": {
        chainConfig: {
            chainNamespace: "eip155",
            chainId: "0x4268",
            rpcTarget: "https://ethereum-holesky.publicnode.com",
            displayName: "Holesky Testnet",
            blockExplorer: "https://holesky.etherscan.io/",
            ticker: "ETH",
            tickerName: "Ethereum"
        }
    },
    "sepolia": {
        chainConfig: {
            chainNamespace: "eip155",
            chainId: "0xaa36a7",
            rpcTarget: "https://sepolia.infura.io/v3/YOUR_INFURA_ID",
            displayName: "Sepolia Testnet",
            blockExplorer: "https://sepolia.etherscan.io/",
            ticker: "ETH",
            tickerName: "Ethereum"
        }
    }
};
```

#### Building and Publishing

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

During the build process, utils are automatically bundled into the wallet package to avoid external dependencies on private packages.

#### Publishing Packages

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

#### Usage

The IEVMWallet test is fully automated and doesn't require manual interaction.

#### Running All Tests Together

## Wallet Integration
The wallet module supports multiple wallet types, including standard EVM wallets and Web3Auth.

## EVM Wallet Example

```typescript
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
    chainId: parseInt(network.chainId), // Use current network's chainId
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
import { createWallet, IEVMWallet, IWalletOptions, WalletEvent } from '@m3s/wallet';

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

// Listen for chain changes
wallet.on(WalletEvent.chainChanged, (chainId) => {
  console.log('Chain changed to:', chainId);
});

// Sign a message
const signature = await wallet.signMessage('Hello from Web3Auth');
console.log('Signature:', signature);

// Switch networks using the proper format
await wallet.setProvider({
  chainConfig: {
    chainNamespace: "eip155",
    chainId: "0x4268", // Holesky
    rpcTarget: "https://ethereum-holesky.publicnode.com",
    displayName: "Holesky Testnet",
    blockExplorer: "https://holesky.etherscan.io/",
    ticker: "ETH",
    tickerName: "Ethereum"
  }
});

// Disconnect
await wallet.disconnect();
```

### License
MIT