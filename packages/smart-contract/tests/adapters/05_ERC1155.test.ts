import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../src/index.js';
import { CompiledOutput, DeployedOutput, IBaseContractHandler } from '../../src/types/index.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS } from '../../config.js';

// Provider for testnet interactions
const getTestProvider = () => {
  return new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
};

// Test ERC1155 options
describe('ERC1155 Options Tests', () => {
  let contractHandler: IBaseContractHandler;

  beforeEach(async () => {
    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'contracts'),
        preserveOutput: true,
      }
    });

    await contractHandler.initialize();
  });

  it('should generate basic ERC1155 with required options', async () => {
    // Test basic required options (name and URI)
    const basicSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'BasicMultiToken',
        uri: 'ipfs://QmMultiToken/{id}.json'
      }
    });

    expect(basicSource).toContain('contract BasicMultiToken is ERC1155');
    expect(basicSource).toContain('ipfs://QmMultiToken/{id}.json');

    // Basic ERC1155 should NOT have these features
    expect(basicSource).not.toContain('import {ERC1155Burnable}');
    expect(basicSource).not.toContain('import {ERC1155Pausable}');
    expect(basicSource).not.toContain('import {ERC1155Supply}');
  });

  it('should generate ERC1155 with burnable feature', async () => {
    const burnableSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'BurnableMultiToken',
        uri: 'ipfs://QmBurnToken/{id}.json',
        burnable: true
      }
    });

    expect(burnableSource).toContain('import {ERC1155Burnable}');
    expect(burnableSource).toContain('ERC1155Burnable');
  });

  it('should generate ERC1155 with pausable feature', async () => {
    const pausableSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'PausableMultiToken',
        uri: 'ipfs://QmPauseToken/{id}.json',
        pausable: true,
        access: 'ownable'
      }
    });

    expect(pausableSource).toContain('import {ERC1155Pausable}');
    expect(pausableSource).toContain('ERC1155Pausable');
    expect(pausableSource).toContain('function pause()');
    expect(pausableSource).toContain('function unpause()');
  });

  it('should generate ERC1155 with supply tracking', async () => {
    const supplySource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'SupplyMultiToken',
        uri: 'ipfs://QmSupplyToken/{id}.json',
        supply: true
      }
    });

    expect(supplySource).toContain('import {ERC1155Supply}');
    expect(supplySource).toContain('ERC1155Supply');
  });

  it('should generate ERC1155 with updatable URI', async () => {
    const updatableUriSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'UpdatableUriToken',
        uri: 'ipfs://QmBaseToken/{id}.json',
        updatableUri: true,
        access: 'ownable'
      }
    });

    expect(updatableUriSource).toContain('function setURI');
  });

  it('should generate ERC1155 with mintable feature', async () => {
    const mintableSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'MintableMultiToken',
        uri: 'ipfs://QmMintToken/{id}.json',
        mintable: true,
        access: 'ownable'
      }
    });

    expect(mintableSource).toContain('function mint(');
    expect(mintableSource).toContain('function mintBatch(');
    expect(mintableSource).toContain('onlyOwner');
  });

  it('should generate ERC1155 with custom access control', async () => {
    // Test roles
    const rolesSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'RolesMultiToken',
        uri: 'ipfs://QmRolesToken/{id}.json',
        mintable: true,
        access: 'roles'
      }
    });

    expect(rolesSource).toContain('import {AccessControl}');
    expect(rolesSource).toContain('MINTER_ROLE');
    expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');

    // Test ownable
    const ownableSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'OwnableMultiToken',
        uri: 'ipfs://QmOwnableToken/{id}.json',
        mintable: true,
        access: 'ownable'
      }
    });

    expect(ownableSource).toContain('import {Ownable}');
    expect(ownableSource).toContain('onlyOwner');
  });

  it('should generate ERC1155 with multiple features combined', async () => {
    const complexSource = await contractHandler.generateContract({
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

    // Check for all features in the combined token
    expect(complexSource).toContain('import {ERC1155');
    expect(complexSource).toContain('import {ERC1155Burnable}');
    expect(complexSource).toContain('import {ERC1155Pausable}');
    expect(complexSource).toContain('import {ERC1155Supply}');
    expect(complexSource).toContain('contract ComplexMultiToken is ERC1155');
    expect(complexSource).toContain('function mint(');
    expect(complexSource).toContain('function mintBatch(');
    expect(complexSource).toContain('function pause()');
    expect(complexSource).toContain('function unpause()');
    expect(complexSource).toContain('function setURI');
  });

  it('should generate ERC1155 with upgradeability', async () => {
    const upgradeableSource = await contractHandler.generateContract({
      standard: 'ERC1155',
      options: {
        name: 'UpgradeableMultiToken',
        uri: 'ipfs://QmUpgradeToken/{id}.json',
        upgradeable: 'uups',
        access: 'ownable'
      }
    });

    expect(upgradeableSource).toContain('import {ERC1155Upgradeable}');
    expect(upgradeableSource).toContain('UUPSUpgradeable');
    expect(upgradeableSource).toContain('initialize');
  });
});

