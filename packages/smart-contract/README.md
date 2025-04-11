# @m3s/smart-contract

A modular toolkit for generating, compiling, deploying, and interacting with Ethereum‑compatible smart contracts. Using our OpenZeppelin adapter, this module dynamically produces contracts for ERC20, ERC721, and ERC1155 standards with customizable features (such as mintability, burnability, pausability, upgradeability, etc.).

> ⚠️ **DEVELOPMENT WARNING**  
> This package is in active development (alpha stage). The API, generated code, and configuration options are subject to breaking changes without notice. Please test thoroughly before integrating into production.

---

## Development Status

- 🚧 Core functionality is implemented and under continuous testing.
- ⚠️ Generation options, adapter workflows, and deployment methods may change.
- 🧪 Unit and integration tests cover most functionality, though some features are still evolving.
- 📝 Documentation and examples will be updated as the module matures.

---

## Installation

Install via npm:

```bash
npm install @m3s/smart-contract
```

## Features

- 🔨 **Contract Generation**: Create ERC20, ERC721, and ERC1155 contracts with configurable features
- 📦 **Seamless Compilation**: Compile contracts using integrated Solidity compiler
- 🚀 **Easy Deployment**: Deploy contracts with minimal configuration
- 🔄 **Contract Interaction**: Call and execute methods on deployed contracts
- 🧩 **Extensible Architecture**: Add custom contract types through the adapter system

## Contract Features

### ERC20 Token Customization

| Feature   | Description                                               |
|-----------|-----------------------------------------------------------|
| name      | Token name (e.g., "My Token")                             |
| symbol    | Token symbol (e.g., "MTK")                                |
| premint   | Amount to mint to deployer initially                      |
| burnable  | Allow token holders to burn their tokens                  |
| pausable  | Allow contract owner to pause transfers                   |
| permit    | Enable ERC-2612 gasless approvals                         |
| votes     | Enable on-chain governance features                       |
| flashmint | Allow flash loans of the token                           |
| snapshots | Enable balance snapshots                                  |
| access    | Define access control ("ownable" or "roles")              |

### ERC721 NFT Customization

| Feature    | Description                                             |
|------------|---------------------------------------------------------|
| name       | Collection name (e.g., "My NFTs")                       |
| symbol     | Collection symbol (e.g., "MNFT")                        |
| baseUri    | Base URI for token metadata                             |
| burnable   | Allow token holders to burn their NFTs                 |
| pausable   | Allow contract owner to pause transfers                |
| mintable   | Allow the owner to mint new tokens                     |
| incremental| Use sequential token IDs                                |
| uriStorage | Store token URIs on-chain                               |
| enumerable | Enable full enumeration of tokens                      |
| access     | Define access control ("ownable" or "roles")           |

### ERC1155 Multi-Token Customization

| Feature      | Description                                               |
|--------------|-----------------------------------------------------------|
| name         | Collection name (e.g., "My Multi-Tokens")                 |
| uri          | URI pattern for token metadata                            |
| burnable     | Allow token holders to burn their tokens                  |
| pausable     | Allow contract owner to pause transfers                   |
| mintable     | Allow the owner to mint new tokens                        |
| supply       | Track total supply for each token ID                      |
| updatableUri | Allow owner to update the metadata URI                    |
| access       | Define access control ("ownable" or "roles")              |

## Usage Examples

### Creating and Deploying an ERC20 Token

```javascript
import { createContractHandler } from '@m3s/smart-contract';
import { ethers } from 'ethers';

// Initialize
const contractHandler = await createContractHandler();

// 1. Generate an ERC20 contract
const tokenOptions = {
  name: "MyToken",
  symbol: "MTK",
  premint: "1000000000000000000000000", // 1 million tokens with 18 decimals
  burnable: true,
  pausable: true,
  permit: true
};

const source = await contractHandler.generateERC20(tokenOptions);

// 2. Compile the contract
const compiled = await contractHandler.compile(source);

// 3. Connect to a blockchain
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// 4. Deploy the contract
const deployed = await contractHandler.deploy(compiled, [], signer);
console.log(`Token deployed at: ${deployed.address}`);

// 5. Interact with the contract
const balance = await contractHandler.callMethod(
  deployed.address,
  'balanceOf',
  [await signer.getAddress()],
  signer
);
console.log(`Token balance: ${ethers.formatUnits(balance, 18)}`);
```

### Creating and Deploying an NFT Collection

```javascript
// Generate an ERC721 NFT contract
const nftOptions = {
  name: "MyNFTs",
  symbol: "MNFT",
  baseUri: "ipfs://QmYourCID/",
  burnable: true,
  mintable: true,
  uriStorage: true,
  enumerable: true
};

const source = await contractHandler.generateERC721(nftOptions);
const compiled = await contractHandler.compile(source);
const deployed = await contractHandler.deploy(compiled, [], signer);

// Mint a new NFT
await contractHandler.executeMethod(
  deployed.address,
  'safeMint',
  [
    "0xRecipientAddress",  // Recipient
    "1",                   // Token ID
    "metadata/1.json"      // Token URI suffix
  ],
  signer
);
```

### Creating and Deploying a Multi-Token Collection

```javascript
// Generate an ERC1155 contract
const multiTokenOptions = {
  name: "GameItems",
  uri: "ipfs://QmYourCID/{id}.json",
  burnable: true,
  mintable: true,
  supply: true,
  access: "roles" // Use AccessControl with roles
};

const source = await contractHandler.generateERC1155(multiTokenOptions);
const compiled = await contractHandler.compile(source);
const deployed = await contractHandler.deploy(compiled, [], signer);

// Mint multiple tokens
await contractHandler.executeMethod(
  deployed.address,
  'mintBatch',
  [
    "0xRecipientAddress",            // Recipient
    [1, 2, 3],                       // Token IDs
    [100, 50, 1],                    // Amounts (100 of ID 1, 50 of ID 2, 1 of ID 3)
    "0x"                             // Data
  ],
  signer
);
```

## API Reference

### Core Functions

| Function                 | Description                                        |
|--------------------------|----------------------------------------------------|
| createContractHandler()  | Create a contract handler instance                 |
| generateERC20(options)   | Generate ERC20 token contract source               |
| generateERC721(options)  | Generate ERC721 NFT contract source                |
| generateERC1155(options) | Generate ERC1155 multi-token contract source         |
| compile(source)          | Compile a contract source to bytecode and ABI      |
| deploy(compiled, args, signer) | Deploy a compiled contract                   |
| callMethod(address, method, args, signer) | Call a read-only method          |
| executeMethod(address, method, args, signer) | Execute a state-changing method  |

### Additional Features

- **Automated Gas Estimation**: The library handles gas estimation for you.
- **Error Handling**: Clear error messages for common contract operations.
- **Network Detection**: Automatically adapts to the connected network.
- **Contract Verification**: Generate contract source code suitable for block explorer verification.