# @m3s/wallet

A flexible wallet interface supporting multiple blockchain wallet types, including EVM wallets and Web3Auth integration.

> ⚠️ **DEVELOPMENT STATUS**: This package is currently in active development and is not yet ready for production use. The API is subject to breaking changes without notice. Use at your own risk.

## Development Status

This package is currently in **alpha** stage:
- 🚧 Core functionality is being implemented and undergoing testing and refinement.
- ⚠️ APIs may change without warning between versions.
- 🧪 Some features may not work as expected.
- 📝 Documentation might be incomplete or outdated until the beta version.

### Versioning & Feedback
- We’re using `1.x.y` version numbers during initial development. Production-ready releases will be clearly marked.
- Check the GitHub repository for the latest updates and roadmap.
- We welcome feedback and contributions! Please open issues on our GitHub repository if you encounter bugs or have suggestions.

---

## Installation

```bash
npm install @m3s/wallet
```

---

## Features

- **Universal wallet API** for a consistent interface across different wallet types.
- **Support for EVM Wallets** using private keys.
- **Web3Auth Integration** for OAuth-based blockchain access.
- **Transaction Signing, Gas Estimation, & Network Management**.
- **Centralized Network Configuration**.
- **Event Handling** for account and chain changes.
- **Standardized Error Handling**.
- **Network Switching** across EVM chains.
- **Multi-Account Support**.

---

## Wallet Types

### EVM Wallet

A standard Ethereum wallet using either a provided private key or one generated randomly.

#### Example

```javascript
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';

// 1. Define the provider configuration
// Replace <YOUR_INFURA_KEY> with your actual Infura Project ID or use any other RPC provider.
const sepoliaNetworkConfig: NetworkConfig = {
  chainId: '0xaa36a7',
  name: 'Sepolia',
  displayName: 'Sepolia Testnet',
  rpcUrls: ['https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>'], // Replace with your RPC URL list in preferred order
  blockExplorer: 'https://sepolia.etherscan.io',
  ticker: 'ETH',
  tickerName: 'Sepolia ETH'
};

// 2. Prepare the options for creating the wallet
// Option A: Provide a private key (ensure it's a valid 0x-prefixed 64-char hex string)
const walletOptionsWithKey: IWalletOptions = {
  adapterName: 'ethers',
  options: { 
    privateKey: 'YOUR_VALID_PRIVATE_KEY_HERE' // Replace, or use PrivateKeyHelper.generatePrivateKey()
  }
};

// Option B: Omit the private key to have one generated internally (not retrievable)
const walletOptionsRandomKey: IWalletOptions = {
  adapterName: 'ethers',
  options: {} // No privateKey provided
};


async function setupEVMWallet() {
  // 3. Create the wallet instance
  // `createWallet` handles initial adapter setup.
  const wallet = await createWallet<IEVMWallet>(walletOptionsWithKey); // or walletOptionsRandomKey

  // 4. Set the provider to connect the wallet to the network
  await wallet.setProvider(sepoliaConfig);
  console.log(`Wallet connected to provider: ${wallet.isConnected()}`);

  // 5. Get accounts
  const accounts = await wallet.getAccounts();
  if (accounts.length > 0) {
    console.log('Connected account:', accounts[0]);

    // 6. Get balance
    const balance = await wallet.getBalance(accounts[0]); // Or await wallet.getBalance();
    console.log(`Balance: ${balance.formattedAmount} ${balance.symbol}`);

    // 7. Sign a message
    const signature = await wallet.signMessage('Hello from M3S Wallet!');
    console.log('Signature:', signature);
  } else {
    console.log('No accounts found.');
  }
  
  return wallet;
}

// setupEVMWallet().catch(console.error);
```

Note: You can also pass an already instantiated ethers.Provider to the `provider` field.

