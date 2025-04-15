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

// Test ERC721 options
describe('ERC721 Options Tests', () => {
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
  
  it('should generate basic ERC721 with required options', async () => {
    // Test basic required options (name and symbol)
    const basicSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'BasicNFT', 
        symbol: 'BNFT'
      }
    });
    
    expect(basicSource).toContain('contract BasicNFT is ERC721');
    expect(basicSource).toContain('ERC721("BasicNFT", "BNFT")');
    
    // Basic ERC721 should NOT have these features
    expect(basicSource).not.toContain('import {ERC721Enumerable}');
    expect(basicSource).not.toContain('import {ERC721URIStorage}');
    expect(basicSource).not.toContain('import {ERC721Pausable}');
    expect(basicSource).not.toContain('import {ERC721Burnable}');
  });
  
  it('should generate ERC721 with baseUri option', async () => {
    const baseUriSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'BaseUriNFT', 
        symbol: 'BUNFT',
        baseUri: 'ipfs://QmBaseUri/'
      }
    });
    
    expect(baseUriSource).toContain('_baseURI()');
    expect(baseUriSource).toContain('ipfs://QmBaseUri/');
  });
  
  it('should generate ERC721 with enumerable feature', async () => {
    const enumerableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'EnumerableNFT', 
        symbol: 'ENFT',
        enumerable: true
      }
    });
    
    expect(enumerableSource).toContain('import {ERC721Enumerable}');
    expect(enumerableSource).toContain('ERC721Enumerable');
  });
  
  it('should generate ERC721 with URI storage', async () => {
    const uriStorageSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'UriNFT', 
        symbol: 'UNFT',
        uriStorage: true
      }
    });
    
    expect(uriStorageSource).toContain('import {ERC721URIStorage}');
    expect(uriStorageSource).toContain('ERC721URIStorage');
  });
  
  it('should generate ERC721 with burnable feature', async () => {
    const burnableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'BurnableNFT', 
        symbol: 'BNFT',
        burnable: true
      }
    });
    
    expect(burnableSource).toContain('import {ERC721Burnable}');
    expect(burnableSource).toContain('ERC721Burnable');
  });
  
  it('should generate ERC721 with pausable feature', async () => {
    const pausableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'PausableNFT', 
        symbol: 'PNFT',
        pausable: true,
        access: 'ownable' 
      }
    });
    
    expect(pausableSource).toContain('import {ERC721Pausable}');
    expect(pausableSource).toContain('ERC721Pausable');
    expect(pausableSource).toContain('function pause()');
    expect(pausableSource).toContain('function unpause()');
  });
  
  it('should generate ERC721 with mintable feature', async () => {
    const mintableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'MintableNFT', 
        symbol: 'MNFT',
        mintable: true,
        access: 'ownable'
      }
    });
    
    expect(mintableSource).toContain('function safeMint(');
    expect(mintableSource).toContain('onlyOwner');
  });
  
  it('should generate ERC721 with incremental IDs', async () => {
    const incrementalSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'IncrementalNFT', 
        symbol: 'INFT',
        mintable: true,
        access: 'ownable',
        incremental: true
      }
    });
    
    expect(incrementalSource).toContain('uint256 private _nextTokenId');
    expect(incrementalSource).toContain('_nextTokenId++');
  });
  
  it('should generate ERC721 with votes feature', async () => {
    const votesSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'VotesNFT', 
        symbol: 'VNFT',
        votes: true
      }
    });
    
    expect(votesSource).toContain('import {ERC721Votes}');
    expect(votesSource).toContain('ERC721Votes');
  });
  
  it('should generate ERC721 with custom access control', async () => {
    // Test roles
    const rolesSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'RolesNFT', 
        symbol: 'RNFT',
        mintable: true,
        access: 'roles'
      }
    });
    
    expect(rolesSource).toContain('import {AccessControl}');
    expect(rolesSource).toContain('MINTER_ROLE');
    expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');
    
    // Test ownable
    const ownableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'OwnableNFT', 
        symbol: 'ONFT',
        mintable: true,
        access: 'ownable'
      }
    });
    
    expect(ownableSource).toContain('import {Ownable}');
    expect(ownableSource).toContain('onlyOwner');
  });
  
  it('should generate ERC721 with multiple features combined', async () => {
    const complexSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'ComplexNFT', 
        symbol: 'CNFT',
        baseUri: 'ipfs://QmNFTCollection/',
        enumerable: true,
        uriStorage: true,
        burnable: true,
        pausable: true,
        mintable: true,
        incremental: true,
        access: 'ownable'
      }
    });
    
    // Check for all features in the combined NFT
    expect(complexSource).toContain('import {ERC721');
    expect(complexSource).toContain('import {ERC721Enumerable}');
    expect(complexSource).toContain('import {ERC721URIStorage}');
    expect(complexSource).toContain('import {ERC721Burnable}');
    expect(complexSource).toContain('import {ERC721Pausable}');
    expect(complexSource).toContain('contract ComplexNFT is ERC721');
    expect(complexSource).toContain('uint256 private _nextTokenId');
    expect(complexSource).toContain('function safeMint(');
    expect(complexSource).toContain('function pause()');
    expect(complexSource).toContain('function unpause()');
    expect(complexSource).toContain('_baseURI()');
    expect(complexSource).toContain('ipfs://QmNFTCollection/');
  });
  
  it('should generate ERC721 with upgradeability', async () => {
    const upgradeableSource = await contractHandler.generateContract({
      standard: 'ERC721',
      options: { 
        name: 'UpgradeableNFT', 
        symbol: 'UNFT',
        mintable: true,
        access: 'ownable',
        upgradeable: 'uups'
      }
    });
    
    expect(upgradeableSource).toContain('import {ERC721Upgradeable}');
    expect(upgradeableSource).toContain('UUPSUpgradeable');
    expect(upgradeableSource).toContain('initialize');
  });
});

