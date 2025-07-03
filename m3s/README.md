# M3S - Modular Multi-chain Suite

Universal adapter system for blockchain development with standardized interfaces and centralized gas estimation.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|---------|
| [`@m3s/wallet`](packages/wallet/) | Universal wallet interface with centralized gas estimation | ✅ Active Development |
| [`@m3s/smart-contract`](packages/smart-contract/) | Contract generation & deployment | ✅ Beta |
| [`@m3s/crosschain`](packages/crosschain/) | Cross-chain transfers & swaps | 🚧 In Development |
| [`@m3s/common`](packages/common/) | Shared utilities, registry & network helpers | ✅ Stable |

## 🚀 Quick Start

```bash
# Install packages
npm install @m3s/wallet @m3s/smart-contract @m3s/crosschain

# Create wallet with automatic gas estimation
import { createWallet } from '@m3s/wallet';
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  options: { privateKey: 'YOUR_KEY' }
});

# Centralized gas estimation across all wallet types
const gasEstimate = await wallet.estimateGas({
  to: '0x...',
  value: '1.0',
  data: '0x'
});

# Generate & deploy contracts
import { createContractHandler } from '@m3s/smart-contract';
const contracts = await createContractHandler({
  name: 'openZeppelin',
  version: '1.0.0'
});

# Cross-chain transfers
import { createCrossChain } from '@m3s/crosschain';
const bridge = await createCrossChain({
  name: 'lifi',
  version: '1.0.0'
});
```

## 🎯 Key Features

- **Centralized Gas Estimation** - Single gas estimation logic across all wallet adapters
- **Multi-RPC Support** - Automatic failover between RPC endpoints
- **Environment Validation** - Browser/server compatibility checks
- **Standardized Interfaces** - Consistent APIs across all adapters
- **Network-Aware Testing** - Robust test suite with private RPC support

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific package tests
npm run test:wallet
npm run test:smart-contract
npm run test:crosschain

# Current test coverage: 93 tests, ~17-25s execution time
```

## 📖 Documentation

- **Package READMEs** - Check each package directory for detailed docs
- **Type Definitions** - Full TypeScript support with exported interfaces
- **Test Examples** - Comprehensive test suite as usage examples

## 🏗️ Development Status

### Recently Completed
- ✅ Centralized gas estimation system
- ✅ Multi-RPC configuration and failover
- ✅ Network switching with timeout protection
- ✅ Robust error handling for unreliable RPCs

### In Progress
- 🚧 Cross-chain adapter standardization
- 🚧 Performance optimization for large test suites
- 🚧 Documentation website

## 🤝 Contributing

1. Each package has adapter templates in `src/adapters/`
2. Follow existing patterns for gas estimation and RPC management
3. Include comprehensive tests with both private and public RPC scenarios
4. Ensure proper error handling for network connectivity issues

## 📄 License

MIT

---

**Note**: This is an active development project. Some features may be experimental. 
Check individual package READMEs for specific implementation status.