```javascript
import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';

// Create a provider
const provider = new JsonRpcProvider('https://ethereum-sepolia.publicnode.com');

// Initialize wallet with the new parameters structure
// If providing a privateKey, the top-level `provider` connects it.
// Alternatively, `options.providerConfig` can be used if `provider` isn't set at the top level.
const params: IWalletOptions = {
  adapterName: 'ethers',
  options: {
    privateKey: '0xYOUR_PRIVATE_KEY_HERE', // Replace with your private key for testing
    provider: provider // Pass the ethers.Provider instance here
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

// Create the wallet with the Web3Auth adapter
const params: IWalletOptions = {
  adapterName: 'web3auth',
  options: { web3authConfig }
};

// Create and initialize the wallet
const wallet = await createWallet<IEVMWallet>(params);

// Trigger the Web3Auth login popup
const accounts = await wallet.requestAccounts();
console.log('Connected account:', accounts[0]);

// Example: Switching to Polygon network AFTER initial connection
// Use NetworkConfig, the adapter will handle Web3Auth's specific needs.
const polygonNetworkConfig: NetworkConfig = {
  chainId: '0x89', // Polygon Mainnet
  name: 'Polygon',
  displayName: 'Polygon Mainnet',
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorer: 'https://polygonscan.com',
  ticker: 'MATIC',
  tickerName: 'Polygon MATIC'
};

try {
  await wallet.setProvider(polygonNetworkConfig);
  const network = await wallet.getNetwork();
  console.log(`Switched to network: ${network.name} (Chain ID: ${network.chainId})`);
} catch (error) {
  console.error('Failed to switch network for Web3Auth:', error);
}

// Sign a message
const signature = await wallet.signMessage('Hello from Web3Auth');
console.log('Signature:', signature);

// Disconnect
await wallet.disconnect();
```

**Note on Dependencies:** If you are using the `web3auth` adapter, ensure you have installed its peer dependencies:
```bash
npm install @web3auth/auth-adapter @web3auth/base @web3auth/ethereum-provider @web3auth/no-modal
```
Or, if using yarn:
```bash
yarn add @web3auth/auth-adapter @web3auth/base @web3auth/ethereum-provider @web3auth/no-modal
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

// Retrieve transaction receipt
const receipt = await wallet.getTransactionReceipt(txHash);
console.log(`Transaction status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
```

### Working with ERC-20 Tokens

```javascript
import { ethers } from 'ethers'; // ethers is commonly used for ABI encoding and formatting.

// Get token balance
const tokenAddress = '0xTokenContractAddress'; // Replace with actual token contract address
const accounts = await wallet.getAccounts();
if (accounts.length === 0) {
  throw new Error("No accounts available to fetch token balance.");
}
const accountAddress = accounts[0]; // Or specify a different account
const balance = await wallet.getTokenBalance(tokenAddress, accountAddress);
// Note: balance is usually returned as a string representing the smallest unit (e.g., wei for ETH-like tokens)
console.log(`Raw token balance: ${balance}`);
// You might want to format it using ethers or another utility:
// const formattedBalance = ethers.formatUnits(balance, 6); // Assuming 6 decimals for this token
// console.log(`Formatted token balance: ${formattedBalance}`);


// Send tokens
// For sending tokens, you need to construct the 'data' payload for the 'transfer' function call.
// Using ethers.Interface is a robust way to do this.
const recipientAddress = '0xRecipientAddress'; // Replace with actual recipient
const amountToTransfer = '100'; // Amount of tokens to send
const tokenDecimals = 6; // Decimals of the token (e.g., 6 for USDC, 18 for many others)

// Convert the human-readable amount to the token's smallest unit
const amountInSmallestUnit = ethers.parseUnits(amountToTransfer, tokenDecimals);

// Create an interface for the ERC20 transfer function
const erc20Interface = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)"
]);

// Encode the function data
const callData = erc20Interface.encodeFunctionData("transfer", [recipientAddress, amountInSmallestUnit]);

const tokenTx = {
  to: tokenAddress,      // The token contract address
  data: callData,        // The ABI-encoded function call
  value: '0',            // No native currency (ETH/MATIC etc.) is being sent, only tokens
  // gasLimit, gasPrice, etc., can be added if needed, otherwise wallet/provider defaults are used
};