// Full integration tests for real blockchain deployment
(RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full ERC721 Integration Tests', () => {
  let signer: ethers.Wallet;
  let contractHandler: IBaseContractHandler;
  let provider: ethers.Provider;

  beforeEach(async () => {
    provider = getTestProvider();
    signer = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc721'), // Use unique test dir
        preserveOutput: true,
        providerConfig: { rpcUrl: (provider as any).connection?.url || 'https://ethereum-sepolia-rpc.publicnode.com' } // Pass provider config for reads
      }
    });
    // Initialization is handled by createContractHandler -> OpenZeppelinAdapter.create
  });
  
  it('should deploy ERC721 with multiple features and verify functionality', async () => {
    console.log('🚀 Starting comprehensive ERC721 test');

    // 1. Generate contract
    console.log('1️⃣ Generating feature-rich ERC721 contract...');
    const contractSource = await contractHandler.generateContract({
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'ComplexNFT',
        symbol: 'CNFT',
        baseUri: 'ipfs://QmNFTCollection/',
        enumerable: true,
        uriStorage: true,
        mintable: true,
        pausable: true,
        burnable: true,
        incremental: true,
        access: 'ownable'
      }
    });

    // 2. Compile
    console.log('2️⃣ Compiling the contract...');
    const compiled: CompiledOutput = await contractHandler.compile({
        sourceCode: contractSource,
        language: 'solidity',
        contractName: 'ComplexNFT'
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
    const tokenId = 0; // First token ID (due to incremental)

    // 1. Mint a token (write)
    console.log(`Testing mint functionality (minting token ${tokenId})...`);
    const mintResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'safeMint',
        args: [deployerAddress], // Mint to deployer
        wallet: signer
    });
    const mintReceipt = await provider.waitForTransaction(mintResult.transactionHash, 1, 60000);
    expect(mintReceipt?.status).toBe(1);
    console.log(`✅ Token ${tokenId} minted successfully`);

    // Verify ownership (read)
    const owner = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'ownerOf',
        args: [tokenId]
    });
    expect(owner.toLowerCase()).toBe(deployerAddress.toLowerCase());
    console.log(`✅ Ownership verified`);

    // 2. Test URI Storage & Base URI (read)
    console.log('Testing token URI...');
    const retrievedURI = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'tokenURI',
        args: [tokenId]
    });
    const expectedTokenURI = `ipfs://QmNFTCollection/${tokenId}`;
    console.log(`Retrieved token URI: ${retrievedURI}`);
    expect(retrievedURI).toBe(expectedTokenURI);
    console.log(`✅ Token URI verified`);

    // 3. Test enumerable feature (read)
    console.log('Testing enumerable feature...');
    const balance = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'balanceOf',
        args: [deployerAddress]
    });
    expect(Number(balance)).toBe(1);

    const tokenByIndex = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'tokenOfOwnerByIndex',
        args: [deployerAddress, 0] // First token for this owner
    });
    expect(Number(tokenByIndex)).toBe(tokenId); // Should be the token we minted
    console.log('✅ Enumerable feature verified');

    // 4. Test pause functionality (write)
    console.log('Testing pause functionality...');
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

    // 5. Test unpause (write)
    console.log('Testing unpause functionality...');
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

    // 6. Test burning (write)
    console.log('Testing burn functionality...');
    const burnResult = await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi,
        functionName: 'burn',
        args: [tokenId],
        wallet: signer
    });
    const burnReceipt = await provider.waitForTransaction(burnResult.transactionHash, 1, 60000);
    expect(burnReceipt?.status).toBe(1);

    // Verify token is burned by checking if ownerOf throws (read)
    try {
      await contractHandler.callMethod({
          contractId: contractId,
          contractInterface: contractAbi,
          functionName: 'ownerOf',
          args: [tokenId]
      });
      // If we get here, the token still exists - fail the test
      throw new Error('Token was not burned successfully');
    } catch (error: any) {
      // Expecting an error (like 'ERC721NonexistentToken')
      expect(error.message).toContain('revert'); // Check for revert reason
      console.log('✅ Token successfully burned (ownerOf reverted as expected)');
    }

    console.log('✨ All testable ERC721 features verified successfully!');
  }, 300000); // Longer timeout for blockchain interaction
});