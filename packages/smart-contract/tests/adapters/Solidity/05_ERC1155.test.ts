import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../../src/index.js';
import { CompiledOutput, GenerateContractInput, IBaseContractHandler } from '../../../src/types/index.js';
import { ethers } from 'ethers';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS, INFURA_API_KEY } from '../../../config.js';
import { createWallet, IEVMWallet } from '@m3s/wallet';
import { NetworkHelper } from '@m3s/common';

// Test ERC1155 options
describe('ERC1155 Options Tests', () => {
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
    const input: GenerateContractInput = {
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'BurnableMultiToken',
        uri: 'ipfs://QmBurnable/{id}.json',
        burnable: true
      }
    };
    const burnableSource = await contractHandler.generateContract(input);

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

    // Check for all features in the combined token
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

  beforeEach(async () => {
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();

    const testNetworkName = 'sepolia';

    if (!INFURA_API_KEY) {
      throw new Error("INFURA_API_KEY is not set in config.js. Cannot run integration tests that require a specific RPC.");
    }
    const preferredRpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;

    const networkConfig = await networkHelper.getNetworkConfig(testNetworkName, [preferredRpcUrl]);

    if (!networkConfig || !networkConfig.rpcUrls || networkConfig.rpcUrls.length === 0) {
      throw new Error(`Failed to get a valid network configuration for ${testNetworkName} using preferred RPC from NetworkHelper.`);
    }

    if (!TEST_PRIVATE_KEY) {
      throw new Error("TEST_PRIVATE_KEY is not set in config.js. Cannot run integration tests requiring a funded account.");
    }

    walletAdapter = await createWallet<IEVMWallet>({
      name: 'ethers',
      version: '1.0.0',
      options: {
        privateKey: TEST_PRIVATE_KEY
      }
    });

    try {
      await walletAdapter.setProvider(networkConfig);
    } catch (error) {
      console.error(`[Test Setup] setProvider FAILED:`, error);
      throw error;
    }

    contractHandler = await createContractHandler({
      name: 'openZeppelin',
      version: '1.0.0',
      options: {
        preserveOutput: true,
        providerConfig: networkConfig
      }
    });
  });

  it('should deploy ERC1155 with multiple features and verify functionality', async () => {

    // 1. Generate contract
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
    const compiled: CompiledOutput = await contractHandler.compile({
      sourceCode: contractSource,
      language: 'solidity',
      contractName: 'ComplexMultiToken'
    });
    expect(compiled.artifacts?.abi).toBeDefined();
    expect(compiled.artifacts?.bytecode).toBeDefined();
    expect(compiled.getRegularDeploymentData).toBeDefined();

    // 3. Prepare deployment
    const accounts = await walletAdapter.getAccounts();
    const deployerAddress = accounts[0];


    if (!deployerAddress || !ethers.isAddress(deployerAddress)) {
      throw new Error(`Failed to get a valid deployer address from wallet adapter. Received: ${deployerAddress}`);
    }

    const constructorArgs: any[] = [deployerAddress]; // Only initialOwner is needed
    const contractAbi = compiled.artifacts.abi;

    // 4. Get deployment data with constructor args
    const deploymentData = await compiled.getRegularDeploymentData(constructorArgs);

    // 5. Send deployment transaction directly via wallet
    const deploymentTxHash = await walletAdapter.sendTransaction({
      data: deploymentData.data,
      value: deploymentData.value || '0'
    });

    // 6. Wait for receipt to get contract address
    const deploymentReceipt = await waitForReceipt(deploymentTxHash);
    if (!deploymentReceipt || !deploymentReceipt.contractAddress) {
      throw new Error(`Deployment failed. TxHash: ${deploymentTxHash}`);
    }

    const contractId = deploymentReceipt.contractAddress;

    expect(contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(deploymentTxHash).toBeDefined();

    // --- Test Features ---
    const tokenId1 = 1;
    const tokenId2 = 2;
    const mintAmount1 = 100;
    const mintAmount2 = 50;
    const burnAmount1 = 10;
    const data = '0x'; // Empty data

    // 7. Test Minting - NO CALLMETHOD, direct wallet transaction
    console.log('🎨 Testing minting...');
    const iface = new ethers.Interface(contractAbi);

    const mintCallData = iface.encodeFunctionData('mintBatch', [deployerAddress, [tokenId1, tokenId2], [mintAmount1, mintAmount2], data]);
    const mintTxHash = await walletAdapter.sendTransaction({
      to: contractId,
      data: mintCallData
    });

    const mintReceipt = await waitForReceipt(mintTxHash);
    expect(mintReceipt).toBeDefined();
    expect(mintReceipt).not.toBeNull();
    expect(mintReceipt!.status).toBe(1);

    // 8. Test Pausing (requires owner)
    console.log('⏸️ Testing pausing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pauseCallData = iface.encodeFunctionData('pause', []);
    const pauseTxHash = await walletAdapter.sendTransaction({
      to: contractId,
      data: pauseCallData
    });

    const pauseReceipt = await waitForReceipt(pauseTxHash);
    expect(pauseReceipt).toBeDefined();
    expect(pauseReceipt).not.toBeNull();
    expect(pauseReceipt!.status).toBe(1);

    // 9. Test Unpausing (requires owner)
    console.log('▶️ Testing unpausing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const unpauseCallData = iface.encodeFunctionData('unpause', []);
    const unpauseTxHash = await walletAdapter.sendTransaction({
      to: contractId,
      data: unpauseCallData
    });

    const unpauseReceipt = await waitForReceipt(unpauseTxHash);
    expect(unpauseReceipt).toBeDefined();
    expect(unpauseReceipt).not.toBeNull();
    expect(unpauseReceipt!.status).toBe(1);

    // 10. Test Burning
    console.log('🔥 Testing burning...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const burnCallData = iface.encodeFunctionData('burn', [deployerAddress, tokenId1, burnAmount1]);
    const burnTxHash = await walletAdapter.sendTransaction({
      to: contractId,
      data: burnCallData
    });

    const burnReceipt = await waitForReceipt(burnTxHash);
    expect(burnReceipt).toBeDefined();
    expect(burnReceipt).not.toBeNull();
    expect(burnReceipt!.status).toBe(1);

    // 11. Test URI Update (requires owner)
    console.log('🔗 Testing URI update...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const newUri = 'ipfs://QmNewUri/{id}.json';
    const setUriCallData = iface.encodeFunctionData('setURI', [newUri]);
    const setUriTxHash = await walletAdapter.sendTransaction({
      to: contractId,
      data: setUriCallData
    });

    const setUriReceipt = await waitForReceipt(setUriTxHash);
    expect(setUriReceipt).toBeDefined();
    expect(setUriReceipt).not.toBeNull();
    expect(setUriReceipt!.status).toBe(1);

    console.log('✅ All ERC1155 tests completed successfully!');

  }, 300000); // Longer timeout for blockchain interaction

  // Add these tests after your existing integration test in the ERC1155 file:

  it('should deploy UUPS ERC1155 proxy and verify upgradeability', async () => {
    console.log('🚀 Testing UUPS ERC1155 Proxy Deployment...');

    // 1. Generate upgradeable ERC1155
    const contractSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'UUPSMultiToken',
        uri: 'ipfs://QmUUPS/{id}.json',
        mintable: true,
        burnable: true,
        pausable: true,
        access: 'ownable',
        upgradeable: 'uups'
      }
    });

    // Verify it's upgradeable
    expect(contractSource).toContain('import {ERC1155Upgradeable}');
    expect(contractSource).toContain('UUPSUpgradeable');
    expect(contractSource).toContain('function initialize(');
    expect(contractSource).toContain('function _authorizeUpgrade(');
    expect(contractSource).toContain('constructor()');
    expect(contractSource).toContain('_disableInitializers()');

    // 2. Compile
    const compiled: CompiledOutput = await contractHandler.compile({
      sourceCode: contractSource,
      language: 'solidity',
      contractName: 'UUPSMultiToken'
    });

    expect(compiled.artifacts?.abi).toBeDefined();
    expect(compiled.artifacts?.bytecode).toBeDefined();
    expect(compiled.getProxyDeploymentData).toBeDefined();

    // 3. Get deployer address
    const accounts = await walletAdapter.getAccounts();
    const deployerAddress = accounts[0];
    expect(ethers.isAddress(deployerAddress)).toBe(true);

    // 4. Get deployment data (this should be proxy/upgradeable)
    const deploymentData = await compiled.getProxyDeploymentData([deployerAddress]);
    expect(deploymentData.type).toBe('proxy');

    // 5. Deploy implementation first
    console.log('📦 Deploying ERC1155 implementation...');
    const implTxHash = await walletAdapter.sendTransaction({
      data: deploymentData.implementation.data,
      value: deploymentData.implementation.value || '0'
    });
    const implReceipt = await waitForReceipt(implTxHash);
    expect(implReceipt?.status).toBe(1);
    const implementationAddress = implReceipt!.contractAddress!;

    // 6. Deploy proxy with real implementation address
    console.log('🔄 Deploying ERC1155 proxy...');
    const { ethers: ethersLib } = await import('ethers');
    const proxyFactory = new ethersLib.ContractFactory(
      deploymentData.proxy.abi,
      deploymentData.proxy.bytecode
    );

    // Use logicInitializeData instead of constructorArgs
    const proxyDeployTx = await proxyFactory.getDeployTransaction(
      implementationAddress,
      deploymentData.proxy.logicInitializeData
    );

    const proxyTxHash = await walletAdapter.sendTransaction({
      data: proxyDeployTx.data!,
      value: deploymentData.proxy.value || '0'
    });

    const proxyReceipt = await waitForReceipt(proxyTxHash);
    expect(proxyReceipt?.status).toBe(1);
    const proxyAddress = proxyReceipt!.contractAddress!;
    console.log('✅ ERC1155 Proxy deployed at:', proxyAddress);

    // 7. Test proxy functionality with ERC1155 operations
    console.log('🧪 Testing ERC1155 proxy functionality...');
    const iface = new ethers.Interface(compiled.artifacts.abi);

    // Test batch minting through proxy (should work)
    const tokenIds = [1, 2, 3];
    const amounts = [100, 200, 50];
    const data = '0x';

    const mintBatchCallData = iface.encodeFunctionData('mintBatch', [
      deployerAddress,
      tokenIds,
      amounts,
      data
    ]);

    const mintTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: mintBatchCallData
    });

    const mintReceipt = await waitForReceipt(mintTxHash);
    expect(mintReceipt?.status).toBe(1);

    // Test pause/unpause functionality through proxy
    console.log('⏸️ Testing pause through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pauseCallData = iface.encodeFunctionData('pause', []);
    const pauseTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: pauseCallData
    });

    const pauseReceipt = await waitForReceipt(pauseTxHash);
    expect(pauseReceipt?.status).toBe(1);

    console.log('▶️ Testing unpause through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const unpauseCallData = iface.encodeFunctionData('unpause', []);
    const unpauseTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: unpauseCallData,
      options: {
        gasLimit: '100000' // Explicit gas limit to skip estimation
      }
    });

    const unpauseReceipt = await waitForReceipt(unpauseTxHash);
    expect(unpauseReceipt?.status).toBe(1);

    // Test burning through proxy
    console.log('🔥 Testing burn through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const burnCallData = iface.encodeFunctionData('burn', [deployerAddress, tokenIds[0], 10]);
    const burnTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: burnCallData
    });

    const burnReceipt = await waitForReceipt(burnTxHash);
    expect(burnReceipt?.status).toBe(1);

    console.log('✅ UUPS ERC1155 Proxy deployment and functionality test passed!');

  }, 300000);

  it('should deploy Transparent ERC1155 proxy and verify functionality', async () => {
    console.log('🚀 Testing Transparent ERC1155 Proxy Deployment...');

    // 1. Generate upgradeable ERC1155 with transparent proxy
    const contractSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc1155',
      options: {
        name: 'TransparentMultiToken',
        uri: 'ipfs://QmTransparent/{id}.json',
        mintable: true,
        burnable: true,
        supply: true,
        access: 'ownable',
        upgradeable: 'transparent'
      }
    });

    // Verify it's upgradeable but NOT UUPS
    expect(contractSource).toContain('import {ERC1155Upgradeable}');
    expect(contractSource).toContain('function initialize(');
    expect(contractSource).not.toContain('UUPSUpgradeable'); // Transparent doesn't need UUPS
    expect(contractSource).toContain('constructor()');
    expect(contractSource).toContain('_disableInitializers()');

    // 2. Compile and test
    const compiled: CompiledOutput = await contractHandler.compile({
      sourceCode: contractSource,
      language: 'solidity',
      contractName: 'TransparentMultiToken'
    });

    const accounts = await walletAdapter.getAccounts();
    const deployerAddress = accounts[0];

    const deploymentData = await compiled.getProxyDeploymentData([deployerAddress]);
    expect(deploymentData.type).toBe('proxy');

    // Deploy implementation
    console.log('📦 Deploying Transparent ERC1155 implementation...');
    const implTxHash = await walletAdapter.sendTransaction({
      data: deploymentData.implementation.data,
      value: deploymentData.implementation.value || '0'
    });
    const implReceipt = await waitForReceipt(implTxHash);
    expect(implReceipt?.status).toBe(1);
    const implementationAddress = implReceipt!.contractAddress!;

    // Deploy proxy
    console.log('🔄 Deploying Transparent ERC1155 proxy...');
    const { ethers: ethersLib } = await import('ethers');
    const proxyFactory = new ethersLib.ContractFactory(
      deploymentData.proxy.abi,
      deploymentData.proxy.bytecode
    );

    const proxyDeployTx = await proxyFactory.getDeployTransaction(
      implementationAddress,
      deploymentData.proxy.logicInitializeData
    );

    const proxyTxHash = await walletAdapter.sendTransaction({
      data: proxyDeployTx.data!,
      value: deploymentData.proxy.value || '0'
    });

    const proxyReceipt = await waitForReceipt(proxyTxHash);
    expect(proxyReceipt?.status).toBe(1);
    const proxyAddress = proxyReceipt!.contractAddress!;
    console.log('✅ ERC1155 Proxy deployed at:', proxyAddress);

    // Test comprehensive ERC1155 functionality through proxy
    console.log('🧪 Testing comprehensive ERC1155 proxy functionality...');
    const iface = new ethers.Interface(compiled.artifacts.abi);

    // Test single mint
    const tokenId = 1;
    const mintAmount = 1000;
    const data = '0x';

    const mintCallData = iface.encodeFunctionData('mint', [
      deployerAddress,
      tokenId,
      mintAmount,
      data
    ]);

    const mintTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: mintCallData
    });

    const mintReceipt = await waitForReceipt(mintTxHash);
    expect(mintReceipt?.status).toBe(1);

    // Test URI update functionality (if updatableUri was enabled)
    console.log('🔗 Testing URI update through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const newUri = 'ipfs://QmNewTransparent/{id}.json';
      const setUriCallData = iface.encodeFunctionData('setURI', [newUri]);
      const setUriTxHash = await walletAdapter.sendTransaction({
        to: proxyAddress,
        data: setUriCallData
      });

      const setUriReceipt = await waitForReceipt(setUriTxHash);
      expect(setUriReceipt?.status).toBe(1);
      console.log('✅ URI update through proxy succeeded');
    } catch (uriError) {
      console.warn('⚠️ URI update not available (updatableUri might not be enabled)');
    }

    // Test batch operations through proxy
    console.log('📦 Testing batch operations through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const batchTokenIds = [10, 11, 12];
    const batchAmounts = [50, 75, 25];

    const mintBatchCallData = iface.encodeFunctionData('mintBatch', [
      deployerAddress,
      batchTokenIds,
      batchAmounts,
      data
    ]);

    const batchMintTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: mintBatchCallData
    });

    const batchMintReceipt = await waitForReceipt(batchMintTxHash);
    expect(batchMintReceipt?.status).toBe(1);

    // Test burn batch through proxy
    console.log('🔥 Testing batch burn through proxy...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const burnBatchCallData = iface.encodeFunctionData('burnBatch', [
      deployerAddress,
      batchTokenIds,
      [10, 15, 5] // Burn smaller amounts
    ]);

    const burnBatchTxHash = await walletAdapter.sendTransaction({
      to: proxyAddress,
      data: burnBatchCallData
    });

    const burnBatchReceipt = await waitForReceipt(burnBatchTxHash);
    expect(burnBatchReceipt?.status).toBe(1);

    console.log('✅ Transparent ERC1155 Proxy deployment and functionality test passed!');
  }, 300000)
  
});