// Full integration tests for real blockchain deployment
(RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full ERC1155 Integration Tests', () => {
  let signer: ethers.Wallet;
  let contractHandler: IBaseContractHandler;
  let provider: ethers.Provider;

  beforeEach(async () => {
    provider = getTestProvider();
    signer = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc1155'), // Use unique test dir
        preserveOutput: true,
        providerConfig: { rpcUrl: (provider as any).connection?.url || 'https://ethereum-sepolia-rpc.publicnode.com' } // Pass provider config for reads
      }
    });
    // Initialization is handled by createContractHandler -> OpenZeppelinAdapter.create
  });

  it('should deploy ERC1155 with multiple features and verify functionality', async () => {
    console.log('🚀 Starting comprehensive ERC1155 test');

    // 1. Generate contract
    console.log('1️⃣ Generating feature-rich ERC1155 contract...');
    const contractSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc1155',
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
    const deployerAddress = await signer.getAddress();
    const constructorArgs: any[] = []; // No explicit constructor args needed for standard Ownable OZ template
    const deployed: DeployedOutput = await contractHandler.deploy({
        compiledContract: compiled,
        constructorArgs: constructorArgs,
        wallet: signer
    });
    console.log(`Contract deployed at: ${deployed.contractId}`);
    expect(deployed.contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // --- Test Features ---
    const contractId = deployed.contractId;
    const contractAbi = compiled.artifacts.abi;

    // 4. Test single token minting (write)
    console.log('4️⃣ Testing single token minting...');
    const tokenId = 1;
    const amount = 100;
    const mintResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'mint',
        args: [deployerAddress, tokenId, amount, "0x"],
        wallet: signer
    });
    const mintReceipt = await provider.waitForTransaction(mintResult.transactionHash, 1, 60000);
    expect(mintReceipt?.status).toBe(1);
    console.log('✅ Single token minted successfully');

    // Check balance (read)
    const balance = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOf',
        args: [deployerAddress, tokenId]
    });
    expect(Number(balance)).toBe(amount);
    console.log(`Token balance verified: ${balance}`);

    // 5. Test supply tracking (read)
    console.log('5️⃣ Testing supply tracking...');
    const totalSupply = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        // Note: OZ Wizard Supply extension uses 'totalSupply(uint256)'
        functionName: 'totalSupply', // Correct function name if using OZ standard extension
        args: [tokenId]
    });
    expect(Number(totalSupply)).toBe(amount);
    console.log(`Token supply verified: ${totalSupply}`);

    const exists = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'exists',
        args: [tokenId]
    });
    expect(exists).toBe(true);
    console.log('✅ Supply tracking feature verified');

    // 6. Test batch minting (write)
    console.log('6️⃣ Testing batch token minting...');
    const batchTokenIds = [2, 3, 4];
    const batchAmounts = [200, 300, 400];
    const batchMintResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'mintBatch',
        args: [deployerAddress, batchTokenIds, batchAmounts, "0x"],
        wallet: signer
    });
    const batchMintReceipt = await provider.waitForTransaction(batchMintResult.transactionHash, 1, 60000);
    expect(batchMintReceipt?.status).toBe(1);
    console.log(`✅ Batch tokens minted successfully`);

    // Check batch balances (read)
    const batchBalancesResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOfBatch',
        args: [Array(batchTokenIds.length).fill(deployerAddress), batchTokenIds]
    });
    const batchBalances = batchBalancesResult.map(Number);
    expect(batchBalances).toEqual(batchAmounts);
    console.log(`Batch token balances verified: ${batchBalances}`);

    // 7. Test setURI (write)
    console.log('7️⃣ Testing setURI functionality...');
    const newURI = 'ipfs://QmNewURI/{id}.json';
    const setURIResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'setURI',
        args: [newURI],
        wallet: signer
    });
    const setURIReceipt = await provider.waitForTransaction(setURIResult.transactionHash, 1, 60000);
    expect(setURIReceipt?.status).toBe(1);

    // Verify URI (read)
    const newTokenURI = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'uri',
        args: [tokenId] // Pass a token ID
    });
    expect(newTokenURI).toBe(newURI);
    console.log('✅ URI updated successfully');

    // 8. Test pause functionality (write)
    console.log('8️⃣ Testing pause functionality...');
    const pauseResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'pause',
        args: [],
        wallet: signer
    });
    const pauseReceipt = await provider.waitForTransaction(pauseResult.transactionHash, 1, 60000);
    expect(pauseReceipt?.status).toBe(1);

    const pausedState = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'paused',
        args: []
    });
    expect(pausedState).toBe(true);
    console.log('✅ Contract successfully paused');

    // 9. Test unpause (write)
    console.log('9️⃣ Testing unpause functionality...');
    const unpauseResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'unpause',
        args: [],
        wallet: signer
    });
    const unpauseReceipt = await provider.waitForTransaction(unpauseResult.transactionHash, 1, 60000);
    expect(unpauseReceipt?.status).toBe(1);

    const unpausedState = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'paused',
        args: []
    });
    expect(unpausedState).toBe(false);
    console.log('✅ Contract successfully unpaused');

    // 10. Test burning (write)
    console.log('🔟 Testing burn functionality...');
    const burnAmount = 50;
    const burnResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'burn',
        args: [deployerAddress, tokenId, burnAmount],
        wallet: signer
    });
    const burnReceipt = await provider.waitForTransaction(burnResult.transactionHash, 1, 60000);
    expect(burnReceipt?.status).toBe(1);

    const afterBurnBalance = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOf',
        args: [deployerAddress, tokenId]
    });
    expect(Number(afterBurnBalance)).toBe(amount - burnAmount);
    console.log(`✅ Token successfully burned. New balance: ${afterBurnBalance}`);

    // 11. Test batch burning (write)
    console.log('1️⃣1️⃣ Testing batch burn functionality...');
    const batchBurnAmounts = [10, 15, 20]; // Burn partial amounts
    const batchBurnResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'burnBatch',
        args: [deployerAddress, batchTokenIds, batchBurnAmounts],
        wallet: signer
    });
    const batchBurnReceipt = await provider.waitForTransaction(batchBurnResult.transactionHash, 1, 60000);
    expect(batchBurnReceipt?.status).toBe(1);

    // Check remaining balances (read)
    const afterBatchBurnBalancesResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOfBatch',
        args: [Array(batchTokenIds.length).fill(deployerAddress), batchTokenIds]
    });
    const afterBatchBurnBalances = afterBatchBurnBalancesResult.map(Number);
    const expectedAfterBurn = batchAmounts.map((amt, i) => amt - batchBurnAmounts[i]);
    expect(afterBatchBurnBalances).toEqual(expectedAfterBurn);
    console.log(`✅ Batch tokens successfully burned. New balances: ${afterBatchBurnBalances}`);

    console.log('✨ All testable ERC1155 features verified successfully!');

  }, 300000);// Longer timeout for blockchain interaction
});