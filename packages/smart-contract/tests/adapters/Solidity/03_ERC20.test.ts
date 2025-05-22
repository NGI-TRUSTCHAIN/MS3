import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler, CompiledOutput, DeployedOutput, GenerateContractInput, IBaseContractHandler } from '../../../src/index.js';
import { testContractHandlerInterface } from '../../02_IBaseContractHandler.test.js';
import { ethers } from 'ethers';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS, INFURA_API_KEY } from '../../../config.js';
import { createWallet, IEVMWallet, NetworkConfig } from '@m3s/wallet';
import { NetworkHelper } from '@m3s/common';

describe('OpenZeppelinAdapter Tests', () => {
  // Test interface implementation
  describe('OpenZeppelinAdapter - Interface Implementation', () => {
    let contractHandler: IBaseContractHandler;

    beforeEach(async () => {
      contractHandler = await createContractHandler({
        adapterName: 'openZeppelin',
        options: {
          // workDir: path.join(process.cwd(), 'contracts'),
          preserveOutput: true,
        }
      });

      // await contractHandler.initialize();
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
          // workDir: path.join(process.cwd(), 'test-contracts-output', 'erc20-gen'), // Use unique test dir for generation tests
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
  });

  // Full integration tests for real blockchain deployment
  (RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full Integration Tests', () => {
    let walletAdapter: IEVMWallet;
    let contractHandler: IBaseContractHandler;

     beforeEach(async () => {
      const networkHelper = NetworkHelper.getInstance();
      await networkHelper.ensureInitialized();

      const preferredRpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
      const networkConfig = await networkHelper.getNetworkConfig('sepolia', [preferredRpcUrl]);

      const testNetworkName = 'sepolia';
      
      // --- Construct preferred Infura RPC URL ---
      if (!INFURA_API_KEY) {
        throw new Error("INFURA_API_KEY is not set in config.js. Cannot run integration tests that require a specific RPC.");
      }

      // --- Get NetworkConfig, prioritizing the Infura RPC ---

      if (!networkConfig || !networkConfig.rpcUrls || networkConfig.rpcUrls.length === 0) {
        throw new Error(`Failed to get a valid network configuration for ${testNetworkName} using preferred RPC from NetworkHelper.`);
      }

      // --- Use TEST_PRIVATE_KEY for the wallet ---
      if (!TEST_PRIVATE_KEY) {
        throw new Error("TEST_PRIVATE_KEY is not set in config.js. Cannot run integration tests requiring a funded account.");
      }

      const privateKeyToUse = TEST_PRIVATE_KEY; 

      walletAdapter = await createWallet<IEVMWallet>({
        adapterName: 'ethers',
        options: {
          privateKey: privateKeyToUse
        }
      });
      

      try {
        await walletAdapter.setProvider(networkConfig);

      } catch (error) {
        console.error(`[Test Setup] setProvider FAILED:`, error);
        throw error; // Re-throw if setting provider is critical
      }

      contractHandler = await createContractHandler({
        adapterName: 'openZeppelin',
        options: {
          // workDir: path.join(process.cwd(), 'test-contracts-output', 'erc20'),
          preserveOutput: true,
          providerConfig: networkConfig
        }
      });

    });

    
    it('should deploy ERC20 with multiple features and verify functionality', async () => {
  
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
      const compiled: CompiledOutput = await contractHandler.compile({
        sourceCode: contractSource,
        language: 'solidity',
        contractName: 'ComprehensiveToken' // Optional, helps if regex fails
      });
      expect(compiled.artifacts?.abi).toBeDefined();
      expect(compiled.artifacts?.bytecode).toBeDefined();

      // Prepare constructor args
      const accounts = await walletAdapter.getAccounts();
      const deployerAddress = accounts[0];

      if (!deployerAddress || !ethers.isAddress(deployerAddress)) {
        throw new Error(`Failed to get a valid deployer address from wallet adapter. Received: ${deployerAddress}`);
      }

      const constructorArgs: any[] = [deployerAddress, deployerAddress];
      const otherAddress = ethers.Wallet.createRandom().address;
      const contractAbi = compiled.artifacts.abi;

      // Deploy
      const deployed: DeployedOutput = await contractHandler.deploy({
        compiledContract: compiled,
        constructorArgs: constructorArgs, // <<< Passing [deployerAddress, deployerAddress]
        wallet: walletAdapter
      });

      const contractId = deployed.contractId;

      expect(contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(deployed.deploymentInfo?.transactionId).toBeDefined();

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

      // 2. Test Minting (requires owner)
      await new Promise(resolve => setTimeout(resolve, 3*1000)); // <<<< ADD DELAY
      const mintAmount = ethers.parseUnits('500', 18);
      const mintResult = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'mint',
        args: [otherAddress, mintAmount],
        wallet: walletAdapter,
        contractInterface: contractAbi
      });

      const mintReceipt = await waitForReceipt(mintResult.transactionHash);

      expect(mintReceipt).toBeDefined();
      expect(mintReceipt).not.toBeNull();
      expect(mintReceipt!.status).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 3*1000)); 

      const afterMintBalanceResult = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'balanceOf',
        args: [otherAddress],
        wallet: walletAdapter,
        contractInterface: contractAbi 
      });

      const afterMintBalance = ethers.formatUnits(afterMintBalanceResult.toString(), 18);
      expect(afterMintBalance).toBe('500.0');

      await new Promise(resolve => setTimeout(resolve, 5*1000)); 
      const pauseResult = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'pause',
        args: [],
        wallet: walletAdapter,
        contractInterface: contractAbi
      });

      const pauseReceipt = await waitForReceipt(pauseResult.transactionHash);

      expect(pauseReceipt).toBeDefined();
      expect(pauseReceipt).not.toBeNull();
      expect(pauseReceipt!.status).toBe(1);
      
      await new Promise(resolve => setTimeout(resolve, 3*1000));

      // Verify paused state
      const pausedState = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'paused',
        args: [],
        wallet: walletAdapter,
        contractInterface: contractAbi // <<< ADDED ABI
      });

      expect(pausedState).toBe(true);

      try {
        await contractHandler.callMethod({
          contractId: contractId,
          functionName: 'transfer',
          args: [otherAddress, ethers.parseUnits('1', 18)],
          wallet: walletAdapter, // Use deployer's wallet
          contractInterface: contractAbi // <<< ADDED ABI
        });
        expect(true).toBe(false); // Force failure if no error thrown
      } catch (error: any) {
        // Error message might differ slightly based on ethers/provider version
        expect(error.message).toMatch(
          /ERC20Pausable: token transfer while paused|execution reverted.*(paused|0xd93c0665)/i
        );
      }

      // 4. Test Unpausing (requires owner)
      await new Promise(resolve => setTimeout(resolve, 5*1000));

      const unpauseResult = await contractHandler.callMethod({ // <<< Rename to unpauseResult
        contractId: contractId,
        functionName: 'unpause',
        args: [],
        wallet: walletAdapter, // Wallet required for write
        contractInterface: contractAbi // <<< ADDED ABI
      });

      const unpauseReceipt = await waitForReceipt(unpauseResult.transactionHash);

      expect(unpauseReceipt).toBeDefined();
      expect(unpauseReceipt).not.toBeNull();
      expect(unpauseReceipt!.status).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 3*1000));

      // Verify not paused state
      const unpausedState = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'paused',
        args: [],
        wallet: walletAdapter,
        contractInterface: contractAbi // <<< ADDED ABI
      });
      expect(unpausedState).toBe(false);

      // 5. Test Burning
      await new Promise(resolve => setTimeout(resolve, 5*1000));
      const burnAmount = ethers.parseUnits('100', 18);
      const burnResult = await contractHandler.callMethod({ // <<< Rename to burnResult
        contractId: contractId,
        functionName: 'burn',
        args: [burnAmount],
        wallet: walletAdapter, // Burn deployer's tokens
        contractInterface: contractAbi // <<< ADDED ABI
      });

      await waitForReceipt(burnResult.transactionHash);

      // Verify balance after burn
      const afterBurnBalanceResult = await contractHandler.callMethod({
        contractId: contractId,
        functionName: 'balanceOf',
        args: [deployerAddress],
        wallet: walletAdapter,
        contractInterface: contractAbi // <<< ADDED ABI
      });

      const afterBurnBalance = ethers.formatUnits(afterBurnBalanceResult.toString(), 18);
      expect(afterBurnBalance).toBe('900.0'); // Initial 1000 - 100 burned

      // 6. Test Permit (requires EIP-712 signing)
      await new Promise(resolve => setTimeout(resolve, 5*1000));

      try {
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const value = ethers.parseUnits('50', 18);
        const spenderAddress = otherAddress; // Renamed for clarity

         // Get nonce
        const nonceResult = await contractHandler.callMethod({
          contractId: contractId,
          functionName: 'nonces',
          args: [deployerAddress],
          wallet: walletAdapter,
          contractInterface: contractAbi 
        });
        const nonce = nonceResult.toString();

        // Domain
        const domain = {
          name: 'ComprehensiveToken',
          version: '1',
          chainId: (await walletAdapter.getNetwork()).chainId,
          verifyingContract: contractId
        };

       // Types
        const types = {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
          ]
        };

         // Value
        const permitValue = {
          owner: deployerAddress,
          spender: spenderAddress,
          value: value.toString(),
          nonce: nonce,
          deadline: deadline
        };

        // Sign
        const signature = await walletAdapter.signTypedData({ domain, types, value: permitValue });
        const sig = ethers.Signature.from(signature);

        // Call permit
        const permitResult = await contractHandler.callMethod({ 
          contractId: contractId,
          functionName: 'permit',
          args: [deployerAddress, spenderAddress, value, deadline, sig.v, sig.r, sig.s],
          wallet: walletAdapter, 
          contractInterface: contractAbi 
        });

        const permitReceipt = await waitForReceipt(permitResult.transactionHash);
        await new Promise(resolve => setTimeout(resolve, 3*1000));

        expect(permitReceipt).toBeDefined();
        expect(permitReceipt).not.toBeNull();
        expect(permitReceipt!.status).toBe(1);

        // Verify allowance
        const allowanceResult = await contractHandler.callMethod({
          contractId: contractId,
          functionName: 'allowance',
          args: [deployerAddress, spenderAddress],
          wallet: walletAdapter,
          contractInterface: compiled.artifacts.abi,
        });

        expect(allowanceResult.toString()).toBe(value.toString());

      } catch (permitError) {
        console.error("Permit test failed:", permitError);
        throw permitError;
      }

    }, 180000); // Increased timeout for blockchain interaction
  });
});