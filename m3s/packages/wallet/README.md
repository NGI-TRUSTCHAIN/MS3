# @m3s/wallet

Universal wallet interface supporting multiple blockchain wallet types with a consistent API across EVM wallets and Web3Auth integration.

> ⚠️ **Alpha Release**: APIs may change. Not production-ready.

## Installation

```bash
npm install @m3s/wallet
```

## Quick Start

```javascript
import { createWallet } from '@m3s/wallet';

// Preferred: supply multiChainRpcs and optional provider (createWallet will call setProvider during initialize if provider is present)
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  expectedInterface: 'IEVMWallet', // optional: capability verification + IDE hints
  options: {
    // REQUIRED for ethers adapter: exact format -> 0x + 64 hex chars
    privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    multiChainRpcs: {
      '137': ['https://polygon-mainnet.infura.io/v3/YOUR_KEY'],
      '10':  ['https://optimism-mainnet.infura.io/v3/YOUR_KEY']
    },
    // optional: provider in options will cause adapter to call setProvider() during initialize()
    provider: { chainId: '137', rpcUrls: ['https://polygon-mainnet.infura.io/v3/YOUR_KEY'], displayName: 'Polygon' }
  }
});

// If provider not passed, set active network explicitly:
await wallet.setProvider({
  chainId: '0xaa36a7', // Sepolia (hex)
  rpcUrls: ['https://sepolia.infura.io/v3/YOUR_KEY'],
  displayName: 'Sepolia'
});

// Use wallet
const accounts = await wallet.getAccounts();
const balance = await wallet.getBalance();
const txHash = await wallet.sendTransaction({
  to: '0x...',
  value: '0.01'
});
```

Notes:
- Private key format: exactly "0x" followed by 64 hex characters. See packages/shared/src/helpers/keys.ts for generation/encryption/decryption helpers.
- multiChainRpcs supplied to createWallet are treated as preferred RPC lists per chain; the adapter uses NetworkHelper to select a working RPC (preferred first, then public fallbacks). setProvider wires the active provider using that selection.

## Features

- Universal API — same surface for all wallet adapters
- EVM private-key adapter (ethers) and Web3Auth (browser)
- Multi-chain RPC management (multiChainRpcs, updateAllChainRpcs)
- Contract helpers: callContract (read) and writeContract (state-changing)
- Event emitter: accountsChanged, chainChanged, txConfirmed, etc.
- Signing: messages, typed data, transactions
- Gas estimation and nonce helpers

## Supported Wallets

| Adapter | Description | Status |
|---------|-------------|--------|
| `ethers` | Private key wallets (requires privateKey, supports server & browser) | ✅ Ready |
| `web3auth` | Social login wallets (browser-only; will trigger login on first getAccounts()) | ✅ Ready |

## Basic operations (common patterns)

- Create adapter: createWallet({ name, version, options })
- Check state:
  - wallet.isInitialized()
  - wallet.isConnected()
- Connect / accounts:
  - const accounts = await wallet.getAccounts()
  - await wallet.disconnect()
- Network / provider:
  - await wallet.setProvider(networkConfig) // switch network (uses multiChainRpcs preferred URLs)
  - const network = await wallet.getNetwork()
- RPC management:
  - const all = wallet.getAllChainRpcs()
  - await wallet.updateAllChainRpcs({ '1': ['https://...'] })
- Events:
  - wallet.on('accountsChanged', cb)
  - wallet.on('chainChanged', cb)
  - wallet.on('txConfirmed', cb)
  - wallet.off(...)
- Sign & verify:
  - const sig = await wallet.signMessage('hello')
  - await wallet.verifySignature(messageOrTypedData, sig, address)
- Typed data:
  - const sigTyped = await wallet.signTypedData(typedData)
- Transactions:
  - const signed = await wallet.signTransaction(tx)
  - const hash = await wallet.sendTransaction(tx)
  - const receipt = await wallet.getTransactionReceipt(hash)
- Gas & nonce:
  - const fee = await wallet.estimateGas(tx)
  - const gasPrice = await wallet.getGasPrice()
  - const nonce = await wallet.getNonce('pending')

## Contract helpers (exact behavior)

- callContract({ contractAddress, abi, method, args? })
  - Executes an eth_call via provider and returns decoded values (ethers.Interface.decodeFunctionResult). Example:
    ```javascript
    const nameTuple = await wallet.callContract({
      contractAddress: tokenAddress,
      abi: tokenAbi,
      method: 'name',
      args: []
    });
    // For single-return functions, use nameTuple[0]
    ```

