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

## Contract Adapters

The `@m3s/smart-contract` package utilizes an adapter pattern to support different contract development and interaction paradigms. Adapters provide a consistent interface for common tasks like code generation, compilation, deployment, and contract calls.

### OpenZeppelin Adapter (`openZeppelin`)

The `OpenZeppelinAdapter` is the primary adapter for working with Solidity smart contracts, leveraging OpenZeppelin's widely-used and audited contract templates.

**Key Capabilities:**

*   **Contract Generation**:
    *   Generates Solidity source code for standard contracts like ERC20, ERC721, and ERC1155.
    *   Supports various OpenZeppelin features and extensions (e.g., Mintable, Burnable, Pausable, Ownable, Roles, UUPS Upgradeable).
*   **Compilation**:
    *   Compiles Solidity source code using `solc-js`.
    *   Manages compiler versions and configurations.
*   **Deployment**:
    *   Deploys compiled contracts to EVM-compatible networks.
    *   Requires an `@m3s/wallet` `IEVMWallet` instance for signing and sending deployment transactions.
*   **Contract Interaction**:
    *   Provides methods to call read (`callMethod`) and write (`sendMethod`) functions on deployed contracts.
    *   Estimates gas for transactions (`estimateGasForMethod`).

**Basic Usage Example:**

```javascript
import { createContractHandler, IBaseContractHandler, GenerateContractInput, CompileInput, DeployInput } from '@m3s/smart-contract';
import { createWallet, IEVMWallet, IWalletOptions, NetworkConfig } from '@m3s/wallet'; // Changed from ProviderConfig

async function main() {
  // 1. Setup Wallet (required for deployment and sending transactions)
  const walletOptions: IWalletOptions = {
    adapterName: 'ethers',
    options: { privateKey: 'YOUR_PRIVATE_KEY_HERE' } // Replace!
  };
  const wallet = await createWallet<IEVMWallet>(walletOptions);

  // Define network configuration
  const sepoliaNetwork: NetworkConfig = { // Changed from ProviderConfig
    chainId: '0xaa36a7', // Sepolia
    name: 'Sepolia',
    rpcUrls: ['https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>'] // Replace!
  };
  await wallet.setProvider(sepoliaNetwork);
  console.log('Wallet initialized and provider set.');

  // 2. Create Contract Handler
  const contractHandler = await createContractHandler({
    adapterName: 'openZeppelin',
    options: { // This should now be IOpenZeppelinAdapterOptionsV1
      providerConfig: sepoliaNetwork, // This is part of IOpenZeppelinAdapterOptionsV1
      preserveOutput: false,
      // solcVersion: '0.8.22' // Example of another option within IOpenZeppelinAdapterOptionsV1
    }
  });
  console.log('Contract handler created.');

  // 3. Generate Contract Source
  const generateInput: GenerateContractInput = {
    language: 'solidity',
    template: 'openzeppelin_erc20',
    options: { name: 'MyTestToken', symbol: 'MTT', premint: '1000', mintable: true, access: 'ownable' }
  };

  const sourceCode: string = await contractHandler.generateContract(generateInput);
  console.log(`Generated source code for ${(generateInput.options as any).name}`);

 // 4. Compile Contract
 const compileInput: CompileInput = {
    sourceCode: sourceCode,
    language: 'solidity',
    contractName: (generateInput.options as any).name
  };
  const compiledOutput: CompiledOutput = await contractHandler.compile(compileInput);
  console.log('Compilation successful. ABI available.');

 // 5. Deploy Contract
  const deployerAddress = (await wallet.getAccounts())[0];
  // For ERC20 with premint and ownable access, constructor is (initialOwner, premintRecipient)
  const constructorArgs = [deployerAddress, deployerAddress]; 
  const deployInput: DeployInput = {
    compiledContract: compiledOutput,
    constructorArgs: constructorArgs,
    wallet: wallet
  };
  const deployedContract: DeployedOutput = await contractHandler.deploy(deployInput);
  console.log(`Contract deployed at: ${deployedContract.contractId} on chain ${deployedContract.chainId || sepoliaNetwork.chainId}`);
  if (deployedContract.deploymentInfo?.transactionId) {
    console.log(`Deployment transaction hash: ${deployedContract.deploymentInfo.transactionId}`);
  }

  // 6. Interact with Contract
  // Example: Get total supply (a read operation)
  const totalSupplyResult: any = await contractHandler.callMethod({
    contractId: deployedContract.contractId,
    contractInterface: compiledOutput.artifacts.abi,
    functionName: 'totalSupply',
    args: []
  });
  // For read operations, the result is typically the direct value.
  console.log(`Total Supply (raw): ${totalSupplyResult}`);
  if (totalSupplyResult !== undefined && typeof totalSupplyResult.toString === 'function') {
    console.log(`Total Supply (formatted): ${ethers.formatUnits(totalSupplyResult.toString(), 18)}`); // Assuming 18 decimals
  }

  // Example: Mint tokens (a write operation)
  const otherAddress = ethers.Wallet.createRandom().address;
  const mintAmount = ethers.parseUnits("100", 18);
  const mintResult: any = await contractHandler.callMethod({
    contractId: deployedContract.contractId,
    contractInterface: compiledOutput.artifacts.abi,
    functionName: 'mint',
    args: [otherAddress, mintAmount],
    wallet: wallet
  });

  if (mintResult && mintResult.transactionHash) {
    console.log(`Mint transaction sent. Hash: ${mintResult.transactionHash}`);
    // const receipt = await wallet.getTransactionReceipt(mintResult.transactionHash); // Optional: wait for receipt
    // console.log('Mint transaction receipt:', receipt);
  } else {
    console.error('Minting did not return a transaction hash. Result:', mintResult);
  }
}

main().catch(console.error);
```

