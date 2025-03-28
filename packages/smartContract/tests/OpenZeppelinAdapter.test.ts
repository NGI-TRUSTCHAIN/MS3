import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../src/index.js';
import { IBaseContractHandler } from '../src/types/index.js';
import { testAdapterPattern } from './Core.test.js';
import { OpenZeppelinAdapter } from '../src/adapters/openZeppelinAdapter.js';
import { ethers } from 'ethers';
import * as path from 'path';

// Test flag for integration tests with real blockchain
const RUN_INTEGRATION_TESTS = true;

// Test wallet for real deployments
const TEST_PRIVATE_KEY = '0x63a648a4c0efeeb4f08207f1682bed9937a4c6cb5f7f1ee39f75c135e8828b2b';

// Provider for testnet interactions
const getTestProvider = () => {
  return new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
};

describe('OpenZeppelinAdapter Tests', () => {
  // Test constructor pattern directly
  describe('OpenZeppelinAdapter - Constructor Pattern Tests', () => {
    testAdapterPattern(OpenZeppelinAdapter, {});
  });

  // Full integration tests
  (RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full Integration Tests', () => {
    let signer: ethers.Wallet;
    let contractHandler: IBaseContractHandler;
    
    beforeEach(async () => {
      const provider = getTestProvider();
      signer = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
      
      // Create the handler using the factory method
      contractHandler = await createContractHandler({
        adapterName: 'openZeppelin',
        options: {
          workDir: path.join(process.cwd(), 'contracts'),
          preserveOutput: true,
        }
      });
    });
    
    it('should generate, compile, deploy and interact with a contract', async () => {
      console.log('🚀 Starting ERC20 token contract deployment test');
      
      // Generate contract
      console.log('1️⃣ Generating ERC20 contract source code...');
      const contractSource = await contractHandler.generateContract({
        standard: 'ERC20',
        options: { 
          name: 'IntegrationToken', 
          symbol: 'ITK',
          premint: '1000', 
          mintable: true,
          access: 'ownable'
        }
      });
      console.log(`✅ Contract source generated (${contractSource.length} bytes)`);
      
      // Compile it
      console.log('2️⃣ Compiling the contract...');
      const compiled = await contractHandler.compile(contractSource);
      console.log(`✅ Compilation successful. Contract ABI has ${compiled.abi.length} entries`);
      
      // Find constructor parameters in the ABI
      const constructorAbi = compiled.abi.find(item => item.type === 'constructor');
      console.log('Constructor ABI:', constructorAbi ? JSON.stringify(constructorAbi) : 'No constructor found');
      
      // Get deployer address
      const deployerAddress = await signer.getAddress();
      console.log(`🔑 Deployer address: ${deployerAddress}`);
      
      // For ERC20 with premint + ownable, the wizard generates a contract requiring:
      // 1. recipient (who gets preminted tokens)
      // 2. initialOwner (who controls the contract)
      const constructorArgs = [deployerAddress, deployerAddress];
      console.log(`📝 Constructor arguments: [${constructorArgs.join(', ')}]`);
      
      // Deploy with correct constructor args
      console.log('3️⃣ Deploying contract to Sepolia testnet...');
      const deployed = await contractHandler.deploy(compiled, constructorArgs, signer);
      console.log(`✅ Contract deployed successfully!`);
      console.log(`📍 Contract address: ${deployed.address}`);
      console.log(`🧾 Transaction hash: ${deployed.transactionHash}`);
      
      // Verify deployment
      expect(deployed.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      
      // Check token balance - the deployer should have preminted tokens
      console.log('4️⃣ Checking token balance...');
      const balance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress],
        signer
      );
      
      const balanceFormatted = BigInt(balance.toString());
      console.log(`💰 Deployer balance: ${balanceFormatted} tokens`);
      
      // Verify balance - preminted amount should be positive
      expect(balanceFormatted).toBeGreaterThan(0n);
      
      // Check other functions to verify contract works correctly
      console.log('5️⃣ Fetching token metadata...');
      const tokenName = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'name',
        [],
        signer
      );
      
      const tokenSymbol = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'symbol',
        [],
        signer
      );
      
      const totalSupply = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'totalSupply',
        [],
        signer
      );
      
      console.log(`📊 Token Details:`);
      console.log(`   Name: ${tokenName}`);
      console.log(`   Symbol: ${tokenSymbol}`);
      console.log(`   Total Supply: ${BigInt(totalSupply.toString())} tokens`);
      
      console.log('✨ Integration test completed successfully!');
    }, 60000);
  });
});