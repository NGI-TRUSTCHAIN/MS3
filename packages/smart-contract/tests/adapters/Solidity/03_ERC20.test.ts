import '../../../src/adapters/openZeppelin/openZeppelin.registration.js'

import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { createContractHandler, GenerateContractInput, IBaseContractHandler } from '../../../src/index.js';
import { testContractHandlerInterface } from '../../02_IBaseContractHandler.test.js';
import { ethers } from 'ethers';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS, INFURA_API_KEY } from '../../../config.js';
import { createWallet, IEVMWallet } from '@m3s/wallet';
import { NetworkHelper } from '@m3s/common';
import * as node_path from 'path';
import * as fs_promises from 'fs/promises';

// Debug check for adapter registration
import { registry } from '@m3s/common';
const smartContractAdapters = registry.getModuleAdapters('smart-contract');
console.log('🔍 Available smart-contract adapters:', smartContractAdapters.map(a => `${a.name}@${a.version}`));

describe('OpenZeppelinAdapter Tests', () => {

  // Test interface implementation (remains as is)
  describe('OpenZeppelinAdapter - Interface Implementation', () => {
    let contractHandler: IBaseContractHandler;

    beforeEach(async () => {
      contractHandler = await createContractHandler({
        name: 'openZeppelin',
        version: '1.0.0',
        options: {
          preserveOutput: true // Default for interface tests, can be overridden by specific test needs
        }
      });
    });

    it('supports contract handler interface', () => {
      testContractHandlerInterface(contractHandler, true); // Skip deployment tests
    });
  });

  // Test ERC20 options (generation tests, remains skipped as per original and user focus)
  describe('ERC20 Options Tests', () => {
    let contractHandler: IBaseContractHandler;

    beforeEach(async () => {
      contractHandler = await createContractHandler({
        name: 'openZeppelin',
        version: '1.0.0',
        options: {
          preserveOutput: true,
        }
      });
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
      expect(basicSource).toContain('import {ERC20Permit}'); // Default by OZ Wizard
      expect(basicSource).toContain('ERC20Permit("BasicToken")'); // Default by OZ Wizard
      expect(basicSource).not.toContain('import {ERC20Burnable}');
      expect(basicSource).not.toContain('import {ERC20Pausable}');
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
          access: 'ownable'
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
          premint: '1000000' // Amount in full units
        }
      };
      const premintSource = await contractHandler.generateContract(input);
      expect(premintSource).toContain('_mint(');
      // Regex to match _mint(some_address, 1000000 * 10 ** decimals())
      expect(premintSource).toMatch(/_mint\(\w+,\s*1000000\s*\*\s*10\s*\*\*\s*decimals\(\)\)/);
    });

    it('should generate ERC20 with mintable feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'MintableToken',
          symbol: 'MTK',
          mintable: true,
          access: 'ownable'
        }
      };
      const mintableSource = await contractHandler.generateContract(input);

      expect(mintableSource).toContain('function mint(address to, uint256 amount)');
      expect(mintableSource).toContain('onlyOwner');
    });

    it('should generate ERC20 with permit feature', async () => {
      const input: GenerateContractInput = {
        language: 'solidity',
        template: 'openzeppelin_erc20',
        options: {
          name: 'PermitToken',
          symbol: 'PRM',
          permit: true // Explicitly request permit
        }
      };
      const permitSource = await contractHandler.generateContract(input);

      expect(permitSource).toContain('import {ERC20Permit}');
      expect(permitSource).toContain('ERC20Permit("PermitToken")');
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

      // Test ownable
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

      expect(complexSource).toContain('import {ERC20}');
      expect(complexSource).toContain('import {ERC20Burnable}');
      expect(complexSource).toContain('import {ERC20Pausable}');
      expect(complexSource).toContain('import {ERC20Permit}');
      expect(complexSource).toContain('import {ERC20Votes}');
      expect(complexSource).toContain('import {ERC20FlashMint}');
      expect(complexSource).toContain('import {Ownable}');
      expect(complexSource).toContain('contract ComprehensiveToken is');
      expect(complexSource).toContain('constructor(address recipient, address initialOwner)');
      expect(complexSource).toMatch(/_mint\(recipient,\s*1000\s*\*\s*10\s*\*\*\s*decimals\(\)\)/);
      expect(complexSource).toContain('function pause() public onlyOwner');
      expect(complexSource).toContain('function unpause() public onlyOwner');
      expect(complexSource).toContain('function mint(address to, uint256 amount) public onlyOwner');
      expect(complexSource).toContain('onlyOwner');
    });
  });

  // Full integration tests for real blockchain deployment
  (RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full Integration Tests', () => {
    let walletAdapter: IEVMWallet;
    let contractHandler: IBaseContractHandler & { solidityCompilerConfig: { workDir: string } };
    let activeTempWorkDir: string | undefined; // To store temp workDir path for cleanup

    // Centralized setup function
    const setupTestEnvironmentInternal = async (preserveOutput: boolean, useTempWorkDir: boolean = false) => {
      const networkHelper = NetworkHelper.getInstance();
      await networkHelper.ensureInitialized();

      const preferredRpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
      const networkConfig = await networkHelper.getNetworkConfig('sepolia', [preferredRpcUrl]);
      const testNetworkName = 'sepolia';

      if (!INFURA_API_KEY) throw new Error("INFURA_API_KEY is not set.");
      if (!networkConfig?.rpcUrls?.length) throw new Error(`No RPC for ${testNetworkName}.`);
      if (!TEST_PRIVATE_KEY) throw new Error("TEST_PRIVATE_KEY is not set.");

      walletAdapter = await createWallet<IEVMWallet>({
        name: 'ethers', version: '1.0.0', options: { privateKey: TEST_PRIVATE_KEY }
      });
      await walletAdapter.setProvider(networkConfig);

      let workDirToUse: string | undefined = undefined;
      if (useTempWorkDir) {
        // Clean up previous temp dir if any, before creating a new one for this test run
        if (activeTempWorkDir) {
          try {
            // console.log(`[Test Setup] Cleaning up previous temp dir: ${activeTempWorkDir}`);
            await fs_promises.rm(activeTempWorkDir, { recursive: true, force: true });
          } catch (err) {
            // Log error but don't fail the setup, as OS might have already cleaned it or other issues.
            console.warn(`[Test Setup] Could not clean up previous temp dir ${activeTempWorkDir}:`, (err as Error).message);
          }
          activeTempWorkDir = undefined;
        }
        const os = await import('os')
        activeTempWorkDir = await fs_promises.mkdtemp(node_path.join(os.tmpdir(), `m3s_erc20_oz_test_`));
        workDirToUse = activeTempWorkDir;
        // console.log(`[Test Setup] Using temp workDir: ${workDirToUse} for preserveOutput: ${preserveOutput}`);
      } else {
        // If not using temp, ensure activeTempWorkDir is cleared if it was set by a previous test
        if (activeTempWorkDir) {
          // This case should ideally not be hit if cleanup is managed well by afterEach
          // console.log(`[Test Setup] Clearing activeTempWorkDir as current test does not use temp workDir.`);
          activeTempWorkDir = undefined;
        }
        // console.log(`[Test Setup] Using default workDir for preserveOutput: ${preserveOutput}`);
      }

      contractHandler = await createContractHandler({
        name: 'openZeppelin', version: '1.0.0',
        options: {
          preserveOutput,
          providerConfig: networkConfig,
          ...(workDirToUse ? { workDir: workDirToUse } : {}) // Conditionally set workDir
        }
      }) as IBaseContractHandler & { solidityCompilerConfig: { workDir: string } };
    };

    // Centralized cleanup function for temporary directories
    const cleanupCurrentTempWorkDir = async () => {
      if (activeTempWorkDir) {
        try {
          await fs_promises.rm(activeTempWorkDir, { recursive: true, force: true });
          // console.log(`🧹 Cleaned up temp work dir: ${activeTempWorkDir}`);
        } catch (err) {
          console.error(`⚠️ Error cleaning up temp work dir ${activeTempWorkDir}:`, (err as Error).message);
        }
        activeTempWorkDir = undefined;
      }
    };

    const waitForReceipt = async (txHash: string, maxAttempts = 20, waitTime = 6000): Promise<ethers.TransactionReceipt | null> => {
      for (let i = 0; i < maxAttempts; i++) {
        const receipt = await walletAdapter.getTransactionReceipt(txHash);
        if (receipt) {
          console.log(`Receipt found for ${txHash} (attempt ${i + 1}). Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
          return receipt;
        }
        console.log(`Receipt not found for ${txHash} (attempt ${i + 1}). Waiting ${waitTime / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      console.error(`Receipt not found for ${txHash} after ${maxAttempts} attempts.`);
      return null;
    };

    // Test Suite 1: Non-Proxy ERC20 Functionality
    describe('Standard ERC20 Deployment and Functionality', () => {
      beforeEach(async () => {
        await setupTestEnvironmentInternal(true, false); // preserve: true, useTempWorkDir: false
      });
      afterEach(async () => {
        await cleanupCurrentTempWorkDir(); // Cleanup if any temp dir was somehow created
      });

      it('should deploy ERC20 with multiple features and verify functionality', async () => {
        console.log('🚀 Testing Standard ERC20 (Non-Proxy) Deployment & Functionality...');
        // ... existing test logic ...
        // Uses `contractHandler` set in beforeEach
        const accounts = await walletAdapter.getAccounts();
        const deployerAddress = accounts[0];
        const premintAmountStr = '10000';

        const sourceCode = await contractHandler.generateContract({
          language: 'solidity',
          template: 'openzeppelin_erc20',
          options: {
            name: 'MultiFeatureToken',
            symbol: 'MFT',
            premint: premintAmountStr,
            mintable: true,
            pausable: true,
            burnable: true,
            access: 'ownable'
          }
        });

        const compiled = await contractHandler.compile({
          sourceCode,
          language: 'solidity',
          contractName: 'MultiFeatureToken'
        });
        expect(compiled.artifacts?.abi).toBeDefined();
        // console.log('MultiFeatureToken ABI:', JSON.stringify(compiled.artifacts.abi, null, 2));

        // Get the required constructor args spec (for debugging or UI)
        const argSpec = compiled.getDeploymentArgsSpec();
        console.log('Required constructor args:', argSpec);

        // Prepare constructor args (should match the ABI)
        const constructorArgs = [deployerAddress, deployerAddress];

        // Use the new method for regular deployment
        const deploymentData = await compiled.getRegularDeploymentData(constructorArgs);
        expect(deploymentData.type).toBe('regular');

        const deployTxHash = await walletAdapter.sendTransaction({
          data: deploymentData.data,
          value: deploymentData.value || '0'
        });
        const deployReceipt = await waitForReceipt(deployTxHash);
        expect(deployReceipt?.status).toBe(1);
        const contractAddress = deployReceipt!.contractAddress!;
        console.log(`✅ MultiFeatureToken (Regular) deployed at: ${contractAddress}`);

        const iface = new ethers.Interface(compiled.artifacts.abi);

        const balanceCallData = iface.encodeFunctionData('balanceOf', [deployerAddress]);
        const initialBalanceHex = await walletAdapter.callContract(contractAddress, balanceCallData);
        const initialBalance = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], initialBalanceHex)[0];
        const expectedPremint = ethers.parseUnits(premintAmountStr, 18);
        expect(initialBalance).toEqual(expectedPremint);
        console.log(`✅ Premint to deployer verified: ${ethers.formatUnits(initialBalance, 18)} MFT`);

        const mintAmount = ethers.parseUnits('500', 18);
        const recipientTwo = ethers.Wallet.createRandom().address;
        const mintCallData = iface.encodeFunctionData('mint', [recipientTwo, mintAmount]);
        const mintTxHash = await walletAdapter.sendTransaction({ to: contractAddress, data: mintCallData });
        const mintReceipt = await waitForReceipt(mintTxHash);
        expect(mintReceipt?.status).toBe(1);

        const balanceRecipientTwoHex = await walletAdapter.callContract(contractAddress, iface.encodeFunctionData('balanceOf', [recipientTwo]));
        const balanceRecipientTwo = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], balanceRecipientTwoHex)[0];
        expect(balanceRecipientTwo).toEqual(mintAmount);
        console.log(`✅ Mint to ${recipientTwo} verified: ${ethers.formatUnits(balanceRecipientTwo, 18)} MFT`);

        const pauseCallData = iface.encodeFunctionData('pause', []);
        const pauseTxHash = await walletAdapter.sendTransaction({ to: contractAddress, data: pauseCallData });
        const pauseReceipt = await waitForReceipt(pauseTxHash);
        expect(pauseReceipt?.status).toBe(1);

        const transferAmount = ethers.parseUnits('1', 18);
        const transferCallData = iface.encodeFunctionData('transfer', [recipientTwo, transferAmount]);
        let transferFailed = false;
        try {
          const txHash = await walletAdapter.sendTransaction({ to: contractAddress, data: transferCallData });
          const txReceipt = await waitForReceipt(txHash);
          // If receipt exists and status is 0, it means the tx reverted
          if (txReceipt && txReceipt.status === 0) {
            transferFailed = true;
          }
        } catch (e: any) {
          transferFailed = true;
          expect(e.message).toMatch(/revert|paused|ERC20Pausable/i);
        }
        expect(transferFailed).toBe(true);
        console.log(`✅ Pause verified (transfer failed as expected)`);

        const unpauseCallData = iface.encodeFunctionData('unpause', []);
        const unpauseTxHash = await walletAdapter.sendTransaction({ to: contractAddress, data: unpauseCallData });
        const unpauseReceipt = await waitForReceipt(unpauseTxHash);
        expect(unpauseReceipt?.status).toBe(1);

        const transferTxHash = await walletAdapter.sendTransaction({ to: contractAddress, data: transferCallData });
        const transferReceipt = await waitForReceipt(transferTxHash);
        expect(transferReceipt?.status).toBe(1);
        console.log(`✅ Unpause verified (transfer succeeded)`);

        const burnAmount = ethers.parseUnits('100', 18);
        const burnCallData = iface.encodeFunctionData('burn', [burnAmount]);
        const burnTxHash = await walletAdapter.sendTransaction({ to: contractAddress, data: burnCallData });
        const burnReceipt = await waitForReceipt(burnTxHash);
        expect(burnReceipt?.status).toBe(1);

        const balanceAfterBurnHex = await walletAdapter.callContract(contractAddress, balanceCallData);
        const balanceAfterBurn = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], balanceAfterBurnHex)[0];
        const expectedBalanceAfterBurn = expectedPremint - transferAmount - burnAmount;
        expect(balanceAfterBurn).toEqual(expectedBalanceAfterBurn);
        console.log(`✅ Burn verified. Deployer new balance: ${ethers.formatUnits(balanceAfterBurn, 18)} MFT`);
        console.log('✅ Standard ERC20 (Non-Proxy) tests passed!');
      }, 300000);
    });

    // Test Suite 2: Proxy Artifact Preservation
    describe('Proxy Artifact Preservation Tests', () => {
      // This suite specifically uses temporary work directories.
      // beforeEach for each nested describe will call setupTestEnvironmentInternal with useTempWorkDir: true
      afterEach(async () => {
        await cleanupCurrentTempWorkDir(); // Crucial for this suite
      });

      const testProxyDeploymentFileSystem = async (preserve: boolean, contractNamePrefix: string) => {
        // contractHandler is set by the beforeEach of the nested describe below
        console.log(`🚀 Testing Proxy Artifact Preservation (preserveOutput: ${preserve}, prefix: ${contractNamePrefix}, workDir: ${contractHandler.solidityCompilerConfig.workDir})...`);
        const accounts = await walletAdapter.getAccounts();
        const deployerAddress = accounts[0];

        const sourceCode = await contractHandler.generateContract({
          language: 'solidity', template: 'openzeppelin_erc20',
          options: { name: `${contractNamePrefix}Token`, symbol: `${contractNamePrefix.toUpperCase()}SYM`, upgradeable: 'uups', access: 'ownable' }
        });
        const compiled = await contractHandler.compile({
          sourceCode, language: 'solidity', contractName: `${contractNamePrefix}Token`
        });

        const proxyDeploymentStructure = await compiled.getProxyDeploymentData([deployerAddress]);

        const implTxHash = await walletAdapter.sendTransaction({ data: proxyDeploymentStructure.implementation.data, value: proxyDeploymentStructure.implementation.value || '0' });
        const implReceipt = await waitForReceipt(implTxHash);
        expect(implReceipt?.status).toBe(1);
        const implementationAddress = implReceipt!.contractAddress!;

        const proxyInfo = proxyDeploymentStructure.proxy;
        const proxyFactory = new ethers.ContractFactory(proxyInfo.abi, proxyInfo.bytecode);
        const proxyDeployTx = await proxyFactory.getDeployTransaction(implementationAddress, proxyInfo.logicInitializeData);

        const proxyTxHash = await walletAdapter.sendTransaction({ data: proxyDeployTx.data!, value: proxyInfo.value || '0' });
        const proxyReceipt = await waitForReceipt(proxyTxHash);
        expect(proxyReceipt?.status).toBe(1);
        console.log(`✅ ${contractNamePrefix} Proxy (preserve: ${preserve}) deployed at: ${proxyReceipt!.contractAddress!}`);

        const mainAdapterWorkDir = contractHandler.solidityCompilerConfig.workDir; // This will be the temp dir
        const expectedProxyCacheDirInWorkDir = node_path.join(mainAdapterWorkDir, 'm3s_proxies_cache');

        if (preserve) {
          try {
            await fs_promises.access(expectedProxyCacheDirInWorkDir);
            console.log(`✅ Verified proxy artifacts base directory exists: ${expectedProxyCacheDirInWorkDir}`);
            const proxyBuildHashDirs = await fs_promises.readdir(expectedProxyCacheDirInWorkDir);
            expect(proxyBuildHashDirs.length).toBeGreaterThan(0);
            console.log(`✅ Proxy artifacts base directory is not empty.`);
            const firstProxyBuildDir = node_path.join(expectedProxyCacheDirInWorkDir, proxyBuildHashDirs[0]);
            const artifactJsonPath = node_path.join(firstProxyBuildDir, 'artifacts', 'contracts', 'M3S_ERC1967Proxy.sol', 'M3S_ERC1967Proxy.json');
            await fs_promises.access(artifactJsonPath);
            console.log(`✅ Verified proxy artifact JSON exists: ${artifactJsonPath}`);
            console.log(`✅ Proxy artifacts ARE preserved in ${expectedProxyCacheDirInWorkDir} (preserveOutput: true).`);
          } catch (error: any) {
            console.error(`❌ Error during 'preserve: true' check for proxy artifacts at ${expectedProxyCacheDirInWorkDir}:`, error);
            throw error;
          }
        } else {
          try {
            await fs_promises.access(expectedProxyCacheDirInWorkDir);
            const files = await fs_promises.readdir(expectedProxyCacheDirInWorkDir);
            if (files.length > 0) {
              throw new Error(`Proxy artifacts directory ${expectedProxyCacheDirInWorkDir} found in temp workDir and is NOT empty when preserveOutput is false.`);
            }
            console.log(`✅ Proxy artifacts directory ${expectedProxyCacheDirInWorkDir} found in temp workDir but is empty (acceptable for preserveOutput: false).`);
          } catch (error: any) {
            expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
            console.log(`✅ Verified proxy artifacts directory ${expectedProxyCacheDirInWorkDir} does NOT exist in temp workDir (preserveOutput: false), as expected.`);
          }
        }
      };

      describe('With preserveOutput: false', () => {
        beforeEach(async () => await setupTestEnvironmentInternal(false, true)); // preserve: false, useTempWorkDir: true
        it('UUPS Proxy: should NOT preserve proxy artifacts in workDir', async () => {
          await testProxyDeploymentFileSystem(false, 'NoPreserveUUPS');
        }, 300000);
      });

      describe('With preserveOutput: true', () => {
        beforeEach(async () => await setupTestEnvironmentInternal(true, true)); // preserve: true, useTempWorkDir: true
        it('UUPS Proxy: should PRESERVE proxy artifacts in workDir/m3s_proxies_cache', async () => {
          await testProxyDeploymentFileSystem(true, 'PreserveUUPS');
        }, 300000);
      });
    });

    // Test Suite 3: General Proxy Functionality
    describe('General Proxy Functionality Tests', () => {
      beforeEach(async () => {
        await setupTestEnvironmentInternal(true, true); // preserve: true, useTempWorkDir: true
      });
      afterEach(async () => {
        await cleanupCurrentTempWorkDir();
      });

      it('UUPS ERC20 Proxy: should deploy and verify functionality', async () => {
        console.log('🚀 Testing UUPS ERC20 Proxy Functionality...');
        // ... existing test logic ...
        // Uses `contractHandler` set in beforeEach
        const accounts = await walletAdapter.getAccounts();
        const deployerAddress = accounts[0];

        const sourceCode = await contractHandler.generateContract({
          language: 'solidity', template: 'openzeppelin_erc20',
          options: { name: 'FuncUUPSToken', symbol: 'FUUPS', upgradeable: 'uups', access: 'ownable', mintable: true }
        });
        const compiled = await contractHandler.compile({
          sourceCode, language: 'solidity', contractName: 'FuncUUPSToken'
        });

        const proxyDeploymentStructure = await compiled.getProxyDeploymentData([deployerAddress]);

        const implTxHash = await walletAdapter.sendTransaction({ data: proxyDeploymentStructure.implementation.data });
        const implReceipt = await waitForReceipt(implTxHash);
        expect(implReceipt?.status).toBe(1);
        const implementationAddress = implReceipt!.contractAddress!;

        const proxyInfo = proxyDeploymentStructure.proxy;
        const proxyFactory = new ethers.ContractFactory(proxyInfo.abi, proxyInfo.bytecode);
        const proxyDeployTx = await proxyFactory.getDeployTransaction(implementationAddress, proxyInfo.logicInitializeData);
        const proxyTxHash = await walletAdapter.sendTransaction({ data: proxyDeployTx.data! });
        const proxyReceipt = await waitForReceipt(proxyTxHash);
        expect(proxyReceipt?.status).toBe(1);
        const proxyAddress = proxyReceipt!.contractAddress!;
        console.log(`✅ UUPS ERC20 Proxy deployed at: ${proxyAddress}`);

        const iface = new ethers.Interface(compiled.artifacts.abi);
        const mintAmount = ethers.parseUnits('1000', 18);
        const mintCallData = iface.encodeFunctionData('mint', [deployerAddress, mintAmount]);
        const mintTxHash = await walletAdapter.sendTransaction({ to: proxyAddress, data: mintCallData });
        const mintReceipt = await waitForReceipt(mintTxHash);
        expect(mintReceipt?.status).toBe(1);
        console.log('✅ UUPS ERC20 Proxy mint functionality test passed!');
      }, 300000);

      it('Transparent ERC20 Proxy: should deploy and verify functionality', async () => {
        console.log('🚀 Testing Transparent (ERC1967) ERC20 Proxy Functionality...');
        // ... existing test logic ...
        // Uses `contractHandler` set in beforeEach
        const accounts = await walletAdapter.getAccounts();
        const deployerAddress = accounts[0];

        const sourceCode = await contractHandler.generateContract({
          language: 'solidity', template: 'openzeppelin_erc20',
          options: { name: 'FuncTransToken', symbol: 'FTRANS', upgradeable: 'transparent', access: 'ownable', mintable: true }
        });
        const compiled = await contractHandler.compile({
          sourceCode, language: 'solidity', contractName: 'FuncTransToken'
        });

        const proxyDeploymentStructure = await compiled.getProxyDeploymentData([deployerAddress]);

        const implTxHash = await walletAdapter.sendTransaction({ data: proxyDeploymentStructure.implementation.data });
        const implReceipt = await waitForReceipt(implTxHash);
        expect(implReceipt?.status).toBe(1);
        const implementationAddress = implReceipt!.contractAddress!;

        const proxyInfo = proxyDeploymentStructure.proxy;
        const proxyFactory = new ethers.ContractFactory(proxyInfo.abi, proxyInfo.bytecode);
        const proxyDeployTx = await proxyFactory.getDeployTransaction(implementationAddress, proxyInfo.logicInitializeData);
        const proxyTxHash = await walletAdapter.sendTransaction({ data: proxyDeployTx.data! });
        const proxyReceipt = await waitForReceipt(proxyTxHash);
        expect(proxyReceipt?.status).toBe(1);
        const proxyAddress = proxyReceipt!.contractAddress!;
        console.log(`✅ Transparent ERC20 Proxy deployed at: ${proxyAddress}`);

        const iface = new ethers.Interface(compiled.artifacts.abi);
        const mintAmount = ethers.parseUnits('500', 18);
        const mintCallData = iface.encodeFunctionData('mint', [deployerAddress, mintAmount]);
        const mintTxHash = await walletAdapter.sendTransaction({ to: proxyAddress, data: mintCallData });
        const mintReceipt = await waitForReceipt(mintTxHash);
        expect(mintReceipt?.status).toBe(1);
        console.log('✅ Transparent (ERC1967) ERC20 Proxy mint functionality test passed!');
      }, 300000);
    });
  });
});