try {
  const tokenTxHash = await wallet.sendTransaction(tokenTx);
  console.log(`ERC-20 Transfer sent: ${tokenTxHash}`);
  // You can then use wallet.getTransactionReceipt(tokenTxHash) to check its status.
} catch (error) {
  console.error("ERC-20 transfer failed:", error);
}
```

### Network Switching

Both `EvmWalletAdapter` and `Web3AuthWalletAdapter` use the `setProvider(config: NetworkConfig)` method to switch networks. You provide a `NetworkConfig` object.

```javascript
import { NetworkConfig } from '@m3s/wallet'; // Or from '@m3s/common'

// Example: Switching to Polygon Mainnet
const polygonNetwork: NetworkConfig = {
  chainId: '0x89', // 137 in decimal
  name: 'Polygon Mainnet',
  displayName: 'Polygon Mainnet',
  rpcUrls: ['https://polygon-rpc.com'], // Provide at least one RPC URL
  blockExplorer: 'https://polygonscan.com',
  ticker: 'MATIC',
  tickerName: 'Polygon MATIC'
};

try {
  await wallet.setProvider(polygonNetwork); // Works for both EVM and Web3Auth adapters
  const currentNetwork = await wallet.getNetwork();
  console.log(`Switched to: ${currentNetwork.displayName || currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`);
} catch (error) {
  console.error('Network switch failed:', error);
}
```
The `Web3AuthWalletAdapter` will internally use this `NetworkConfig` to attempt `switchChain` or `addChain` with the Web3Auth SDK.

---

## Error Handling Example

When interacting with wallet methods, it's important to handle potential errors. The `@m3s/wallet` package uses `AdapterError` from `@m3s/common`, which includes a `code` (often a `WalletErrorCode`) and a `cause`.

```javascript
import { AdapterError, WalletErrorCode } from '@m3s/wallet'; // WalletErrorCode re-exported