---

## Key Data Types

This section provides an overview of important data structures and interfaces used by the `@m3s/smart-contract` package, particularly with the `OpenZeppelinAdapter`. For detailed definitions, please refer to the source files, primarily within `packages/smart-contract/src/types/` and `packages/smart-contract/src/adapters/`.

*   **`IContractOptions`**:
    *   Configuration object passed to `createContractHandler` when initializing an adapter. It extends `ModuleArguments` from `@m3s/common`.
    *   *Key Properties*:
        *   `adapterName: string` (e.g., `"openZeppelin"`)
        *   `options?: SmartContractAdapterOptionsV1` - Adapter-specific options, which is a union of all supported adapter option types (e.g., `IOpenZeppelinAdapterOptionsV1`).
    *   *Defined in: `packages/smart-contract/src/index.ts`*

*   **`SmartContractAdapterOptionsV1`**:
    *   A union type representing all possible adapter-specific options that can be passed to the `options` field of `IContractOptions`.
    *   Currently: `IOpenZeppelinAdapterOptionsV1`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts` (or `types/options.ts` if created)*
    *   *Exported from: `packages/smart-contract/src/types/index.ts`*

*   **`IOpenZeppelinAdapterOptionsV1`**:
    *   Specific options for the `openZeppelin` smart contract adapter.
    *   *Key Properties*: `workDir?: string`, `hardhatConfig?: object` (for custom Hardhat settings), `preserveOutput?: boolean`, `providerConfig?: NetworkConfig` (from `@m3s/common`, for network context), `compilerSettings?: object` (Solidity compiler settings like optimizer), `solcVersion?: string`.
    *   *Defined in: `packages/smart-contract/src/adapters/openZeppelin/adapter.ts`*
    *   *Exported from: `packages/smart-contract/src/adapters/options.ts` and subsequently from `packages/smart-contract/src/index.ts`*

*   **`GenerateContractInput`**:
    *   Input for the `generateContract` method to create contract source code.
    *   *Key Properties*: `language: string` (e.g., `"solidity"`), `template: string` (e.g., `"openzeppelin_erc20"`), `options: object` (template-specific options).
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`CompileInput`**:
    *   Input for the `compile` method.
    *   *Key Properties*: `sourceCode: string`, `language: ContractLanguage`, `contractName?: string`, `compilerOptions?: object`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`CompiledOutput`**:
    *   Output from the `compile` method.
    *   *Key Properties*: `artifacts: ContractArtifacts`, `metadata?: Record<string, any>`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`ContractArtifacts`**:
    *   Contains the ABI and bytecode for a compiled contract.
    *   *Key Properties*: `abi: any[]`, `bytecode: string`, `contractName: string`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`DeployInput`**:
    *   Input for the `deploy` method.
    *   *Key Properties*: `compiledContract: CompiledOutput`, `constructorArgs?: any[]`, `wallet: IEVMWallet`, `deployOptions?: Record<string, any>`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`DeployedOutput`**:
    *   Output from the `deploy` method.
    *   *Key Properties*: `contractId: string`, `chainId?: string | number`, `deploymentInfo?: object`, `contractInterface?: any`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`ContractCallInput`**:
    *   Input for calling contract methods (`callMethod`).
    *   *Key Properties*: `contractId: string`, `contractInterface: any`, `functionName: string`, `args?: any[]`, `wallet?: IEVMWallet`, `callOptions?: object`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

*   **`ContractInteractionResult`**:
    *   Common output structure for `callMethod`.
    *   *Key Properties*: `success: boolean`, `result?: any`, `transactionHash?: string`, `receipt?: any`, `error?: string`, `gasUsed?: string`, `blockNumber?: number`.
    *   *Defined in: `packages/smart-contract/src/types/interfaces/base.ts`*

---

## API Reference (OpenZeppelin Adapter)

This section details the core methods provided by the `OpenZeppelinAdapter` when using `createContractHandler`.

### `generateContract(input: GenerateContractInput): Promise<string>` 

Generates smart contract source code based on a specified template and options.

*   **Purpose**: To dynamically create Solidity contract code for standard token types (ERC20, ERC721, ERC1155) with various OpenZeppelin features.
*   **Arguments (`GenerateContractInput`)**:
    *   `language: string`: The smart contract language. Currently, only `"solidity"` is supported by this adapter for full compilation/deployment. Other languages like Cairo, Stellar, Stylus are supported for code generation via their respective OpenZeppelin wizards.
    *   `template?: string`: The specific contract template (e.g., `"openzeppelin_erc20"`, `"openzeppelin_erc721"`, `"openzeppelin_erc1155"` for Solidity; `"erc20"`, `"account"` for Cairo; `"fungible"` for Stellar; `"erc20"` for Stylus).
    *   `options: Record<string, any>`: Language and template-specific options (e.g., `{ name: "MyToken", symbol: "MTK", mintable: true }`).
    *   *(Type Definition: [`GenerateContractInput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*
