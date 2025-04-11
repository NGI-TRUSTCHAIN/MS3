import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../src/index.js';
import { IBaseContractHandler } from '../../src/types/index.js';
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

  beforeEach(async () => {
    const provider = getTestProvider();
    signer = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'contracts'),
        preserveOutput: true,
      }
    });
  });

  it('should deploy ERC1155 with multiple features and verify functionality', async () => {
    console.log('🚀 Starting comprehensive ERC1155 test');

    // Generate contract with multiple features
    console.log('1️⃣ Generating feature-rich ERC1155 contract...');
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

    // Compile
    console.log('2️⃣ Compiling the contract...');
    const compiled = await contractHandler.compile(contractSource);

    // Prepare constructor args
    const deployerAddress = await signer.getAddress();
    const constructorArgs = [deployerAddress]; // Initial owner for ownable

    // Deploy
    console.log('3️⃣ Deploying to testnet...');
    const deployed = await contractHandler.deploy(compiled, constructorArgs, signer);
    console.log(`Contract deployed at: ${deployed.address}`);

    try {
      // 1. Test single token minting
      console.log('4️⃣ Testing single token minting...');
      const tokenId = 1;
      const amount = 10;

      const mint = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'mint',
        [deployerAddress, tokenId, amount, "0x"],
        signer
      );

      // Await the transaction
      await mint.wait();
      console.log('✅ Single token minted successfully');

      // Check balance
      const balance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress, tokenId],
        signer
      );

      expect(Number(balance)).toBe(amount);
      console.log(`Token balance verified: ${balance}`);

      // 2. Test supply tracking
      const totalSupply = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'totalSupply(uint256 id)',
        [tokenId],
        signer
      );


      expect(Number(totalSupply)).toBe(amount);
      console.log(`Token supply verified: ${totalSupply}`);

      const exists = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'exists',
        [tokenId],
        signer
      );

      expect(exists).toBe(true);
      console.log('✅ Supply tracking feature verified');

      // 3. Test batch minting
      console.log('Testing batch token minting...');
      const batchTokenIds = [2, 3, 4];
      const batchAmounts = [20, 30, 40];

      console.log(`Minting batch tokens with IDs: ${batchTokenIds} and amounts: ${batchAmounts}`);
      try {
        const batchMint = await contractHandler.callMethod(
          deployed.address,
          compiled.abi,
          'mintBatch',
          [deployerAddress, batchTokenIds, batchAmounts, "0x"],
          signer
        );

        // Wait for the transaction with more confirmations
        const receipt = await batchMint.wait(2); // Wait for 2 confirmations
        console.log(`✅ Batch tokens minted successfully (tx: ${receipt.hash})`);

        // Add a small delay to ensure the blockchain state is updated
        console.log('Waiting for blockchain state to update...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check batch balances with better error handling
        const batchBalances: number[] = [];
        for (let i = 0; i < batchTokenIds.length; i++) {
          try {
            const balance = await contractHandler.callMethod(
              deployed.address,
              compiled.abi,
              'balanceOf',
              [deployerAddress, batchTokenIds[i]],
              signer
            );

            const balanceNumber = Number(balance);
            batchBalances.push(balanceNumber);
            console.log(`Token ID ${batchTokenIds[i]} balance: ${balanceNumber} (expected: ${batchAmounts[i]})`);
          } catch (error) {
            console.error(`Error fetching balance for token ID ${batchTokenIds[i]}:`, error);
            batchBalances.push(0); // Default to 0 in case of error
          }
        }

        // More flexible verification - try individual assertions
        for (let i = 0; i < batchTokenIds.length; i++) {
          expect(batchBalances[i], `Token ID ${batchTokenIds[i]} balance mismatch: expected ${batchAmounts[i]}, got ${batchBalances[i]}`)
            .toBe(batchAmounts[i]);
        }

        console.log(`Batch token balances verified: ${batchBalances}`);
      } catch (error: any) {
        console.error(`❌ Batch minting test failed: ${error.message}`);
        console.error(error);
        throw error;
      }

      // 4. Test URI
      const tokenURI = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'uri',
        [tokenId],
        signer
      );

      expect(tokenURI).toBe('ipfs://QmComplexToken/{id}.json');
      console.log(`Token URI verified: ${tokenURI}`);

      // 5. Test setURI
      console.log('Testing setURI functionality...');
      const newURI = 'ipfs://QmNewURI/{id}.json';

      const setURI = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'setURI',
        [newURI],
        signer
      );

      // Await the transaction
      await setURI.wait();

      const newTokenURI = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'uri',
        [tokenId],
        signer
      );

      expect(newTokenURI).toBe(newURI);
      console.log('✅ URI updated successfully');

      // 6. Test pause functionality
      console.log('Testing pause functionality...');
      const pause = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'pause',
        [],
        signer
      );

      // Await the transaction
      await pause.wait();

      const paused = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'paused',
        [],
        signer
      );

      expect(paused).toBe(true);
      console.log('✅ Contract successfully paused');

      // 7. Test unpause
      console.log('Testing unpause functionality...');
      const unpause = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'unpause',
        [],
        signer
      );

      // Await the transaction
      await unpause.wait();

      const unpaused = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'paused',
        [],
        signer
      );

      expect(unpaused).toBe(false);
      console.log('✅ Contract successfully unpaused');

      // 8. Test burning
      console.log('Testing burn functionality...');
      const burnAmount = 5;
      const burn = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'burn',
        [deployerAddress, tokenId, burnAmount],
        signer
      );

      // Await the transaction
      await burn.wait();

      const afterBurnBalance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress, tokenId],
        signer
      );

      expect(Number(afterBurnBalance)).toBe(amount - burnAmount);
      console.log(`✅ Token successfully burned. New balance: ${afterBurnBalance}`);

      // 9. Test batch burning
      console.log('Testing batch burn functionality...');
      const batchBurnAmounts = [10, 15, 20]; // Burn partial amounts

      const batchBurn = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'burnBatch',
        [deployerAddress, batchTokenIds, batchBurnAmounts],
        signer
      );

      // Await the transaction
      await batchBurn.wait();

      // Check remaining balances
      const afterBatchBurnBalances: number[] = [];
      for (let i = 0; i < batchTokenIds.length; i++) {
        const balance = await contractHandler.callMethod(
          deployed.address,
          compiled.abi,
          'balanceOf',
          [deployerAddress, batchTokenIds[i]],
          signer
        );
        afterBatchBurnBalances.push(Number(balance));
      }

      // Check each remaining balance
      for (let i = 0; i < batchTokenIds.length; i++) {
        expect(afterBatchBurnBalances[i]).toBe(batchAmounts[i] - batchBurnAmounts[i]);
      }

      console.log(`✅ Batch tokens successfully burned. New balances: ${afterBatchBurnBalances}`);
      console.log('✨ All ERC1155 features tested successfully!');

    } catch (error: any) {
      console.error(`❌ Test failed: ${error.message}`);
      throw error;
    }
  }, 300000); // Longer timeout for blockchain interaction
});