try {
  const accounts = await wallet.requestAccounts();
  // ... other operations
} catch (error) {
  if (error instanceof AdapterError) {
    console.error(`Adapter Error: ${error.message}`);
    console.error(`  Code: ${error.code}`); // e.g., WalletErrorCode.UserRejected
    if (error.cause) {
      console.error(`  Cause: ${error.cause}`);
    }
    if (error.details) {
      console.error(`  Details: ${JSON.stringify(error.details)}`);
    }

    switch (error.code) {
      case WalletErrorCode.UserRejected:
        console.log('User rejected the request.');
        break;
      case WalletErrorCode.WalletNotConnected:
        console.log('Wallet is not connected. Please connect first.');
        break;
      case WalletErrorCode.AdapterNotInitialized:
        console.log('Wallet adapter is not initialized.');
        break;
      case WalletErrorCode.InsufficientFunds:
        console.log('Not enough funds to complete the transaction.');
        break;
      case WalletErrorCode.NetworkError:
        console.log('A network error occurred. Please check your connection or RPC.');
        break;
      case WalletErrorCode.InvalidInput:
        console.log(`Invalid input provided: ${error.message}`);
        break;
      // Add more cases as needed from WalletErrorCode
      default:
        console.log('An unexpected adapter error occurred.');
    }
  } else {
    console.error('An unknown error occurred:', error);
  }
}
```

---

## API Reference

### Common Methods (All Wallet Types)

| Method                  | Arguments                                                                 | Returns                   | Description                                                                      |
|-------------------------|---------------------------------------------------------------------------|---------------------------|----------------------------------------------------------------------------------|
| `initialize()`          | `config?: IWalletAdapterConfig` (optional, adapter-specific. Usually handled by `createWallet`) | `Promise<void>`           | Prepare the wallet for use. Typically called by `createWallet`.                  |
| `isInitialized()`       | -                                                                         | `boolean`                 | Check if wallet is properly initialized.                                         |
| `getWalletName()`       | -                                                                         | `string`                  | Get wallet adapter name (e.g., 'ethers', 'web3auth').                            |
| `getWalletVersion()`    | -                                                                         | `string`                  | Get wallet version (adapter or underlying SDK).                                  |
| `isConnected()`         | -                                                                         | `boolean`                 | Check if wallet is connected to a provider/network.                              |
| `requestAccounts()`     | -                                                                         | `Promise<string[]>`       | Request user accounts (may trigger login UI or connect to provider).             |
| `getAccounts()`         | -                                                                         | `Promise<string[]>`       | Get current accounts. Returns empty array if unavailable.                        |
| `getNetwork()`          | -                                                                         | `Promise<NetworkConfig>` | Get current network information.                                                 |
| `setProvider(config)`   | `config: NetworkConfig `                                                  | `Promise<void>`           | Change the provider or network. See "Network Configuration" section for examples. |
| `sendTransaction(tx)`   | `tx: GenericTransactionData`                                              | `Promise<string>` (tx hash) | Send a transaction. See "Transaction Format" section.                            |
| `signTransaction(tx)`   | `tx: GenericTransactionData`                                              | `Promise<string>` (signed tx) | Sign a transaction without sending.                                              |
| `signMessage(message)`  | `message: string \| Uint8Array`                                           | `Promise<string>` (signature) | Sign a message.                                                                  |
| `disconnect()`          | -                                                                         | `void \| Promise<void>`   | Disconnect the wallet (logout, clear session).                                   |
| `on(event, callback)`   | `event: WalletEvent`, `callback: (...args: any[]) => void`                | `void`                    | Listen for wallet events (e.g., `accountsChanged`, `chainChanged`).              |
| `off(event, callback)`  | `event: WalletEvent`, `callback: (...args: any[]) => void`                | `void`                    | Remove an event listener.                                                        |
| `getBalance(account?)`  | `account?: string` (optional, defaults to the primary connected account if supported) | `Promise<AssetBalance>`   | Get native token balance for an account.                                         |

### EVM-Specific Methods

| Method                                      | Arguments                                                                  | Returns                   | Description                                                                      |
|---------------------------------------------|----------------------------------------------------------------------------|---------------------------|----------------------------------------------------------------------------------|
| `signTypedData(data)`                       | `data: EIP712TypedData`                                                    | `Promise<string>` (signature) | Sign EIP-712 typed data. See "Typed Data Format (EIP-712)" section.             |
| `getGasPrice()`                             | -                                                                          | `Promise<string>`         | Get current gas price (in wei).                                                  |
| `estimateGas(tx)`                           | `tx: GenericTransactionData`                                               | `Promise<EstimatedFeeData>` (gas units) | Estimate gas for a transaction.                                                  |
| `getTokenBalance(tokenAddress, account?)`   | `tokenAddress: string`, `account?: string` (optional, defaults to primary connected account) | `Promise<string>` (raw balance) | Get ERC-20 token balance for an account.                                         |
| `getTransactionReceipt(txHash)`             | `txHash: string`                                                           | `Promise<TransactionReceipt \| null>` | Get receipt for a transaction.                                                   |
| `verifySignature(message, signature, address)` | `message: string \| Uint8Array`, `signature: string`, `address: string`    | `Promise<boolean>`        | Verify a message signature.                                                      |

---

## Transaction Format

The `GenericTransactionData` object is used for `sendTransaction` and `estimateGas`. It allows for common transaction fields and adapter-specific options.

```typescript
// Definition (for clarity, actual import from @m3s/wallet/types)
interface GenericTransactionData {
  to?: string;                     // Recipient address (optional for contract deployment)
  value?: string;                  // Amount of native currency to send (e.g., "0.01" for ETH, should be in wei as string for actual use)
  data?: string;                   // Data for contract interaction (e.g., function call ABI encoded)
  options?: TransactionOptions;    // Optional: Adapter-specific or advanced options
}