*   **Returns (`Promise<string>`)**:
    *   A promise that resolves to a string containing the generated smart contract source code.

**Example (already shown in Basic Usage):**
```javascript
const erc20SourceInput: GenerateContractInput = {
  language: 'solidity',
  template: 'openzeppelin_erc20', // Example template
  options: {
    name: 'MyToken',
    symbol: 'MTK',
    premint: '1000',
    mintable: true,
    access: 'ownable'
  }
};
const contractSource: string = await contractHandler.generateContract(erc20SourceInput); // Renamed
```
---

### `compile(input: CompileInput): Promise<CompiledOutput>`

Compiles smart contract source code for a specific language.

*   **Purpose**: To transform human-readable smart contract code into executable bytecode and its corresponding ABI (Application Binary Interface).
*   **Arguments (`CompileInput`)**:
    *   `sourceCode: string`: The raw source code of the smart contract.
    *   `language: string`: The programming language of the source code (e.g., `"solidity"`, `"cairo"`). This helps the adapter select the appropriate compilation toolchain.
    *   `contractName?: string`: An optional hint for the main contract's name within the source code, especially if the source contains multiple contracts. This helps in identifying the primary artifact.
    *   `compilerOptions?: Record<string, any>`: Optional language or toolchain-specific compiler flags and settings (e.g., optimizer settings for Solidity, specific Cairo compiler flags).
    *   *(Type Definition: [`CompileInput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*
*   **Returns (`Promise<CompiledOutput>`)**:
    *   `artifacts: Record<string, any>`: A map where keys are artifact types and values are the corresponding content. Common keys include:
        *   `abi: any[]`: The JSON Application Binary Interface of the compiled contract.
        *   `bytecode: string`: The compiled EVM bytecode as a hexadecimal string (for Solidity).
        *   Other language-specific artifacts like `sierra` or `casm` for Cairo.
    *   `metadata?: Record<string, any>`: Optional metadata about the compilation, such as compiler version, actual contract name derived during compilation, or source file name.
    *   *(Type Definition: [`CompiledOutput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*

**Example (from Basic Usage):**
```javascript
// Assuming 'contractSource' from 'generateContract'
const compiledOutput = await contractHandler.compile({
  sourceCode: contractSource.sourceCode, // Or directly the string of the contract
  language: 'solidity',
  contractName: 'MyToken' // Optional: Name of the main contract
});
// compiledOutput.artifacts.abi and compiledOutput.artifacts.bytecode are now available.
console.log('ABI:', compiledOutput.artifacts.abi);
console.log('Bytecode:', compiledOutput.artifacts.bytecode);
```

---

### `deploy(input: DeployInput): Promise<DeployedOutput>`

Deploys a compiled smart contract to a compatible network.

*   **Purpose**: To take the compiled artifacts of a smart contract and publish it to a blockchain, making it live and interactive.
*   **Arguments (`DeployInput`)**:
    *   `compiledContract: CompiledOutput`: The output from the `compile` method, containing the `artifacts` (like ABI and bytecode) and optionally `metadata`.
    *   `constructorArgs?: any[]`: An array of arguments to pass to the contract's constructor during deployment. The order and types must match the constructor's signature.
    *   `wallet: IEVMWallet`: An instance of `IEVMWallet` (from `@m3s/wallet`). This is **required** for signing and sending the deployment transaction.
    *   `deployOptions?: Record<string, any>`: Optional chain-specific or transaction-specific options, such as gas limits (e.g., `gasLimit: "1500000"`), gas price, or other parameters relevant to the target network.
    *   *(Type Definition: [`DeployInput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*
*   **Returns (`Promise<DeployedOutput>`)**:
    *   `contractId: string`: A unique identifier for the deployed contract instance (e.g., the contract's address on EVM chains).
    *   `deploymentInfo?: object`: Optional information about the deployment transaction or process.
        *   `transactionId?: string`: The hash of the deployment transaction.
        *   `blockHeight?: number | string`: The block number or height in which the deployment transaction was included.
        *   Other chain-specific details can be included here.
    *   `contractInterface?: any`: Optional: The interface definition (e.g., ABI) that was used for deployment. This can be useful for immediate interaction without needing to fetch it again.
    *   *(Type Definition: [`DeployedOutput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*

**Example (from Basic Usage):**
```javascript
// Assuming 'compiledOutput' from 'compile' and 'wallet' is an initialized IEVMWallet
const deployerAddress = (await wallet.getAccounts())[0]; // Example: Get deployer address
const deployedContract = await contractHandler.deploy({
  compiledContract: compiledOutput, // Pass the entire CompiledOutput object
  constructorArgs: [deployerAddress], // Example: For an Ownable contract, initial owner
  wallet: wallet // Pass the IEVMWallet instance (required)
  // deployOptions: { gasLimit: "2000000" } // Optional deployment options
});
console.log(`Contract deployed at: ${deployedContract.contractId}`);
if (deployedContract.deploymentInfo?.transactionId) {
  console.log(`Deployment transaction hash: ${deployedContract.deploymentInfo.transactionId}`);
}
```

---

---

### `callMethod(input: CallInput): Promise<any>`

Calls a method on a deployed smart contract. This can be a read operation (view/pure) or a write operation (modifies state).

*   **Purpose**: To interact with deployed contracts by executing their functions.
*   **Arguments (`CallInput`)**:
    *   `contractId: string`: The address or identifier of the deployed contract.
    *   `functionName: string`: The name of the contract function to call.
    *   `args?: any[]`: An array of arguments to pass to the function.
    *   `wallet?: IEVMWallet`: An initialized wallet instance, required for write operations.
    *   `contractInterface?: any`: The ABI or interface definition of the contract.
    *   `callOptions?: Record<string, any>`: Optional parameters for the call (e.g., gas limits, value for payable functions).
    *   *(Type Definition: [`CallInput`](c:\Users\gunne\Desktop\CTB\M3S\ms3-package\packages\smart-contract\src\types\interfaces\base.ts) in `packages/smart-contract/src/types/interfaces/base.ts`)*
*   **Returns (`Promise<any>`)**:
    *   The result of the contract call. The structure depends on whether it's a read or write operation:
        *   For **read operations** (e.g., `view` or `pure` functions), it typically returns the direct value(s) from the contract function.
        *   For **write operations**, it typically returns an object like `{ transactionHash: string }` indicating the transaction was submitted.
    *   Users should inspect the result to determine its nature.

**Examples:**

*   **Reading data (e.g., ERC20 `balanceOf`)**:
    ```javascript
    // Assuming 'deployedContract' and 'compiledOutput' from previous steps
    const balanceResult = await contractHandler.callMethod({
      contractId: deployedContract.contractId,
      contractInterface: compiledOutput.artifacts.abi,
      functionName: 'balanceOf',
      args: [deployerAddress]
    });
    console.log(`Balance: ${ethers.formatUnits(balanceResult, 18)}`);
    ```

*   **Writing data (e.g., ERC20 `transfer`)**:
    ```javascript
    // Assuming 'deployedContract', 'compiledOutput', 'wallet', 'deployerAddress', 'otherAddress'
    const transferAmount = ethers.parseUnits("50", 18);
    const transferResult = await contractHandler.callMethod({
      contractId: deployedContract.contractId,
      contractInterface: compiledOutput.artifacts.abi,
      functionName: 'transfer',
      args: [otherAddress, transferAmount],
      wallet: wallet // Wallet is required
    });

    if (transferResult && transferResult.transactionHash) {
      console.log(`Transfer transaction sent: ${transferResult.transactionHash}`);
    } else {
      console.error('Transfer failed or did not return a transaction hash.');
    }
    ```

---

## Contract Features

### ERC20 Token Customization

| Feature   | Description                                               |
|-----------|-----------------------------------------------------------|
| name      | Token name (e.g., "My Token")                             |
| symbol    | Token symbol (e.g., "MTK")                                |
| premint   | Amount to mint to an address (often deployer) initially   |
| mintable  | Allow authorized accounts to mint new tokens              |
| burnable  | Allow token holders to burn their tokens                  |
| pausable  | Allow authorized accounts to pause transfers              |
| permit    | Enable ERC-2612 gasless approvals                         |
| votes     | Enable on-chain governance features (ERC20Votes)          |
| flashmint | Allow flash loans of the token (ERC20FlashMint)           |
| access    | Define access control ("ownable" or "roles") for features like mintable, pausable |

### ERC721 NFT Customization

| Feature     | Description                                               |
|-------------|-----------------------------------------------------------|
| name        | Collection name (e.g., "My NFTs")                         |
| symbol      | Collection symbol (e.g., "MNFT")                          |
| baseUri     | Base URI for token metadata (concatenated with token ID or specific URI part) |
| mintable    | Allow authorized accounts to mint new NFTs                |
| burnable    | Allow token holders to burn their NFTs                    |
| pausable    | Allow authorized accounts to pause transfers              |
| incremental | Use auto-incrementing sequential token IDs                |
| uriStorage  | Allow storing individual token URIs on-chain              |
| enumerable  | Enable enumeration of tokens and their owners             |
| votes       | Enable on-chain governance features (ERC721Votes)         |
| upgradeable | Make the contract upgradeable (e.g., "uups")              |
| access      | Define access control ("ownable" or "roles") for features like mintable, pausable |


### ERC1155 Multi-Token Customization

| Feature      | Description                                               |
|--------------|-----------------------------------------------------------|
| name         | Collection name (e.g., "My Multi-Tokens")                 |
| uri          | URI pattern for token metadata (e.g., "ipfs://.../{id}.json") |
| mintable     | Allow authorized accounts to mint new tokens/amounts      |
| burnable     | Allow token holders to burn their tokens                  |
| pausable     | Allow authorized accounts to pause transfers              |
| supply       | Track total supply for each token ID                      |
| updatableUri | Allow authorized accounts to update the base URI          |
| upgradeable  | Make the contract upgradeable (e.g., "uups")              |
| access       | Define access control ("ownable" or "roles") for features like mintable, pausable, updatableUri |

## Usage Examples

The following examples demonstrate how to use the `@m3s/smart-contract` package with the OpenZeppelin adapter to generate, compile, deploy, and interact with common smart contract types. These examples assume you have an EVM-compatible wallet (e.g., from `@m3s/wallet`) and a contract handler instance.

```javascript
import { 
  createContractHandler, 
  IBaseContractHandler, 
  GenerateContractInput, 
  GenerateContractOutput, 
  CompileInput, 
  CompiledOutput, 
  DeployInput, 
  DeployedOutput, 
  ContractCallInput, 
  ContractInteractionResult 
} from '@m3s/smart-contract';
import { 
  createWallet, 
  IEVMWallet, 
  IWalletOptions, 
  NetworkConfig 
} from '@m3s/wallet';
import { ethers } from 'ethers'; // For utility functions like formatUnits, parseUnits

// --- Helper: Initialize Wallet and Contract Handler ---
async function setup() {
  // 1. Setup Wallet (using @m3s/wallet)
  const walletOptions: IWalletOptions = {
    adapterName: 'ethers', // Example: using ethers adapter
    options: { 
      privateKey: 'YOUR_PRIVATE_KEY' // Replace with your private key for testing
    }
  };
  const wallet = await createWallet<IEVMWallet>(walletOptions);
  
  // Configure provider (e.g., Sepolia testnet)
  const networkConfig: NetworkConfig = { // Changed from providerConfig and type ProviderConfig
    rpcUrls: ['https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>'], // Replace with your RPC URL
    chainId: '0xaa36a7', // Sepolia chainId
    name: 'Sepolia', // Optional but good practice
    displayName: 'Sepolia Testnet' // Optional
    // ticker, tickerName, blockExplorer can also be added
  };
  
  await wallet.setProvider(networkConfig); // Connects the wallet to the network

  const deployerAddress = (await wallet.getAccounts())[0];
  if (!deployerAddress) {
    throw new Error("Could not get deployer address from wallet.");
  }
  console.log(`Using deployer address: ${deployerAddress}`);

  // 2. Initialize Contract Handler
  const contractHandler: IBaseContractHandler = await createContractHandler({
    adapterName: 'openZeppelin', // Assuming OpenZeppelin adapter
    options: {
      providerConfig: networkConfig, // Pass the NetworkConfig here
      preserveOutput: false // Set to true to keep generated files
    }
  });

  return { contractHandler, wallet, deployerAddress };
}

```

### Creating and Deploying an ERC20 Token

```javascript
async function deployERC20Token() {
  const { contractHandler, wallet, deployerAddress } = await setup();

  // 1. Generate an ERC20 contract source
  const tokenGenerateInput: GenerateContractInput = {
    language: 'solidity',
    template: 'openzeppelin_erc20', // Specify the template
    options: {
      name: "MyDemoToken",
      symbol: "MDT",
      premint: "1000000000000000000000000", // 1 million tokens with 18 decimals
      burnable: true,
      pausable: true,
      access: 'ownable' // For pausable and mintable (if added)
    }
  };
   const generatedSourceCode: string = await contractHandler.generateContract(tokenGenerateInput);
  console.log(`Generated ERC20 source code obtained for: ${(tokenGenerateInput.options as any).name}`); // Updated log message

  // 2. Compile the contract
  const compiled: CompiledOutput = await contractHandler.compile({
    sourceCode: generatedSourceCode,
    language: 'solidity',
    contractName: (tokenGenerateInput.options as any).name
  });
  
  console.log(`ERC20 '${compiled.metadata?.contractName || (tokenGenerateInput.options as any).name}' compiled. ABI available.`); // Updated log

  // 3. Deploy the contract
  // For an Ownable contract with premint, constructor often takes initialOwner (for Ownable) 
  // and recipient (for premint). If premint goes to initialOwner, it might be [deployerAddress, deployerAddress]
  // or just [deployerAddress] depending on the exact generated constructor.
  // The test '03_ERC20.test.ts' uses [deployerAddress, deployerAddress] for its 'ComprehensiveToken'.
  const constructorArgs = [deployerAddress, deployerAddress]; 

  const deployed: DeployedOutput = await contractHandler.deploy({
    compiledContract: compiled,
    constructorArgs: constructorArgs,
    wallet: wallet // Pass the wallet instance
  });
  console.log(`ERC20 Token deployed at: ${deployed.contractId}, Tx: ${deployed.deploymentInfo?.transactionId}`);

  // 4. Interact with the contract
  // Example: Get total supply (a read operation)
  const totalSupplyResult: any = await contractHandler.callMethod({
    contractId: deployed.contractId,
    contractInterface: compiled.artifacts.abi,
    functionName: 'totalSupply',
    args: []
    // wallet is optional for read-only calls if provider is clear from handler/contractId
  });
  // For read operations, the result is typically the direct value.
  // You might need to format it based on the contract's return type (e.g., for BigInts).
  console.log(`Total Supply (raw): ${totalSupplyResult}`);
  if (totalSupplyResult !== undefined && typeof totalSupplyResult.toString === 'function') {
    console.log(`Total Supply (formatted): ${ethers.formatUnits(totalSupplyResult.toString(), 18)}`); // Assuming 18 decimals
  }


  // Example: Mint tokens (a write operation)
  // Ensure 'mint' function exists and deployerAddress is the owner/minter
  const mintAmount = ethers.parseUnits("100", 18); // Mint 100 tokens
  const mintResult: any = await contractHandler.callMethod({
    contractId: deployed.contractId,
    contractInterface: compiled.artifacts.abi,
    functionName: 'mint', // Assuming 'mint(address to, uint256 amount)'
    args: [deployerAddress, mintAmount],
    wallet: wallet // Wallet is required for write operations
  });

  // For write operations, the result is typically an object with a transactionHash.
  if (mintResult && mintResult.transactionHash) {
    console.log(`Mint transaction sent. Hash: ${mintResult.transactionHash}`);
    // Optionally, wait for the transaction receipt using the wallet instance
    // const receipt = await wallet.getTransactionReceipt(mintResult.transactionHash);
    // if (receipt && receipt.status === 1) {
    //   console.log('Minting successful!');
    // } else {
    //   console.error('Minting failed or receipt not found.');
    // }
  } else {
    console.error('Minting did not return a transaction hash. Result:', mintResult);
  }
}

// deployERC20Token().catch(console.error);
```

### Creating and Deploying an NFT Collection (ERC721)

```javascript
async function deployERC721Collection() {
  const { contractHandler, wallet, deployerAddress } = await setup();

  // 1. Generate an ERC721 NFT contract source
  const nftGenerateInput: GenerateContractInput = {
    language: 'solidity',
    template: 'openzeppelin_erc721', // Specify the template
    options: {
      name: "MyAwesomeNFTs",
      symbol: "MANFT",
      baseUri: "ipfs://YOUR_METADATA_CID_BASE/", // Replace with your actual base URI
      mintable: true,       // Allow owner to mint
      uriStorage: true,     // Store token URIs on-chain
      incremental: true,    // Auto-incrementing token IDs
      access: 'ownable'     // Owner can mint
    }
  };
  const generatedSource: GenerateContractOutput = await contractHandler.generate(nftGenerateInput);
  console.log(`Generated ERC721: ${generatedSource.contractName}`);

  // 2. Compile the contract
  const compiled: CompiledOutput = await contractHandler.compile({
    sourceCode: generatedSource.sourceCode,
    language: 'solidity',
    contractName: generatedSource.contractName
  });
  console.log('ERC721 compiled. ABI available.');

  // 3. Deploy the contract
  // Ownable ERC721 typically takes initialOwner as constructor arg
  const constructorArgs = [deployerAddress];
  const deployed: DeployedOutput = await contractHandler.deploy({
    compiledContract: compiled,
    constructorArgs: constructorArgs,
    wallet: wallet
  });
  console.log(`NFT Collection deployed at: ${deployed.contractId}, Tx: ${deployed.deploymentInfo?.transactionId}`);

  // 4. Interact with the contract (e.g., mint an NFT)
  const recipientAddress = deployerAddress; // Minting to self for example
  const tokenUriSuffix = "1.json"; // Suffix for the token's metadata URI (if uriStorage is true)
  // For incremental, token ID is usually handled by the contract. 
  // The safeMint function for OZ Wizard generated incremental + URIStorage often takes (to, uri_suffix)
  
  const mintResult = await contractHandler.callMethod({
    contractId: deployed.contractId,
    contractInterface: compiled.artifacts.abi,
    functionName: 'safeMint', // Common minting function
    args: [recipientAddress, tokenUriSuffix], 
    wallet: wallet // Wallet is required for write operations
  });

  if (mintResult.success && mintResult.transactionHash) {
    console.log(`NFT Mint transaction submitted: ${mintResult.transactionHash}`);
    // You would typically wait for the transaction receipt here in a real application
    // const receipt = await wallet.getTransactionReceipt(mintResult.transactionHash);
    // console.log('Mint successful, receipt status:', receipt?.status);
  } else {
    console.error('Error submitting mint transaction:', mintResult.error);
  }
}

// deployERC721Collection().catch(console.error);
```

### Creating and Deploying a Multi-Token Collection (ERC1155)

```javascript
async function deployERC1155Collection() {
  const { contractHandler, wallet, deployerAddress } = await setup();

  // 1. Generate an ERC1155 contract source
  const multiTokenGenerateInput: GenerateContractInput = {
    language: 'solidity',
    template: 'openzeppelin_erc1155', // Specify the template
    options: {
      name: "MyGameItems",
      uri: "ipfs://YOUR_GAME_ITEMS_CID/{id}.json", // URI pattern, {id} is replaced by token ID
      mintable: true,
      burnable: true,
      supply: true,         // Track total supply for each token ID
      access: "ownable"     // Owner can mint/pause etc.
    }
  };
  const generatedSource: GenerateContractOutput = await contractHandler.generate(multiTokenGenerateInput);
  console.log(`Generated ERC1155: ${generatedSource.contractName}`);

  // 2. Compile the contract
  const compiled: CompiledOutput = await contractHandler.compile({
    sourceCode: generatedSource.sourceCode,
    language: 'solidity',
    contractName: generatedSource.contractName
  });
  console.log('ERC1155 compiled. ABI available.');

  // 3. Deploy the contract
  // Ownable ERC1155 typically takes initialOwner as constructor arg
  const constructorArgs = [deployerAddress];
  const deployed: DeployedOutput = await contractHandler.deploy({
    compiledContract: compiled,
    constructorArgs: constructorArgs,
    wallet: wallet
  });
  console.log(`Multi-Token Collection deployed at: ${deployed.contractId}, Tx: ${deployed.deploymentInfo?.transactionId}`);

  // 4. Interact with the contract (e.g., mint multiple tokens)
  const recipientAddress = deployerAddress;
  const tokenIds = [1, 2, 3];                       // Token IDs to mint
  const amounts = [100, 50, 1];                     // Amounts for each token ID
  const data = "0x";                                // Optional data field

  const mintBatchResult = await contractHandler.callMethod({
    contractId: deployed.contractId,
    contractInterface: compiled.artifacts.abi,
    functionName: 'mintBatch',
    args: [recipientAddress, tokenIds, amounts, data],
    wallet: wallet // Wallet is required for write operations
  });

  if (mintBatchResult.success && mintBatchResult.transactionHash) {
    console.log(`Mint Batch transaction submitted: ${mintBatchResult.transactionHash}`);
    // const receipt = await wallet.getTransactionReceipt(mintBatchResult.transactionHash);
    // console.log('Mint Batch successful, receipt status:', receipt?.status);
  } else {
    console.error('Error submitting mint batch transaction:', mintBatchResult.error);
  }
}

// deployERC1155Collection().catch(console.error);
```

## API Reference

This section details the core methods provided by the `createContractHandler` factory and the `IBaseContractHandler` interface (typically implemented by an adapter like `OpenZeppelinAdapter`).

### Main Package Export

| Function                 | Arguments                                  | Returns                         | Description                                                                 |
|--------------------------|--------------------------------------------|---------------------------------|-----------------------------------------------------------------------------|
| `createContractHandler()`| `params: IContractOptions`                 | `Promise<IBaseContractHandler>` | Creates and initializes a new smart contract adapter instance.              |

### `IBaseContractHandler` Interface Methods

These methods are available on the instance returned by `createContractHandler()`.

| Method                 | Arguments                               | Returns                                  | Description                                                                    |
|------------------------|-----------------------------------------|------------------------------------------|--------------------------------------------------------------------------------|
| `generateContract()`   | `input: GenerateContractInput`          | `Promise<string>`                        | Generates smart contract source code.                                          |
| `compile()`            | `input: CompileInput`                   | `Promise<CompiledOutput>`                | Compiles smart contract source code.                                           |
| `deploy()`             | `input: DeployInput`                    | `Promise<DeployedOutput>`                | Deploys a compiled smart contract.                                             |
| `callMethod()`         | `input: ContractCallInput`              | `Promise<ContractInteractionResult>`     | Calls a method on a deployed contract. Wraps read/write operation results.     |

---

### Additional Features

- **Automated Gas Estimation**: The library handles gas estimation for you.
- **Error Handling**: Clear error messages for common contract operations.
- **Network Detection**: Automatically adapts to the connected network.
- **Contract Verification**: Generate contract source code suitable for block explorer verification.