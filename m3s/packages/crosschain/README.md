# @m3s/crosschain

Cross-chain token transfers and swaps across 20+ blockchains. Built on LI.FI with a minimal adapter exposing a standardized API for quoting, executing and monitoring cross-chain operations.

> ⚠️ Alpha release — APIs may change. For authoritative examples see the tests and adapter source.

## Installation

```bash
npm install @m3s/crosschain
```

## Key behavior (important clarifications)

- Primary UX: event-driven status updates. executeOperation emits 'status' events as the route progresses. You should listen to these events to get real‑time updates.
- getOperationStatus is available as a fallback / query API: it returns the latest cached status (adapter store) and falls back to LI.FI's active route lookup. Polling is not required for normal usage — prefer events.
- Wallets: provide reliable RPC endpoints via the wallet adapter. The adapter validates RPC reliability before executing on‑chain steps and will ask you to configure private RPCs if necessary.

## Quick Start (recommended)

1. Create a wallet (manages keys + RPC lists).
2. Create crosschain adapter (optionally pass the wallet to adapter options).
3. Request quotes.
4. Execute a quote and listen to 'status' events for updates.

Example — preferred event-driven flow:

```javascript
import { createCrossChain } from '@m3s/crosschain';
import { createWallet } from '@m3s/wallet';

// 1) Create wallet with multiChainRpcs (preferred)
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  options: {
    privateKey: '0x....',
    multiChainRpcs: {
      '137': ['https://polygon-mainnet.infura.io/v3/YOUR_KEY'],
      '10':  ['https://optimism-mainnet.infura.io/v3/YOUR_KEY']
    }
  }
});

// 2) Set an active provider (recommended so wallet.getNetwork() returns correct chain)
await wallet.setProvider({
  chainId: '137',
  rpcUrls: ['https://polygon-mainnet.infura.io/v3/YOUR_KEY'],
  displayName: 'Polygon'
});
// Note: multiChainRpcs supplies RPC lists for validation; setProvider sets the active chain for the wallet.

// 3) Create adapter (you can also pass wallet in options so executeOperation can reuse it)
const crosschain = await createCrossChain({
  name: 'lifi',
  version: '1.0.0',
  options: { apiKey: process.env.LIFI_API_KEY, wallet }
});

// 4) Get quotes
const quotes = await crosschain.getOperationQuote({
  sourceAsset: { chainId: 137, address: '0x...', symbol: 'USDC', decimals: 6 },
  destinationAsset: { chainId: 10, address: '0x...', symbol: 'USDC', decimals: 6 },
  amount: '0.1',                // human units (adapter converts to chain units)
  userAddress: (await wallet.getAccounts())[0],
  slippageBps: 50               // 0.5%
});

// 5) Execute selected quote and listen for status events
const quote = quotes[0];
const result = await crosschain.executeOperation(quote, { wallet }); // wallet required for execution steps
console.log('Started operation:', result.operationId);

// Listen for updates
crosschain.on('status', (status) => {
  console.log('Status update', status.operationId, status.status, status.statusMessage);
});

// Optionally query latest status (fallback)
const latest = await crosschain.getOperationStatus(result.operationId);
console.log('Latest status', latest.status);
```

## Events vs polling — what to use

- Use events: executeOperation emits 'status' events continuously (initial PENDING, intermediate updates, terminal COMPLETED/FAILED).
- Use getOperationStatus: only as a query/fallback when you need to fetch latest adapter-cached state (e.g., after reconnecting, or if you missed events). The adapter stores latest statuses in-memory and consults LI.FI active routes when needed.
- Polling is not required for normal usage and not recommended as first choice.

## Wallet / RPC notes (clarified)

- multiChainRpcs in createWallet: supplies lists of RPC endpoints keyed by chain id. This is used by the adapter (via wallet.getAllChainRpcs()) for RPC reliability checks — do provide private RPC endpoints (Infura/Alchemy/QuickNode) for production.
- setProvider: still recommended. The adapter calls wallet.getNetwork() to detect the wallet's current chain when creating temporary providers. If you do not call setProvider, ensure wallet.getNetwork() returns a valid network (some wallet adapters may set a default).
- You can pass the wallet either:
  - into createCrossChain options (adapter will reuse wallet), or
  - to executeOperation as { wallet } (per-call), as shown above.

## Error handling & RPC validation

- Before execution the adapter validates RPCs for source/destination chains. If validation fails it throws an AdapterError with an actionable message like "Private RPCs required ... use wallet.updateAllChainRpcs()".
- Provide multiChainRpcs with private endpoints to avoid failures in execution.

## API summary

- getOperationQuote(intent) => Promise<OperationQuote[]>
- executeOperation(quote, { wallet }) => Promise<OperationResult> (returns initial PENDING result and emits 'status' updates)
- getOperationStatus(operationId) => Promise<OperationResult>
- cancelOperation(operationId, { wallet?, reason? }) => Promise<OperationResult>
- resumeOperation(operationId, { wallet? }) => Promise<OperationResult>
- on('status', handler) — listen for OperationResult updates

## Tests & authoritative examples

See tests for real usage patterns and helpers (waitForReceipt, event tracking, RPC management):
- packages/crosschain/tests/adapters/03_LifiAdapter.test.ts
- packages/crosschain/src/adapters/LI.FI.Adapter.ts
- packages/crosschain/src/adapters/LI.FI.registration.ts

## Troubleshooting

- "Private RPCs required ... updateAllChainRpcs" — add private RPCs via wallet.updateAllChainRpcs() and ensure wallet.setProvider active chain is set.
- If getOperationQuote returns [], try adding an API key or adjusting intent (amount, slippage).

## Links
- 📖 [**Full Documentation**](https://m3s.changetheblock.com/docs/)
- 🧪 [**Live Demo**](https://m3s.changetheblock.com/demo/)

## License
  - Apache-2.0 — see LICENSE in [here.](https://github.com/NGI-TRUSTCHAIN/MS3/blob/main/LICENSE)