interface TransactionOptions {
  gasLimit?: string;             // Optional: Maximum gas units for the transaction (e.g., "21000")
  gasPrice?: string;             // Optional: Gas price for legacy transactions (in wei)
  maxFeePerGas?: string;         // Optional: Max fee per gas for EIP-1559 transactions (in wei)
  maxPriorityFeePerGas?: string; // Optional: Max priority fee per gas for EIP-1559 transactions (in wei)
  nonce?: number;                // Optional: Transaction nonce
  chainId?: number;              // Optional: Chain ID for the transaction (numeric)
  // Adapters might support other custom options here
}
```

**Example Usage:**

```javascript
// Simple transfer
const simpleTx: GenericTransactionData = {
  to: '0xRecipientAddress',
  value: ethers.parseEther('0.01').toString(), // Sending 0.01 of the native currency, converted to wei
};

// Contract interaction with custom gas
const contractCallTx: GenericTransactionData = {
  to: '0xContractAddress',
  data: '0xEncodedFunctionData', // Replace with actual encoded data
  options: {
    gasLimit: '100000',
  }
};
```

**Behavior of Optional Parameters (e.g., Gas):**

*   If you provide gas parameters (`gasLimit`, `gasPrice`, `maxFeePerGas`, `maxPriorityFeePerGas`) in the `options` object, the wallet adapter will attempt to use them.
*   If these gas parameters are **not** provided:
    *   For `sendTransaction`: The wallet adapter (or its underlying provider like ethers.js) will typically estimate the required gas and current network gas prices automatically before sending the transaction.
    *   For `estimateGas`: The method's purpose is to estimate gas, so it will always perform an estimation based on the `to`, `value`, and `data` fields.
*   `nonce`: If not provided, the wallet will typically use the next sequential nonce for the sending account.

Providing these options gives you finer control, but for many common use cases, the automatic handling by the wallet is sufficient.

---

## Typed Data Format (EIP-712)

```javascript
const typedData: EIP712TypedData = {
  domain: { // EIP-712 domain separator data
    name: 'My DApp',
    version: '1',
    chainId: 1, // Chain ID of the network
    verifyingContract: '0xContractAddress' // Address of the contract verifying the signature
  },
  types: {
    // Define your custom types here.
    // IMPORTANT: Do NOT include 'EIP712Domain' as a type.
    // Ethers.js (used by the 'ethers' adapter) infers it from the 'domain' object.
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    // Add other types if your primaryType references them
  },
  primaryType: 'Permit', // The primary type of the message
  message: { // The actual message object matching the primaryType
    owner: '0xSenderAddress',
    spender: '0xSpenderAddress',
    value: '1000000000000000000', // e.g., 1 token with 18 decimals
    nonce: 0, // A unique number for this owner, contract, and nonce
    deadline: Math.floor(Date.now() / 1000) + 3600, // e.g., 1 hour from now
  },
};
```

---

## Event Handling

```javascript
// Listen for account changes
wallet.on(WalletEvent.accountsChanged, (accounts) => {
  console.log('Accounts changed:', accounts);
});

// Listen for chain changes
wallet.on(WalletEvent.chainChanged, (chainId) => {
  console.log('Chain changed:', chainId);
});

