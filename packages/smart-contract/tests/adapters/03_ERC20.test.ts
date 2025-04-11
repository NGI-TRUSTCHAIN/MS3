import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../src/index.js';
import { IBaseContractHandler } from '../../src/types/index.js';
import { testAdapterPattern } from './../01_Core.test.js';
import { testContractHandlerInterface } from './../02_IBaseContractHandler.test.js';
import { OpenZeppelinAdapter } from '../../src/adapters/openZeppelinAdapter.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS } from '../../../smart-contract/config.js';

// Provider for testnet interactions
const getTestProvider = () => {
  return new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
};

describe('OpenZeppelinAdapter Tests', () => {
  // Test constructor pattern directly
  describe('OpenZeppelinAdapter - Constructor Pattern Tests', () => {
    testAdapterPattern(OpenZeppelinAdapter, {});
  });

  // Test interface implementation
  describe('OpenZeppelinAdapter - Interface Implementation', () => {
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

    it('supports contract handler interface', () => {
      testContractHandlerInterface(contractHandler, true); // Skip deployment tests
    });
  });

  // Test ERC20 options
  describe('ERC20 Options Tests', () => {
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

    it('should generate basic ERC20 with required options', async () => {
      // Test basic required options (name and symbol)
      const basicSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'BasicToken',
          symbol: 'BTK'
        }
      });

      expect(basicSource).toContain('contract BasicToken is ERC20');
      expect(basicSource).toContain('ERC20("BasicToken", "BTK")');

      // Basic ERC20 should NOT have these features
      expect(basicSource).not.toContain('ERC20Burnable');
      expect(basicSource).not.toContain('ERC20Pausable');
      expect(basicSource).not.toContain('function mint(');
    });

    it('should generate ERC20 with burnable feature', async () => {
      const burnableSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'BurnableToken',
          symbol: 'BTK',
          burnable: true
        }
      });

      expect(burnableSource).toContain('contract BurnableToken is ERC20, ERC20Burnable');
      expect(burnableSource).toContain('import {ERC20Burnable}');
    });

    it('should generate ERC20 with pausable feature', async () => {
      const pausableSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'PausableToken',
          symbol: 'PTK',
          pausable: true,
          access: 'ownable' // Pausable requires access control
        }
      });

      expect(pausableSource).toContain('contract PausableToken is ERC20');
      expect(pausableSource).toContain('ERC20Pausable');
      expect(pausableSource).toContain('function pause()');
      expect(pausableSource).toContain('function unpause()');
    });

    it('should generate ERC20 with premint', async () => {
      const premintSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'PremintToken',
          symbol: 'PMT',
          premint: '1000000'
        }
      });

      expect(premintSource).toContain('_mint(');
      expect(premintSource).toContain('1000000 * 10 ** decimals()');
    });

    it('should generate ERC20 with mintable feature', async () => {
      const mintableSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'MintableToken',
          symbol: 'MTK',
          mintable: true,
          access: 'ownable' // Mintable requires access control
        }
      });

      expect(mintableSource).toContain('function mint(address to, uint256 amount)');
      expect(mintableSource).toContain('onlyOwner');
    });

    it('should generate ERC20 with permit feature', async () => {
      const permitSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'PermitToken',
          symbol: 'PMT',
          permit: true
        }
      });

      expect(permitSource).toContain('import {ERC20Permit}');
      expect(permitSource).toContain('contract PermitToken is ERC20, ERC20Permit');
      expect(permitSource).toContain('ERC20Permit("PermitToken")');
    });

    it('should generate ERC20 with voting feature', async () => {
      const votingSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'VotingToken',
          symbol: 'VTK',
          votes: true
        }
      });

      expect(votingSource).toContain('import {ERC20Votes}');
      expect(votingSource).toContain('contract VotingToken is ERC20');
      expect(votingSource).toContain('ERC20Votes');
      expect(votingSource).toContain('_update('); // Updated method name instead of _afterTokenTransfer
      expect(votingSource).toContain('override(ERC20, ERC20Votes)');
    });

    it('should generate ERC20 with custom access control', async () => {
      // Test roles
      const rolesSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'RolesToken',
          symbol: 'RTK',
          mintable: true,
          access: 'roles'
        }
      });

      expect(rolesSource).toContain('import {AccessControl}');
      expect(rolesSource).toContain('MINTER_ROLE');
      expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');

      // Test ownable
      const ownableSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'OwnableToken',
          symbol: 'OTK',
          mintable: true,
          access: 'ownable'
        }
      });

      expect(ownableSource).toContain('import {Ownable}');
      expect(ownableSource).toContain('onlyOwner');
    });

    it('should generate ERC20 with multiple features combined', async () => {
      const complexSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'ComplexToken',
          symbol: 'CTK',
          burnable: true,
          pausable: true,
          mintable: true,
          permit: true,
          premint: '1000000',
          access: 'ownable'
        }
      });

      // Check for all features in the combined token
      expect(complexSource).toContain('contract ComplexToken is ERC20');
      expect(complexSource).toContain('ERC20Burnable');
      expect(complexSource).toContain('ERC20Pausable');
      expect(complexSource).toContain('import {ERC20Permit}');
      expect(complexSource).toContain('function mint(');
      expect(complexSource).toContain('function pause(');
      expect(complexSource).toContain('function unpause(');
      expect(complexSource).toContain('_mint(');
      expect(complexSource).toContain('1000000 * 10 ** decimals()');
    });

    it('should generate ERC20 with security options', async () => {
      // Test ERC20 with license option
      const secureSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'SecureToken',
          symbol: 'STK',
          burnable: true,
        }
      });

      expect(secureSource).toContain('SPDX-License-Identifier: MIT');
    });
  });

  // Full integration tests for real blockchain deployment
  (RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full Integration Tests', () => {
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

    it('should deploy ERC20 with multiple features and verify functionality', async () => {
      console.log('🚀 Starting comprehensive ERC20 test');

      // Generate contract with multiple features
      console.log('1️⃣ Generating feature-rich ERC20 contract...');
      const contractSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: {
          name: 'ComprehensiveToken',
          symbol: 'CPTK',
          burnable: true,
          pausable: true,
          premint: '1000',
          mintable: true,
          permit: true,
          access: 'ownable'
        }
      });

      // Compile
      console.log('2️⃣ Compiling the contract...');
      const compiled = await contractHandler.compile(contractSource);

      // Prepare constructor args
      const deployerAddress = await signer.getAddress();
      const constructorArgs = [deployerAddress, deployerAddress];

      // Deploy
      console.log('3️⃣ Deploying to testnet...');
      const deployed = await contractHandler.deploy(compiled, constructorArgs, signer);
      console.log(`Contract deployed at: ${deployed.address}`);

      // Test all features
      // 1. Check premint
      const initialBalance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress],
        signer
      );

      const initialBalanceValue = BigInt(initialBalance.toString());
      console.log(`Initial balance: ${initialBalanceValue} tokens`);
      expect(initialBalanceValue).toBeGreaterThan(0n);

      // 2. Test mint - use a much larger amount to ensure the difference is clear
      const mintAmount = ethers.parseUnits('5000', 18); // Mint 5000 tokens
      console.log(`Minting ${mintAmount} additional tokens to ${deployerAddress}`);

      try {
        const callstate = await contractHandler.callMethod(
          deployed.address,
          compiled.abi,
          'mint',
          [deployerAddress, mintAmount],
          signer
        );

        // Await the minting.
        await callstate.wait();

        const newBalance = await contractHandler.callMethod(
          deployed.address,
          compiled.abi,
          'balanceOf',
          [deployerAddress],
          signer
        );

        const newBalanceValue = BigInt(newBalance.toString());
        console.log(`New balance after minting: ${newBalanceValue} tokens`);

        // Check if balances are different and minting worked
        expect(newBalanceValue).toBeGreaterThan(initialBalanceValue);
        console.log(`✅ Minting successful, balance increased by ${newBalanceValue - initialBalanceValue} tokens`);
      } catch (error: any) {
        console.error(`❌ Minting failed: ${error.message}`);
        throw error; // Re-throw to fail the test
      }

      // 3. Test pause
      console.log('Testing pause functionality...');
      const pause = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'pause',
        [],
        signer
      );

      await pause.wait();

      const paused = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'paused',
        [],
        signer
      );
      console.log(`Contract paused: ${paused}`);

      expect(paused).toBe(true);
      console.log('✅ Contract successfully paused');

      // 4. Test unpause
      console.log('Testing unpause functionality...');
      const unpause = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'unpause',
        [],
        signer
      );

      // Await the unpause.
      await unpause.wait();

      const unpaused = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'paused',
        [],
        signer
      );
      console.log(`Contract unpaused: ${unpaused}`);

      expect(unpaused).toBe(false);
      console.log('✅ Contract successfully unpaused');

      // 5. Test burning
      console.log('Testing burn functionality...');
      const burnAmount = ethers.parseUnits('10', 18); // Burn 10 tokens

      const burn = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'burn',
        [burnAmount],
        signer
      );

      // Await the burn.
      await burn.wait();

      const afterBurnBalance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress],
        signer
      );

      const afterBurnBalanceValue = BigInt(afterBurnBalance.toString());
      console.log(`Balance after burning: ${afterBurnBalanceValue} tokens`);

      console.log('✨ All ERC20 features tested successfully!');
    }, 150000); // Longer timeout for blockchain interaction
  });
});