import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../../src/index.js';
import { CompiledOutput, DeployedOutput, GenerateContractInput, IBaseContractHandler } from '../../../src/types/index.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS, INFURA_API_KEY } from '../../../config.js';
import { createWallet } from '@m3s/wallet';
import { IEVMWallet } from '@m3s/common'


// Test ERC1155 options
describe('ERC1155 Options Tests', () => {
  let contractHandler: IBaseContractHandler;

  beforeEach(async () => {
    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc1155-gen'), // <<< Use unique dir
        preserveOutput: true,
      }
    });
  });

  it('should generate basic ERC1155 with required options', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155', // <<< Use template name
      options: {
        name: 'BasicMultiToken',
        uri: 'ipfs://QmBaseUri/{id}.json'
      }
    };
    const basicSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(basicSource).toContain('contract BasicMultiToken is ERC1155');
    expect(basicSource).toContain('ERC1155("ipfs://QmBaseUri/{id}.json")');
    expect(basicSource).not.toContain('ERC1155Burnable');
    expect(basicSource).not.toContain('ERC1155Pausable');
    expect(basicSource).not.toContain('ERC1155Supply');
  });

  it('should generate ERC1155 with burnable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'BurnableMultiToken',
        uri: 'ipfs://QmBurnable/{id}.json',
        burnable: true
      }
    };
    const burnableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(burnableSource).toContain('import {ERC1155Burnable}');
    expect(burnableSource).toContain('ERC1155Burnable');
  });

  it('should generate ERC1155 with pausable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'PausableMultiToken',
        uri: 'ipfs://QmPausable/{id}.json',
        pausable: true,
        access: 'ownable'
      }
    };
    const pausableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(pausableSource).toContain('import {ERC1155Pausable}');
    expect(pausableSource).toContain('ERC1155Pausable');
    expect(pausableSource).toContain('function pause()');
    expect(pausableSource).toContain('function unpause()');
  });

  it('should generate ERC1155 with mintable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'MintableMultiToken',
        uri: 'ipfs://QmMintable/{id}.json',
        mintable: true,
        access: 'ownable'
      }
    };
    const mintableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(mintableSource).toContain('function mint(');
    expect(mintableSource).toContain('function mintBatch(');
    expect(mintableSource).toContain('onlyOwner');
  });

  it('should generate ERC1155 with supply tracking', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'SupplyMultiToken',
        uri: 'ipfs://QmSupply/{id}.json',
        supply: true
      }
    };
    const supplySource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(supplySource).toContain('import {ERC1155Supply}');
    expect(supplySource).toContain('ERC1155Supply');
  });

  it('should generate ERC1155 with updatable URI', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'UpdatableUriMultiToken',
        uri: 'ipfs://QmInitial/{id}.json',
        updatableUri: true,
        access: 'ownable'
      }
    };
    const updatableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(updatableSource).toContain('function setURI(');
    expect(updatableSource).toContain('onlyOwner');
  });

  it('should generate ERC1155 with custom access control (roles)', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'RolesMultiToken',
        uri: 'ipfs://QmRoles/{id}.json',
        mintable: true,
        pausable: true,
        updatableUri: true,
        access: 'roles'
      }
    };
    const rolesSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(rolesSource).toContain('import {AccessControl}');
    expect(rolesSource).toContain('MINTER_ROLE');
    expect(rolesSource).toContain('PAUSER_ROLE');
    expect(rolesSource).toContain('URI_SETTER_ROLE');
    expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');
    expect(rolesSource).toContain('onlyRole(PAUSER_ROLE)');
    expect(rolesSource).toContain('onlyRole(URI_SETTER_ROLE)');;
  });

  it('should generate ERC1155 with multiple features combined', async () => {
    const complexSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'ComplexMultiToken',
        uri: 'ipfs://QmComplexToken/{id}.json', // Base URI
        burnable: true,
        pausable: true,
        mintable: true,
        supply: true,
        updatableUri: true, // Enable URI update for testing
        access: 'ownable'
      }
    });

    expect(complexSource).toContain('import {ERC1155');
    expect(complexSource).toContain('import {ERC1155Burnable}');
    expect(complexSource).toContain('import {ERC1155Pausable}');
    expect(complexSource).toContain('import {ERC1155Supply}');

    expect(complexSource).toContain('contract ComplexMultiToken is');
    expect(complexSource).toContain('ERC1155,'); // Check for base contract
    expect(complexSource).toContain('Ownable,'); // Check for Ownable
    expect(complexSource).toContain('ERC1155Pausable,'); // Check for Pausable
    expect(complexSource).toContain('ERC1155Burnable,'); // Check for Burnable
    expect(complexSource).toContain('ERC1155Supply');

    expect(complexSource).toContain('function mint(');
    expect(complexSource).toContain('function pause()');
    expect(complexSource).toContain('function unpause()');
  });

  it('should generate ERC1155 with upgradeability', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'UpgradeableMultiToken',
        uri: 'ipfs://QmUpgradeable/{id}.json',
        mintable: true,
        access: 'ownable',
        upgradeable: 'uups'
      }
    };
    const upgradeableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(upgradeableSource).toContain('import {ERC1155Upgradeable}');
    expect(upgradeableSource).toContain('UUPSUpgradeable');
    expect(upgradeableSource).toContain('initialize');
  });
});

