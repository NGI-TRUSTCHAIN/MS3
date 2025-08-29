<div align="center">
  <img src="./logo.png" alt="MS3 Banner" width="300"/>
</div>


# @m3s/smart-contract

Generate, compile, prepare deployment payloads and interact with smart contracts using OpenZeppelin templates (Solidity). This package produces source → compiled artifacts → deployment calldata. Signing/sending and RPC management are delegated to a wallet adapter (see examples).

> ⚠️ Alpha release: APIs may change. Check adapter registration files and tests for authoritative examples.

## Installation

```bash
npm install @m3s/smart-contract
```

## High-level flow (recommended)
1. createContractHandler(...) to get an adapter (OpenZeppelin).
2. generateContract(...) to produce source code (OZ Wizard).
3. compile(...) to produce a CompiledOutput (artifacts + helpers).
4. Use compiled.getRegularDeploymentData(...) or compiled.getProxyDeploymentData(...) to obtain deployment calldata.
5. Send calldata via an @m3s/wallet adapter (wallet.sendTransaction / wallet.writeContract) and wait for a receipt.

## Quick Start (example)

```javascript
import { createContractHandler } from '@m3s/smart-contract';
import { createWallet } from '@m3s/wallet';

// create wallet (handles keys & RPC)
const wallet = await createWallet({
  name: 'ethers',
  version: '1.0.0',
  options: { privateKey: '0x....' }
});

// create handler (OpenZeppelin adapter)
const handler = await createContractHandler({
  name: 'openZeppelin',
  version: '1.0.0',
  options: { preserveOutput: true } // adapter-specific
});

// generate contract (use GenerateContractInput shape)
const source = await handler.generateContract({
  language: 'solidity',
  template: 'openzeppelin_erc20',
  options: { name: 'MyToken', symbol: 'MTK', premint: '1000000', mintable: true, access: 'ownable' }
});

// compile (returns CompiledOutput)
const compiled = await handler.compile({ sourceCode: source, language: 'solidity', contractName: 'MyToken' });

// get deployment payload (regular)
const deployment = await compiled.getRegularDeploymentData([/* constructor args */]);

// send using wallet
const txHash = await wallet.sendTransaction({ data: deployment.data, value: deployment.value || '0' });

// wait for receipt (see tests for waitForReceipt helper)
```

Important: contractHandler.deploy(...) was removed/deprecated in favor of explicit compiled.get... → wallet.sendTransaction flow.

## Templates & required fields
- openzeppelin_erc20: requires name, symbol. Optional: premint, mintable, burnable, pausable, permit, votes, flashmint, access ('ownable' | 'roles'), upgradeable ('uups'|'transparent'|false)
- openzeppelin_erc721: requires name, symbol. Optional: baseUri, enumerable, uriStorage, mintable, burnable, pausable, incremental, votes, access, upgradeable
- openzeppelin_erc1155: requires name and uri (uri may be empty string). Optional: mintable, burnable, pausable, supply, updatableUri, access, upgradeable

Adapter normalizes and validates options:
- Required missing fields throw AdapterError (actionable message).
- upgradeable is normalized; allowed values: 'uups', 'transparent' or false. Invalid values become false.
- The generator will only include optional features you explicitly pass — it does not add features implicitly.

## Examples: Features

ERC20 options example
```json
{
  "name": "MyToken",
  "symbol": "MTK",
  "premint": "1000000",
  "mintable": true,
  "burnable": true,
  "pausable": true,
  "permit": true,
  "votes": true,
  "access": "ownable",
  "upgradeable": "uups"
}
```

ERC721 options example
```json
{
  "name": "MyNFTs",
  "symbol": "MNFT",
  "baseUri": "ipfs://QmHash/",
  "mintable": true,
  "enumerable": true,
  "uriStorage": true,
  "incremental": true,
  "access": "ownable",
  "upgradeable": "transparent"
}
```

