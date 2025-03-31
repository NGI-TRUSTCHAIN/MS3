<!-- filepath: packages/smartContract/README.md -->
# @m3s/smart-contract

A modular toolkit for generating, compiling, deploying, and interacting with Ethereum‑compatible smart contracts. Using our OpenZeppelin adapter, this module dynamically produces contracts for ERC20, ERC721, and ERC1155 standards with customizable features (such as mintability, burnability, pausability, upgradeability, etc.) during test runs and development builds.

> ⚠️ **DEVELOPMENT WARNING**  
> This package is in active development (alpha stage). The API, generated code, and configuration options are subject to breaking changes without notice. Please test thoroughly before integrating into production.

---

## Development Status

- 🚧 Core functionality is implemented and under continuous testing.
- ⚠️ Generation options, adapter workflows, and deployment methods may change.
- 🧪 Unit and integration tests cover most functionality, though some features are still evolving.
- 📝 Documentation and examples will be updated as the module matures.

---

## What It Does

1. **Dynamic Contract Generation**  
   - Based on flexible options (mintable, burnable, pausable, etc.), contracts for ERC20, ERC721, and ERC1155 (and their extensions) are generated on‑the‑fly during test runs.
   - Note: The contracts output (in the `/contracts` folder) is created temporarily for compilation and testing purposes and should not be considered as maintained source code.

2. **Compilation via Hardhat**  
   - The generated Solidity source is written to a temporary directory where a minimal Hardhat project is built.
   - Compilation uses a specified Solidity version (e.g. 0.8.22 with optimizer settings) and produces artifacts (ABI, bytecode).

3. **Deployment & Interaction**  
   - A unified interface lets you deploy the compiled contract—passing constructor arguments such as an initial owner—and call its methods (e.g. minting, balance queries).

4. **Extensible Adapter Pattern**  
   - The module’s adapters (currently the OpenZeppelinAdapter) abstract contract generation, compilation, and deployment. This design makes it easier to add or change supported standards.

---

## Installation

Install via npm:

```bash
npm install @m3s/smart-contract
```

---

## Usage Example

Below is an example that demonstrates the entire flow—from generating a contract to deploying and interacting with it. (Replace `YOUR_RPC_URL` and `YOUR_PRIVATE_KEY` with real values.)

```typescript
import { createContractHandler } from '@m3s/smart-contract';
import { ethers } from 'ethers';
import * as path from 'path';

// Create a contract handler instance using the OpenZeppelin adapter
const contractHandler = await createContractHandler({
  adapterName: 'openZeppelin',
  // Specify a work directory for temporary generation; note that the output here is transient.
  options: {
    workDir: path.join(process.cwd(), 'contracts'),
    preserveOutput: true  // Enable preservation for debugging; these files are generated on test runs.
  }
});

// Generate an ERC1155 contract with multiple features enabled
const contractSource = await contractHandler.generateContract({
  standard: 'ERC1155',
  options: {
    name: 'ComplexMultiToken',
    uri: 'ipfs://QmComplexToken/{id}.json',
    burnable: true,
    pausable: true,
    mintable: true,
    supply: true,
    updatableUri: true,
    access: 'ownable'
  }
});

// Compile the generated source code using Hardhat
const compiled = await contractHandler.compile(contractSource);

// Prepare constructor arguments (e.g. using the deployer’s address)
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL'); 
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const deployerAddress = await signer.getAddress();
const constructorArgs = [deployerAddress];

// Deploy the compiled contract to a testnet
const deployed = await contractHandler.deploy(compiled, constructorArgs, signer);
console.log(`Contract deployed at: ${deployed.address}`);

// Example interaction: call balanceOf on the deployed contract
const balance = await contractHandler.callMethod(
  deployed.address,
  compiled.abi,
  'balanceOf',
  [deployerAddress, 1],
  signer
);
console.log(`Balance of token 1: ${balance}`);
```

---

## Testing

This package includes a comprehensive test suite that verifies core functionality as well as specific behavior for ERC20, ERC721, and ERC1155 contracts. Note that during tests, the contracts are generated dynamically, compiled, and then deployed for integration checks.

To run tests with Vitest, use:

```bash
npm run test
```

---

## Project Structure

The key code is contained in the `src` folder, while generated contracts appear in the `contracts` directory only during test runs or build operations. The maintained project structure is as follows:

```
smartContract/
  ├── src/
  │      ├── adapters/         // Contains the OpenZeppelinAdapter (implements IBaseContractHandler)
  │      ├── types/            // Type definitions and interfaces for contract options and results
  │      ├── registry.ts       // Maps standards to adapter functions
  │      └── index.ts          // Primary module entry point
  ├── tests/                  // Comprehensive test suite for all supported standards
  │      ├── 01_Core.test.ts
  │      ├── 02_IBaseContractHandler.test.ts
  │      ├── 03_ERC20.test.ts
  │      ├── 04_ERC721.test.ts
  │      └── 05_ERC1155.test.ts
  ├── package.json
  ├── tsconfig.json
  └── README.md
```

*Note:* The generated contracts and their artifacts (including individual README files with generation timestamps and source hashes) are dynamic outputs of the module’s test and build processes and are not part of the maintained source code.

---

## Additional Information

For further details about generation metadata (timestamps, source hashes, etc.), please check the README files within the generated contract subfolders (e.g. in a run’s temporary `ComplexNFT` or `ComprehensiveToken` directories).

---

*This README has been aligned with our wallet package’s style to provide consistent messaging regarding development status, usage, and available features across packages.*

Happy coding!