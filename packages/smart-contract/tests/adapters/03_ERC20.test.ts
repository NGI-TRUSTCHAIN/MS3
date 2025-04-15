import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler, CompiledOutput, DeployedOutput, GenerateContractInput, IBaseContractHandler } from '../../src/index.js';
import { testAdapterPattern } from './../01_Core.test.js';
import { testContractHandlerInterface } from './../02_IBaseContractHandler.test.js';
import { OpenZeppelinAdapter } from '../../src/adapters/openZeppelinAdapter.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS } from '../../config.js';
import { createWallet, IEVMWallet } from '@m3s/wallet';

// Provider for testnet interactions
const getTestProvider = () => {
  // Ensure you have a Sepolia RPC URL configured, e.g., in your environment variables
  const rpcUrl = process.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  return new ethers.JsonRpcProvider(rpcUrl);
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
          workDir: path.join(process.cwd(), 'test-contracts-output', 'erc20-gen'), // Use unique test dir for generation tests
          preserveOutput: true,
        }
      });
      // Initialization is handled by createContractHandler -> OpenZeppelinAdapter.create
    });

    it('should generate basic ERC20 with required options', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'BasicToken',
          symbol: 'BTK'
        }
      };
      const basicSource = await contractHandler.generateContract(input);

      expect(basicSource).toContain('contract BasicToken is ERC20');
      expect(basicSource).toContain('constructor() ERC20("BasicToken", "BTK")');
      // --- Updated Assertions ---
      expect(basicSource).toContain('import {ERC20Permit}'); // <<< Now expected by default
      expect(basicSource).toContain('ERC20Permit("BasicToken")'); // <<< Constructor includes Permit
      // Basic ERC20 should NOT have these features
      expect(basicSource).not.toContain('import {ERC20Burnable}');
      expect(basicSource).not.toContain('import {ERC20Pausable}');
      // expect(basicSource).not.toContain('import {ERC20Permit}'); // <<< REMOVED - Permit is now default
      expect(basicSource).not.toContain('import {ERC20Votes}');
      expect(basicSource).not.toContain('import {ERC20FlashMint}');
    });

    it('should generate ERC20 with burnable feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'BurnableToken',
          symbol: 'BRN',
          burnable: true
        }
      };
      const burnableSource = await contractHandler.generateContract(input);

      expect(burnableSource).toContain('import {ERC20Burnable}');
      expect(burnableSource).toContain('ERC20Burnable');
    });

    it('should generate ERC20 with pausable feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'PausableToken',
          symbol: 'PAU',
          pausable: true,
          access: 'ownable' // Pausable requires access control
        }
      };
      const pausableSource = await contractHandler.generateContract(input);

      expect(pausableSource).toContain('import {ERC20Pausable}');
      expect(pausableSource).toContain('ERC20Pausable');
      expect(pausableSource).toContain('function pause()');
      expect(pausableSource).toContain('function unpause()');
    });

    it('should generate ERC20 with premint feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'PremintToken',
          symbol: 'PMT',
          premint: '1000000'
        }
      };
      const premintSource = await contractHandler.generateContract(input);

      expect(premintSource).toContain('_mint(');
      // OZ Wizard uses _mint(msg.sender, 1000000 * 10 ** decimals());
      expect(premintSource).toMatch(/_mint\(.*,\s*1000000\s*\*\s*10\s*\*\*\s*decimals\(\)\)/);
    });

    it('should generate ERC20 with mintable feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'MintableToken',
          symbol: 'MTK',
          mintable: true,
          access: 'ownable' // Mintable requires access control
        }
      };
      const mintableSource = await contractHandler.generateContract(input);

      expect(mintableSource).toContain('function mint(address to, uint256 amount)');
      expect(mintableSource).toContain('onlyOwner'); // If access is ownable
    });

    it('should generate ERC20 with permit feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'PermitToken',
          symbol: 'PRM',
          permit: true
        }
      };
      const permitSource = await contractHandler.generateContract(input);

      expect(permitSource).toContain('import {ERC20Permit}');
      expect(permitSource).toContain('ERC20Permit("PermitToken")'); // Check constructor call
    });

    it('should generate ERC20 with voting feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'VotingToken',
          symbol: 'VOT',
          votes: true
        }
      };
      const votingSource = await contractHandler.generateContract(input);

      expect(votingSource).toContain('import {ERC20Votes}');
      expect(votingSource).toContain('ERC20Votes');
      // --- Updated Assertions ---
      expect(votingSource).toContain('function _update(address from, address to, uint256 value)');
      expect(votingSource).toContain('override(ERC20, ERC20Votes)');
    });

    it('should generate ERC20 with flash minting feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'FlashToken',
          symbol: 'FLT',
          flashmint: true
        }
      };
      const flashSource = await contractHandler.generateContract(input);

      expect(flashSource).toContain('import {ERC20FlashMint}');
      expect(flashSource).toContain('ERC20FlashMint');
    });

    it('should generate ERC20 with custom access control', async () => {
      // Test roles
      const rolesInput: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'RolesToken',
          symbol: 'RLT',
          mintable: true,
          pausable: true,
          access: 'roles'
        }
      };
      const rolesSource = await contractHandler.generateContract(rolesInput);

      expect(rolesSource).toContain('import {AccessControl}');
      expect(rolesSource).toContain('MINTER_ROLE');
      expect(rolesSource).toContain('PAUSER_ROLE');
      expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');
      expect(rolesSource).toContain('onlyRole(PAUSER_ROLE)');

      // Test ownable (already tested implicitly in others, but good to be explicit)
      const ownableInput: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'OwnableToken',
          symbol: 'OWNT',
          mintable: true,
          pausable: true,
          access: 'ownable'
        }
      };
      const ownableSource = await contractHandler.generateContract(ownableInput);
      expect(ownableSource).toContain('import {Ownable}');
      expect(ownableSource).toContain('onlyOwner');
    });

    it('should generate ERC20 with multiple features combined', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'ComprehensiveToken',
          symbol: 'CPTK',
          burnable: true,
          pausable: true,
          premint: '1000',
          mintable: true,
          permit: true,
          votes: true,
          flashmint: true,
          access: 'ownable'
        }
      };
      const complexSource = await contractHandler.generateContract(input);

     // Check for all features in the combined token
     expect(complexSource).toContain('import {ERC20}');
     expect(complexSource).toContain('import {ERC20Burnable}');
     expect(complexSource).toContain('import {ERC20Pausable}');
     expect(complexSource).toContain('import {ERC20Permit}');
     expect(complexSource).toContain('import {ERC20Votes}');
     expect(complexSource).toContain('import {ERC20FlashMint}');
     expect(complexSource).toContain('import {Ownable}');
     expect(complexSource).toContain('contract ComprehensiveToken is');
     // --- Updated Assertions ---
     expect(complexSource).toContain('constructor(address recipient, address initialOwner)'); // <<< Updated constructor
     expect(complexSource).toContain('_mint(recipient, 1000 * 10 ** decimals())'); // <<< Updated premint logic
     // expect(complexSource).toContain('_mint(msg.sender, 1000 * 10 ** decimals())'); // <<< REMOVED old check
     expect(complexSource).toContain('function pause() public onlyOwner'); // Check modifier
     expect(complexSource).toContain('function unpause() public onlyOwner'); // Check modifier
     expect(complexSource).toContain('function mint(address to, uint256 amount) public onlyOwner'); // Check modifier
     expect(complexSource).toContain('onlyOwner');
    });

    it('should generate ERC20 with security options', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'SecureToken',
          symbol: 'SECT',
          premint: '0', // Required for security contact
          securityContact: 'security@example.com'
        }
      };
      const securitySource = await contractHandler.generateContract(input);

      expect(securitySource).toContain('/// @custom:security-contact security@example.com');
    });
  });

  // Full integration tests for real blockchain deployment
  (RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full Integration Tests', () => {
    let walletAdapter: IEVMWallet; // <<< ADDED
    let contractHandler: IBaseContractHandler;
    let provider: ethers.Provider; // Add provider

    beforeEach(async () => {
      provider = getTestProvider();
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      const rpcUrl = (provider as any).connection?.url || 'https://ethereum-sepolia-rpc.publicnode.com';

      walletAdapter = await createWallet<IEVMWallet>({
        adapterName: 'ethers',
        provider: {
          rpcUrl: rpcUrl,
          chainId: chainId
        },
        options: {
          privateKey: TEST_PRIVATE_KEY
        }
      });

      if (!walletAdapter.isInitialized()) {
        console.log("Wallet not initialized by create, calling initialize...");
        await walletAdapter.initialize(); // <<< Keep initialize call
     } else {
        console.log("Wallet already initialized by create.");
     }

    // Verify connection after initialization
    if (!walletAdapter.isConnected()) {
      throw new Error("Wallet failed to connect after initialize call.");
    }

   console.log("Wallet initialized and connected successfully.");
      contractHandler = await createContractHandler({
        adapterName: 'openZeppelin',
        options: {
          workDir: path.join(process.cwd(), 'test-contracts-output', 'erc20'),
          preserveOutput: true,
          providerConfig: {
             rpcUrl: rpcUrl,
             chainId: chainId
          }
        }
      });
    });

    it('should deploy ERC20 with multiple features and verify functionality', async () => {
      console.log('🚀 Starting comprehensive ERC20 test');

      // Generate contract with multiple features
      console.log('1️⃣ Generating feature-rich ERC20 contract...');
      const contractSource = await contractHandler.generateContract({
        language: 'solidity', // Specify language
        template: 'openzeppelin_erc20', // Use template name
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
      const compiled: CompiledOutput = await contractHandler.compile({
          sourceCode: contractSource,
          language: 'solidity',
          contractName: 'ComprehensiveToken' // Optional, helps if regex fails
      });
      expect(compiled.artifacts?.abi).toBeDefined();
      expect(compiled.artifacts?.bytecode).toBeDefined();

      // Prepare constructor args (Ownable sets owner to deployer)
      const deployerAddress = (await walletAdapter.getAccounts())[0]; // <<< Get address from adapter
      const constructorArgs: any[] = []; // No explicit constructor args needed for standard Ownable OZ template

      // Deploy
      console.log('3️⃣ Deploying to testnet...');
      const deployed: DeployedOutput = await contractHandler.deploy({
          compiledContract: compiled,
          constructorArgs: constructorArgs,
          wallet: walletAdapter
      });
      console.log(`Contract deployed at: ${deployed.contractId}`);
      expect(deployed.contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);

        // --- Test all features ---
        const contractId = deployed.contractId;
        const contractAbi = compiled.artifacts.abi;
  
        // 1. Check premint using callMethod (read) - uses default provider in contractHandler
        console.log('Testing premint balance...');
        const initialBalance = await contractHandler.callMethod({
            contractId: contractId,
            contractInterface: contractAbi,
            functionName: 'balanceOf',
            args: [deployerAddress]
        });;

        const initialBalanceValue = BigInt(initialBalance.toString());
        console.log(`Initial balance: ${ethers.formatEther(initialBalanceValue)} CPTK`);
        expect(initialBalanceValue).toEqual(ethers.parseUnits('1000', 18));
        console.log('✅ Premint verified');

      // 2. Test mint (write) - requires wallet adapter
      const mintAmount = ethers.parseUnits('500', 18); // Mint 500 tokens
      console.log(`Testing mint functionality (minting ${ethers.formatEther(mintAmount)} CPTK)...`);
      const mintResult = await contractHandler.callMethod({
          contractId: contractId,
          contractInterface: contractAbi,
          functionName: 'mint',
          args: [deployerAddress, mintAmount],
          wallet: walletAdapter
      });
      expect(mintResult.transactionHash).toBeDefined();
      // Wait for transaction confirmation
      const mintReceipt = await walletAdapter.getTransactionReceipt(mintResult.transactionHash); // <<< Use adapter method
      let attempts = 0;
      let finalMintReceipt = mintReceipt;
      while (!finalMintReceipt && attempts < 10) { // Poll for ~60 seconds
          await new Promise(resolve => setTimeout(resolve, 6000));
          finalMintReceipt = await walletAdapter.getTransactionReceipt(mintResult.transactionHash);
          attempts++;
      }
      expect(finalMintReceipt?.status).toBe(1);
      console.log(`Mint transaction confirmed: ${mintResult.transactionHash}`);

      const afterMintBalance = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOf',
        args: [deployerAddress]
    });
    const afterMintBalanceValue = BigInt(afterMintBalance.toString());
    expect(afterMintBalanceValue).toEqual(initialBalanceValue + mintAmount);
    console.log(`✅ Minting successful. New balance: ${ethers.formatEther(afterMintBalanceValue)} CPTK`);

      // 3. Test pause (write)
      console.log('Testing pause functionality...');
      const pauseResult = await contractHandler.callMethod({
          contractId: contractId,
          contractInterface: contractAbi,
          functionName: 'pause',
          args: [],
          // wallet: signer // <<< REMOVED
          wallet: walletAdapter // <<< Use the wallet adapter instance
      });
      let finalPauseReceipt = await walletAdapter.getTransactionReceipt(pauseResult.transactionHash);
      attempts = 0;
      while (!finalPauseReceipt && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 6000));
          finalPauseReceipt = await walletAdapter.getTransactionReceipt(pauseResult.transactionHash);
          attempts++;
      }
      expect(finalPauseReceipt?.status).toBe(1);

      const pausedState = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'paused',
        args: []
    });
    expect(pausedState).toBe(true);
    console.log('✅ Contract successfully paused');

     // 4. Test unpause (write)
     console.log('Testing unpause functionality...');
     const unpauseResult = await contractHandler.callMethod({
         contractId: contractId,
         contractInterface: contractAbi,
         functionName: 'unpause',
         args: [],
         // wallet: signer // <<< REMOVED
         wallet: walletAdapter // <<< Use the wallet adapter instance
     });
      // const unpauseReceipt = await provider.waitForTransaction(unpauseResult.transactionHash, 1, 60000); // <<< REMOVED
      let finalUnpauseReceipt = await walletAdapter.getTransactionReceipt(unpauseResult.transactionHash);
      attempts = 0;
      while (!finalUnpauseReceipt && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 6000));
          finalUnpauseReceipt = await walletAdapter.getTransactionReceipt(unpauseResult.transactionHash);
          attempts++;
      }
      expect(finalUnpauseReceipt?.status).toBe(1);

      const unpausedState = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'paused',
        args: []
    });
    expect(unpausedState).toBe(false);
    console.log('✅ Contract successfully unpaused');

      // 5. Test burning (write)
      console.log('Testing burn functionality...');
      const burnAmount = ethers.parseUnits('100', 18); // Burn 100 tokens
      const burnResult = await contractHandler.callMethod({
          contractId: contractId,
          contractInterface: contractAbi,
          functionName: 'burn',
          args: [burnAmount],
          // wallet: signer // <<< REMOVED
          wallet: walletAdapter // <<< Use the wallet adapter instance
      });
      let finalBurnReceipt = await walletAdapter.getTransactionReceipt(burnResult.transactionHash);
      attempts = 0;
      while (!finalBurnReceipt && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 6000));
          finalBurnReceipt = await walletAdapter.getTransactionReceipt(burnResult.transactionHash);
          attempts++;
      }
      expect(finalBurnReceipt?.status).toBe(1);

      const afterBurnBalance = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOf',
        args: [deployerAddress]
    });
    const afterBurnBalanceValue = BigInt(afterBurnBalance.toString());
    expect(afterBurnBalanceValue).toEqual(afterMintBalanceValue - burnAmount);
    console.log(`✅ Burning successful. Final balance: ${ethers.formatEther(afterBurnBalanceValue)} CPTK`);
      // Permit test is more complex involving off-chain signing, skipping for now

      console.log('✨ All testable ERC20 features verified successfully!');
    }, 180000); // Increased timeout for blockchain interaction
  });
});