// Remove an event listener
wallet.off(WalletEvent.accountsChanged, listenerFunction);
```

---

## Network Configuration

- **Web3Auth Adapter** expects configuration as follows:

  ```javascript
  await wallet.setProvider({
    chainConfig: { // This specific structure is for Web3Auth's setProvider needs
      chainNamespace: "eip155",
      chainId: "0x89", // Polygon
      rpcTarget: "https://polygon-rpc.com",
      displayName: "Polygon",
      blockExplorer: "https://polygonscan.com/",
      ticker: "MATIC",
      tickerName: "Polygon"
    }
  });
  ```

- **EVM Wallet Adapter** accepts a `NetworkConfig` object:

  ```javascript
  const providerConfig = {
    rpcUrl: "https://ethereum-holesky.publicnode.com",
    chainId: "0x4268" // Holesky chain ID in hex (or 17000)
  };
  await wallet.setProvider(providerConfig);
  ```

Network connections for wallet adapters are managed using the `NetworkConfig` type.

- **Initial Configuration**:
  - For `EvmWalletAdapter`, you can optionally pass an `ethers.Provider` instance or a simple object like `{ rpcUrl: '...' }` in `IWalletOptions.options.provider` during `createWallet`. However, for consistency, using `setProvider` after creation is also common.
  - For `Web3AuthWalletAdapter`, initial network settings are part of the `web3authConfig.chainConfig` object passed in `IWalletOptions`.

- **Changing/Setting Networks Post-Initialization**:
  - Both adapters use the `setProvider(config: NetworkConfig)` method. Please refer to the **"Network Switching"** section for detailed examples of how to use `NetworkConfig` with `setProvider`.

---

## Supported Networks

The wallet supports all EVM-compatible networks, including but not limited to:
- Ethereum (Mainnet, Sepolia, Holesky)
- Polygon (Mainnet, Mumbai)
- Arbitrum
- Optimism
- BNB Chain
- Avalanche
- Base

Custom networks can be configured through appropriate provider settings.

## Key Data Types

This section provides an overview of important data structures and interfaces used by the `@m3s/wallet` package. For detailed definitions, please refer to the source files, primarily within `packages/wallet/src/types/` and `packages/wallet/src/adapters/`.

*   **`ICoreWallet`**:
    *   The fundamental interface that all wallet adapters must implement. It defines common wallet operations like connecting, disconnecting, getting accounts, signing messages, and sending transactions.
    *   *Key Methods*: `initialize`, `disconnect`, `getAccounts`, `getBalance`, `getNetwork`, `setProvider`, `signMessage`, `sendTransaction`.
    *   *Defined in: `packages/wallet/src/types/interface.ts`*

*   **`IEVMWallet`**:
    *   Extends `ICoreWallet` with functionalities specific to EVM-compatible chains.
    *   *Key Additional Methods*: `signTypedData`, `getGasPrice`, `estimateGas`, `getTokenBalance`, `getTransactionReceipt`.
    *   *Defined in: `packages/wallet/src/types/interface.ts`*

*   **`IWalletOptions`**:
    *   The primary configuration object passed to `createWallet` to instantiate a wallet adapter. It extends `ModuleArguments` from `@m3s/common`.
    *   *Key Properties*:
      *   `adapterName: string` (e.g., `"ethers"`, `"web3auth"`) - Specifies the registered string name of the wallet adapter to use.
      *   `options?: WalletAdapterOptionsV1` - Adapter-specific options, which is a union of all supported adapter option types (e.g., `IEthersWalletOptionsV1 | IWeb3AuthWalletOptionsV1`).
    *   *Defined in: `packages/wallet/src/index.ts`*

*   **`WalletAdapterOptionsV1`**:
    *   A union type representing all possible adapter-specific options that can be passed to the `options` field of `IWalletOptions`.
    *   Currently: `IEthersWalletOptionsV1 | IWeb3AuthWalletOptionsV1`.
    *   *Defined in: `packages/wallet/src/types/type.ts` (or `types/options.ts` if you created it there)*
    *   *Exported from: `packages/wallet/src/types/index.ts`*

*   **`IEthersWalletOptionsV1`**:
    *   Specific options for the `ethers` wallet adapter.
    *   *Key Properties*:
        *   `privateKey?: string` - Optional private key. If not provided, a random one is generated internally (this key is not retrievable).
        *   `provider?: ethers.Provider | NetworkConfig | { rpcUrl: string }` - Optional initial provider configuration.
    *   *Defined in: `packages/wallet/src/adapters/ethersWallet.ts`*
    *   *Exported from: `packages/wallet/src/adapters/options.ts` and subsequently from `packages/wallet/src/index.ts`*

*   **`IWeb3AuthWalletOptionsV1`**:
    *   Specific options for the `web3auth` wallet adapter.
    *   *Key Properties*:
        *   `clientId: string`
        *   `web3AuthNetwork: 'sapphire_mainnet' | 'sapphire_devnet' | ...` (refer to Web3Auth documentation for all values)
        *   `chainConfig: { chainNamespace: "eip155", chainId: string, rpcTarget: string, displayName: string, blockExplorer?: string, ticker?: string, tickerName?: string }`
        *   `loginConfig?: { loginProvider: string, ... }` (and other Web3Auth specific login parameters)
        *   `uxMode?: 'popup' | 'redirect'`
    *   *Defined in: `packages/wallet/src/adapters/web3authWallet.ts`*
    *   *Exported from: `packages/wallet/src/adapters/options.ts` and subsequently from `packages/wallet/src/index.ts`*

*   **`GenericTransactionData`**:
    *   A standardized object for representing transaction details across different wallet types.
    *   *Key Properties*: `to: string`, `value?: string` (native currency amount), `data?: string` (ABI-encoded call data), `options?: TransactionOptions`.
    *   Refer to the "Transaction Format" section for a detailed breakdown of `TransactionOptions`.
    *   *Defined in: `packages/wallet/src/types/interface.ts`*

*   **`NetworkConfig`**: 
    *   Used with `setProvider` to define network connections for all adapters.
    *   Also used by other M3S packages (like `@m3s/smart-contract` and `@m3s/crosschain`) for consistent network definitions.
    *   *Key Properties*: `chainId` (hex string), `name`, `displayName`, `rpcUrls` (array), `blockExplorer` (optional), `ticker` (optional), `tickerName` (optional).
    *   *Defined in: `packages/common/src/types/base.ts` (or `interface.ts`) and re-exported by `packages/wallet/src/types/index.ts`*

*   **`EstimatedFeeData`**:
    *   Represents estimated fee data for a transaction, returned by `estimateGas`.
    *   *Key Properties*: `gasLimit: bigint`, `gasPrice?: string` (legacy), `maxFeePerGas?: string` (EIP-1559), `maxPriorityFeePerGas?: string` (EIP-1559).
    *   *Defined in: `packages/wallet/src/types/interface.ts`*
    
*   **`AssetBalance`**:
    *   Represents the balance of a native asset, returned by `getBalance`.
    *   *Key Properties*: `amount: string` (smallest unit), `decimals: number`, `symbol: string`, `formattedAmount?: string`.
    *   *Defined in: `packages/wallet/src/types/interface.ts`*

*   **`EIP712TypedData`**:
    *   The structure used for signing typed data according to the EIP-712 standard via `IEVMWallet.signTypedData()`.
    *   *Key Properties*: `domain: object`, `types: object`, `primaryType: string`, `message: object`.
    *   Refer to the "Typed Data Format (EIP-712)" section for a detailed breakdown.
    *   *Defined in: `packages/wallet/src/types/interface.ts`*

*   **`WalletEvent`**:
    *   An enum representing events that the wallet can emit (e.g., `accountsChanged`, `chainChanged`). Used with `on()` and `off()` methods.
    *   *Values*: `accountsChanged`, `chainChanged`, `connect`, `disconnect`, `message`, `error`.
    *   *Defined in: `packages/wallet/src/types/events.ts` (or `enum.ts`)*

*   **`WalletErrorCode`**:
    *   An enum representing standardized error codes that can be thrown by wallet operations (e.g., `UserRejected`, `InsufficientFunds`, `NetworkError`). Check the `error.code` property in `catch` blocks.
    *   *Re-exported from `@m3s/common`. Defined in: `packages/common/src/types/error.ts` (source).*

*   **`TransactionReceipt`**:
    *   The object returned by `IEVMWallet.getTransactionReceipt()`, providing details about a mined transaction.
    *   *Common Properties*: `status: number` (1 for success, 0 for failure), `transactionHash: string`, `blockHash: string`, `blockNumber: number`, `gasUsed: string` (or BigInt). Structure can vary slightly based on the underlying ethers.js version or provider.
    *   *Type is from `ethers` library, typically re-exported or used directly.*

---