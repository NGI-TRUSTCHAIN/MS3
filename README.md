# M3S - Modular Multi-chain Suite

Universal adapter system for blockchain development with auto-generated documentation and community-driven adapters.

## 📦 Packages

| Package | Description | Status |
|---------|-------------|---------|
| [`@m3s/wallet`](packages/wallet/) | Universal wallet interface | ✅ Ready |
| [`@m3s/smart-contract`](packages/smart-contract/) | Contract generation & deployment | ✅ Ready |
| [`@m3s/crosschain`](packages/crosschain/) | Cross-chain transfers & swaps | ✅ Ready |
| [`@m3s/common`](packages/common/) | Shared utilities & registry | ✅ Ready |

## 🚀 Quick Start

```bash
# Install packages
npm install @m3s/wallet @m3s/smart-contract @m3s/crosschain

# Create wallet
import { createWallet } from '@m3s/wallet';
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  options: { privateKey: 'YOUR_KEY' }
});

# Generate & deploy contract
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

## 🎯 Features

- **Auto-Generated Requirements** - JOI schemas → documentation
- **Environment Validation** - Browser/server compatibility checks
- **Community Adapters** - Standardized adapter templates
- **Performance Optimized** - 108 tests in ~5 seconds

## 📖 Documentation

- **[Full Documentation](https://docs.m3s.dev)** - Complete guides & API reference
- **[Live Demo](https://demo.m3s.dev)** - Try all features in browser
- **[Community Adapters](https://github.com/m3s-org/community-adapters)** - Create your own

## 🤝 Contributing

1. Use adapter templates in each package
2. Follow JOI schema patterns
3. Include tests and documentation
4. Submit to community repository

## 📄 License

MIT