ERC1155 options example
```json
{
  "name": "Multi",
  "uri": "ipfs://Qm/{id}.json",
  "mintable": true,
  "burnable": true,
  "supply": true,
  "updatableUri": true,
  "access": "roles"
}
```

## CompiledOutput helpers (what you actually use)
- compiled.getDeploymentArgsSpec(opts?) — returns ABI inputs (constructor or initialize)
- compiled.getRegularDeploymentData(constructorArgs) => { type: 'regular', data, value? }
  - Validate args count; returns unsigned deploy tx calldata (factory.getDeployTransaction(...))
- compiled.getProxyDeploymentData(initializeArgs) => { type: 'proxy', implementation: {data,value}, proxy: {abi,bytecode,logicInitializeData,value} }
  - Returns implementation deploy calldata and proxy bytecode + logicInitializeData to deploy proxy with initializer.

Typical proxy deploy flow:
1. implTx = implementation.data -> send via wallet
2. implReceipt.contractAddress -> implementationAddress
3. Create proxy deploy tx using proxy.abi / proxy.bytecode and logicInitializeData (tests use ethers.ContractFactory.getDeployTransaction)
4. wallet.sendTransaction({ data: proxyDeployTx.data })

## Interacting with deployed contracts
Prefer wallet adapter helpers:

- Read-only:
  await wallet.callContract({ contractAddress, abi, method, args })
  - Executes eth_call and returns decoded value (not tx hash)

- State-changing:
  await wallet.writeContract({ contractAddress, abi, method, args, value })
  - Encodes & sends tx via signer, returns tx hash

- Raw calldata:
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData('transfer', [to, amount]);
  await wallet.sendTransaction({ to: contractAddress, data });

## Upgradeable contracts
- Set option upgradeable: 'uups' or 'transparent' when generating.
- generateContract with upgradeable will add initialize() patterns (no constructor) and necessary imports.
- compiled.getProxyDeploymentData(...) will produce both implementation payload and proxy metadata (bytecode, abi, logicInitializeData).
- Tests show full proxy deployment & interactions (see ERC721/ERC1155 tests).

## Provider / network notes
- providerConfig option on adapter: if provided, adapter will try to create a default JsonRpcProvider during initialize() (useful for diagnostics in server environments). It is optional — deployment still works if you supply a wallet with a provider.
- For deployments and interactions rely on a wallet adapter with provider set (createWallet + wallet.setProvider).

## Errors & troubleshooting
- generateContract throws AdapterError with mapped OZ Wizard messages (e.g., missing name/symbol, invalid upgradeable).
- If compile fails, compiler throws descriptive error with stdout/stderr printed.
- If a feature doesn't appear in generated source, confirm you passed that option explicitly — the generator forwards only provided options.

## Tests & examples (authoritative)
- ERC20, ERC721, ERC1155 generation tests:
  packages/smart-contract/tests/adapters/Solidity/03_ERC20.test.ts
  packages/smart-contract/tests/adapters/Solidity/04_ERC721.test.ts
  packages/smart-contract/tests/adapters/Solidity/05_ERC1155.test.ts (includes waitForReceipt and full proxy examples)
- Adapter implementation & registration:
  packages/smart-contract/src/adapters/openZeppelin/adapter.ts
  packages/smart-contract/src/adapters/openZeppelin/openZeppelin.registration.ts
- Factory:
  packages/smart-contract/src/index.ts

## Developer notes
- Generator uses @openzeppelin/wizard (dynamic import). For other languages the generator will suggest missing packages if not installed.
- Compiler uses hardhat in a temporary workspace and preserves artifacts when preserveOutput is true (see SolidityCompiler).
- Registry metadata includes capabilities, requirements and static compatibility matrix (see registration file).

## Links
- 📖 [**Full Documentation**](https://m3s.changetheblock.com/docs/)
- 🧪 [**Live Demo**](https://m3s.changetheblock.com/demo/)

## License
  - Apache-2.0 — see LICENSE in [here.](https://github.com/NGI-TRUSTCHAIN/MS3/blob/main/LICENSE)