- writeContract({ contractAddress, abi, method, args?, value?, overrides? })
  - Encodes calldata and sends a transaction using the wallet signer (sendTransaction). Returns the transaction hash. Example:
    ```javascript
    const txHash = await wallet.writeContract({
      contractAddress: tokenAddress,
      abi: tokenAbi,
      method: 'transfer',
      args: [recipientAddress, ethers.parseUnits('1.0', 18)]
    });
    const receipt = await wallet.getTransactionReceipt(txHash);
    ```

- Raw calldata + sendTransaction
  - You can encode calldata yourself and send a raw tx:
    ```javascript
    const iface = new ethers.Interface(tokenAbi);
    const data = iface.encodeFunctionData('transfer', [recipientAddress, ethers.parseUnits('1.0', 18)]);
    const txHash = await wallet.sendTransaction({ to: tokenAddress, data, value: '0' });
    ```

Both are supported; writeContract is a convenience wrapper.

## Deployment flow (smart-contract integration)

When using @m3s/smart-contract compiled artifacts:
1. generateContract(...) → source
2. compile(...) → CompiledOutput
3. const deploymentData = await compiled.getRegularDeploymentData(constructorArgs)
4. const txHash = await wallet.sendTransaction({ data: deploymentData.data, value: deploymentData.value || '0' })
5. const receipt = await wallet.getTransactionReceipt(txHash) (or use project test helper waitForReceipt)

Example:
```javascript
const deploymentData = await compiled.getRegularDeploymentData([deployerAddress]);
const deployTxHash = await wallet.sendTransaction({ data: deploymentData.data, value: deploymentData.value || '0' });
const deployReceipt = await wallet.getTransactionReceipt(deployTxHash);
console.log('contractAddress', deployReceipt?.contractAddress);
```

## multiChainRpcs & setProvider (clarified)

- multiChainRpcs: preferred RPC URLs per chain provided at createWallet or updated at runtime (updateAllChainRpcs).
- setProvider(networkConfig): adapter selects a working RPC by consulting multiChainRpcs and the built-in public fallbacks using NetworkHelper; it then wires the ethers provider and signer. Supplying provider in createWallet options triggers setProvider during initialize.

Best practice: supply private/public RPC URLs for critical chains (Infura/Alchemy/QuickNode) in multiChainRpcs and call setProvider (or pass provider option) to configure the active chain.

## Key management / KMS / HSM

- Use packages/shared/src/helpers/keys.ts to generate/encrypt/decrypt private keys and derive addresses.
- For HSM/KMS, implement a custom IEVMWallet adapter that delegates signing to your secure signer.

## Events & hooks

- Accounts & chain: 'accountsChanged', 'chainChanged'
- Transaction lifecycle: 'txConfirmed'
- Use wallet.on(...) to subscribe and wallet.off(...) to unsubscribe.

## Tests & authoritative examples

Refer to tests and adapter code for exact usage patterns:
- Tests: https://github.com/NGI-TRUSTCHAIN/MS3/tree/main/m3s/packages/wallet/tests
- Adapters: https://github.com/NGI-TRUSTCHAIN/MS3/tree/main/m3s/packages/wallet/src/adapters
- Key helper: packages/shared/src/helpers/keys.ts

## Notes & best practices

- Web3Auth adapter is browser-only and will trigger the OAuth/login flow on first getAccounts().
- callContract returns decoded values (not raw hex). writeContract/sendTransaction return tx hashes — wait for receipts to confirm transactions.
- Validate multiChainRpcs content with updateAllChainRpcs() and prefer private RPCs for production operations.

## Examples

### Web3Auth Social Login
```javascript
const wallet = await createWallet({
  name: 'web3auth',
  version: '1.0.0',
  options: { web3authConfig: { /* ... */ } }
});
```

### ERC20 Transfer (two ways)
- writeContract (recommended)
```javascript
const txHash = await wallet.writeContract({
  contractAddress: tokenAddress,
  abi: tokenAbi,
  method: 'transfer',
  args: [recipientAddress, ethers.parseUnits('100', 18)]
});
```
- encode & send raw transaction
```javascript
const iface = new ethers.Interface(tokenAbi);
const data = iface.encodeFunctionData('transfer', [recipientAddress, ethers.parseUnits('100', 18)]);
const txHash = await wallet.sendTransaction({ to: tokenAddress, data });
```

## Links
- 📖 [**Full Documentation**](https://m3s.changetheblock.com/docs/)
- 🧪 [**Live Demo**](https://m3s.changetheblock.com/demo/)
- Repo (tests/adapters): https://github.com/NGI-TRUSTCHAIN/MS3/tree/main/m3s/packages/wallet

## License
  - Apache-2.0 — see LICENSE in [here.](https://github.com/NGI-TRUSTCHAIN/MS3/blob/main/LICENSE)