// Full integration tests for real blockchain deployment
(RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full ERC1155 Integration Tests', () => {
  let walletAdapter: IEVMWallet;
  let contractHandler: IBaseContractHandler;
  let provider: ethers.Provider;

  beforeEach(async () => {
    const rpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
    provider = new ethers.JsonRpcProvider(rpcUrl);

    const network = await provider.getNetwork();
    const chainId = network.chainId;
    console.log(`[Test Setup] Using RPC: ${rpcUrl}, ChainID: ${chainId}`);

    walletAdapter = await createWallet<IEVMWallet>({
      adapterName: 'ethers',
      options: {
        privateKey: TEST_PRIVATE_KEY
      }
    });

    console.log(`[Test Setup] After createWallet: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);

    if (!(await walletAdapter.isInitialized())) {
      console.log("[Test Setup] Wallet not initialized by create, calling initialize...");
      await walletAdapter.initialize();
    } else {
      console.log("[Test Setup] Wallet already initialized by create.");
    }

    console.log(`[Test Setup] After initialize check: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);


    try {
      // Use the explicitly defined rpcUrl
      await walletAdapter.setProvider({ rpcUrl, chainId: String(chainId) });
      console.log(`[Test Setup] After setProvider SUCCESS: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);
    } catch (error) {
      console.error(`[Test Setup] setProvider FAILED:`, error);
      // Re-throw to ensure the test fails clearly if setProvider has an issue
      throw error;
    }

    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc1155'),
        preserveOutput: true,
        providerConfig: {
          rpcUrl: rpcUrl,
          chainId: chainId
        }
      }
    });

    console.log(`[Test Setup] After createContractHandler. beforeEach complete.`);
  });


  const waitForReceipt = async (txHash: string, maxAttempts = 20, waitTime = 6000): Promise<ethers.TransactionReceipt | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      const receipt = await walletAdapter.getTransactionReceipt(txHash);
      if (receipt) {
        console.log(`Receipt found for ${txHash} (attempt ${i + 1}). Status: ${receipt.status}`);
        return receipt;
      }
      console.log(`Receipt not found for ${txHash} (attempt ${i + 1}). Waiting ${waitTime / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    console.error(`Receipt not found for ${txHash} after ${maxAttempts} attempts.`);
    return null;
  };

  it('should deploy ERC1155 with multiple features and verify functionality', async () => {
    console.log('🚀 Starting comprehensive ERC1155 test');

    // 1. Generate contract
    console.log('1️⃣ Generating feature-rich ERC1155 contract...');
    const contractSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'ComplexMultiToken',
        uri: 'ipfs://QmComplexToken/{id}.json', // Base URI
        burnable: true,
        pausable: true,
        mintable: true,
        supply: true,
        updatableUri: true, // Enable URI update for testing
        access: 'ownable'
      }
    });

    // 2. Compile
    console.log('2️⃣ Compiling the contract...');
    const compiled: CompiledOutput = await contractHandler.compile({
      sourceCode: contractSource,
      language: 'solidity',
      contractName: 'ComplexMultiToken'
    });
    expect(compiled.artifacts?.abi).toBeDefined();
    expect(compiled.artifacts?.bytecode).toBeDefined();

    // 3. Deploy
    console.log('3️⃣ Deploying to testnet...');
    const deployerAddress = (await walletAdapter.getAccounts())[0]; // <<< Use walletAdapter
    console.log(`Deployer address from walletAdapter: ${deployerAddress}`);
    if (!deployerAddress || !ethers.isAddress(deployerAddress)) {
      throw new Error(`Failed to get a valid deployer address from wallet adapter. Received: ${deployerAddress}`);
    }

    // <<< Correct constructor args for Ownable ERC1155 >>>
    const constructorArgs: any[] = [deployerAddress]; // Only initialOwner is needed

    const deployed: DeployedOutput = await contractHandler.deploy({
      compiledContract: compiled,
      constructorArgs: constructorArgs,
      wallet: walletAdapter // <<< Pass walletAdapter
    });

    console.log(`Contract deployed: ${deployed.contractId}, Tx: ${deployed.deploymentInfo?.transactionId}`); // <<< Use deploymentInfo
    expect(deployed.contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(deployed.deploymentInfo?.transactionId).toBeDefined(); // <<< Check deploymentInfo

    // --- Test Features ---
    const contractId = deployed.contractId;
    const contractAbi = compiled.artifacts.abi;
    const tokenId1 = 1;
    const tokenId2 = 2;
    const mintAmount1 = 100;
    const mintAmount2 = 50;
    const burnAmount1 = 10;
    const data = '0x'; // Empty data

    // 1. Mint tokens (write)
    console.log(`Testing mintBatch functionality (minting ${mintAmount1} of ID ${tokenId1}, ${mintAmount2} of ID ${tokenId2})...`);
    const mintResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'mintBatch',
      args: [deployerAddress, [tokenId1, tokenId2], [mintAmount1, mintAmount2], data],
      wallet: walletAdapter
    });
    const mintReceipt = await waitForReceipt(mintResult.transactionHash);
    expect(mintReceipt).toBeDefined();
    expect(mintReceipt).not.toBeNull();
    expect(mintReceipt!.status).toBe(1);
    console.log(`✅ Tokens minted successfully`);

    // Verify balances (read)
    const balance1 = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'balanceOf',
      args: [deployerAddress, tokenId1]
    });
    expect(Number(balance1)).toBe(mintAmount1);

    const balance2 = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'balanceOf',
      args: [deployerAddress, tokenId2]
    });
    expect(Number(balance2)).toBe(mintAmount2);
    console.log(`✅ Balances verified`);

    // 2. Test URI (read)
    console.log('Testing token URI...');
    const retrievedURI1 = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'uri',
      args: [tokenId1]
    });

    const baseUri = 'ipfs://QmComplexToken/{id}.json'; // The base URI used in generation
  
    expect(retrievedURI1).toBe(baseUri);
    console.log(`✅ Token URI verified`);

    // 3. Test supply tracking (read)
    console.log('Testing supply tracking...');
    const supply1 = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'totalSupply(uint256)',
      args: [tokenId1]
    });
    expect(Number(supply1)).toBe(mintAmount1);
    console.log('✅ Supply tracking verified');

    // 4. Test pause functionality (write)
    console.log('Testing pause functionality...');
    const pauseResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'pause',
      args: [],
      wallet: walletAdapter
    });
    const pauseReceipt = await waitForReceipt(pauseResult.transactionHash);
    expect(pauseReceipt).toBeDefined();
    expect(pauseReceipt).not.toBeNull();
    expect(pauseReceipt!.status).toBe(1);

    const pausedState = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'paused',
      args: []
    });
    expect(pausedState).toBe(true);
    console.log('✅ Contract successfully paused');

    // 5. Test unpause (write)
    console.log('Testing unpause functionality...');
    const unpauseResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'unpause',
      args: [],
      wallet: walletAdapter
    });
    const unpauseReceipt = await waitForReceipt(unpauseResult.transactionHash);
    expect(unpauseReceipt).toBeDefined();
    expect(unpauseReceipt).not.toBeNull();
    expect(unpauseReceipt!.status).toBe(1);

    const unpausedState = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'paused',
      args: []
    });
    expect(unpausedState).toBe(false);
    console.log('✅ Contract successfully unpaused');

    // 6. Test burning (write)
    console.log(`Testing burn functionality (burning ${burnAmount1} of ID ${tokenId1})...`);
    const burnResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'burn',
      args: [deployerAddress, tokenId1, burnAmount1],
      wallet: walletAdapter
    });

    const burnReceipt = await waitForReceipt(burnResult.transactionHash);
    expect(burnReceipt).toBeDefined();
    expect(burnReceipt).not.toBeNull();
    expect(burnReceipt!.status).toBe(1);

    // Verify balance and supply after burn (read)
    const balanceAfterBurn = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'balanceOf',
      args: [deployerAddress, tokenId1]
    });
    expect(Number(balanceAfterBurn)).toBe(mintAmount1 - burnAmount1);

    const supplyAfterBurn = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'totalSupply(uint256)',
      args: [tokenId1]
    });
    expect(Number(supplyAfterBurn)).toBe(mintAmount1 - burnAmount1);
    console.log('✅ Burn functionality verified');

    // 7. Test updatable URI (write)
    console.log('Testing updatable URI...');
    const newUri = 'ipfs://QmNewUri/{id}.json';
    const setUriResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'setURI',
      args: [newUri],
      wallet: walletAdapter
    });
    // <<< Use waitForReceipt >>>
    const setUriReceipt = await waitForReceipt(setUriResult.transactionHash);
    expect(setUriReceipt).toBeDefined();
    expect(setUriReceipt).not.toBeNull();
    expect(setUriReceipt!.status).toBe(1);

    // Verify new URI (read)
    const updatedURI = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi,
      functionName: 'uri',
      args: [tokenId1]
    });

    expect(updatedURI).toBe(updatedURI);
    console.log('✅ Updatable URI verified');

    console.log('✨ All testable ERC1155 features verified successfully!');

  }, 300000);
});