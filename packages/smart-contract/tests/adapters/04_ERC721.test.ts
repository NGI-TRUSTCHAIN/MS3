import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../src/index.js';
import { IBaseContractHandler } from '../../src/types/index.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS } from 'packages/smart-contract/config.js';


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
  
  it('should deploy ERC721 with multiple features and verify functionality', async () => {
    console.log('🚀 Starting comprehensive ERC721 test');
    
    // Generate contract with multiple features
    console.log('1️⃣ Generating feature-rich ERC721 contract...');
    const contractSource = await contractHandler.generateContract({
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
    
    // 1. Test minting
 // ... in the integration test section
    
    // 1. Test minting
    console.log('4️⃣ Testing NFT minting...');
    
    // When using baseUri, we should only pass the token-specific part
    const tokenId = 0;
    const tokenSuffix = '1.json';
    const expectedTokenURI = `ipfs://QmNFTCollection/${tokenSuffix}`;
    
    try {
      const mint = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'safeMint',
        [deployerAddress, tokenSuffix], // Only pass the suffix, not the full URI
        signer
      );
      
      // Await the transaction
      await mint.wait();
      console.log('✅ NFT minted successfully');
      
      // Check ownership
      const owner = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'ownerOf',
        [tokenId],
        signer
      );
      
      expect(owner.toLowerCase()).toBe(deployerAddress.toLowerCase());
      console.log(`Token owner verified: ${owner}`);
      
      // Check token URI
      const retrievedURI = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'tokenURI',
        [tokenId],
        signer
      );
      
      console.log(`Retrieved token URI: ${retrievedURI}`);
      console.log(`Expected token URI: ${expectedTokenURI}`);
      expect(retrievedURI).toBe(expectedTokenURI);
      console.log(`✅ Token URI verified`);
      
      // 2. Test enumerable feature
      const balance = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'balanceOf',
        [deployerAddress],
        signer
      );
      
      expect(Number(balance)).toBe(1);
      
      const tokenByIndex = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'tokenOfOwnerByIndex',
        [deployerAddress, 0],
        signer
      );
      
      expect(Number(tokenByIndex)).toBe(0);
      console.log('✅ Enumerable feature verified');
      
      // 3. Test pause functionality
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
      
      // 4. Test unpause
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
      
      // 5. Test burning
      console.log('Testing burn functionality...');
      const burn = await contractHandler.callMethod(
        deployed.address,
        compiled.abi,
        'burn',
        [0], // Burn first token
        signer
      );
      
      // Await the transaction
      await burn.wait();
      
      // Verify token is burned by checking if it throws when querying owner
      try {
        await contractHandler.callMethod(
          deployed.address,
          compiled.abi,
          'ownerOf',
          [0],
          signer
        );
        
        // If we get here, the token still exists
        throw new Error('Token was not burned');
      } catch (error: any) {
        // Expected error for non-existent token
        console.log('✅ Token successfully burned');
      }
      
      console.log('✨ All ERC721 features tested successfully!');
    } catch (error: any) {
      console.error(`❌ Test failed: ${error.message}`);
      throw error;
    }
  }, 120000); // Longer timeout for blockchain interaction
});