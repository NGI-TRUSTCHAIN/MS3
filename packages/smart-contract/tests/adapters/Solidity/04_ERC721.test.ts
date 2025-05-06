import { describe, beforeEach, it, expect } from 'vitest';
import { createContractHandler } from '../../../src/index.js';
import { CompiledOutput, DeployedOutput, GenerateContractInput, IBaseContractHandler } from '../../../src/types/index.js';
import { ethers } from 'ethers';
import * as path from 'path';
import { TEST_PRIVATE_KEY, RUN_INTEGRATION_TESTS, INFURA_API_KEY } from '../../../config.js';
import { createWallet } from '@m3s/wallet';
import { IEVMWallet } from '@m3s/common'


describe('ERC721 Options Tests', () => {
  let contractHandler: IBaseContractHandler;

  beforeEach(async () => {
    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc721-gen'), // <<< Use unique dir
        preserveOutput: true,
      }
    });
    // Initialization handled by createContractHandler
  });

  // --- Generation Tests (remain largely the same, ensure language is specified) ---
  it('should generate basic ERC721 with required options', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'BasicNFT',
        symbol: 'BNFT'
      }
    };
    const basicSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(basicSource).toContain('contract BasicNFT is ERC721');
    expect(basicSource).toContain('ERC721("BasicNFT", "BNFT")');
    expect(basicSource).not.toContain('import {ERC721Enumerable}');
    expect(basicSource).not.toContain('import {ERC721URIStorage}');
    expect(basicSource).not.toContain('import {ERC721Pausable}');
    expect(basicSource).not.toContain('import {ERC721Burnable}');
  });

  it('should generate ERC721 with baseUri option', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721', // <<< Use template name
      options: {
        name: 'BaseUriNFT',
        symbol: 'BUNFT',
        baseUri: 'ipfs://QmBaseUri/'
      }
    };
    const baseUriSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(baseUriSource).toContain('_baseURI()');
    expect(baseUriSource).toContain('ipfs://QmBaseUri/');
  });

  it('should generate ERC721 with enumerable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'EnumerableNFT',
        symbol: 'ENFT',
        enumerable: true
      }
    };
    const enumerableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(enumerableSource).toContain('import {ERC721Enumerable}');
    expect(enumerableSource).toContain('ERC721Enumerable');
  });

  it('should generate ERC721 with URI storage', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'UriNFT',
        symbol: 'UNFT',
        uriStorage: true
      }
    };
    const uriStorageSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(uriStorageSource).toContain('import {ERC721URIStorage}');
    expect(uriStorageSource).toContain('ERC721URIStorage');
  });

  it('should generate ERC721 with burnable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'BurnableNFT',
        symbol: 'BNFT',
        burnable: true
      }
    };
    const burnableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(burnableSource).toContain('import {ERC721Burnable}');
    expect(burnableSource).toContain('ERC721Burnable');
  });

  it('should generate ERC721 with pausable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'PausableNFT',
        symbol: 'PNFT',
        pausable: true,
        access: 'ownable'
      }
    };
    const pausableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(pausableSource).toContain('import {ERC721Pausable}');
    expect(pausableSource).toContain('ERC721Pausable');
    expect(pausableSource).toContain('function pause()');
    expect(pausableSource).toContain('function unpause()');
  });

  it('should generate ERC721 with mintable feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'MintableNFT',
        symbol: 'MNFT',
        mintable: true,
        access: 'ownable'
      }
    };
    const mintableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(mintableSource).toContain('function safeMint('); // OZ Wizard uses safeMint
    expect(mintableSource).toContain('onlyOwner');
  });

  it('should generate ERC721 with incremental IDs', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'IncrementalNFT',
        symbol: 'INFT',
        mintable: true,
        access: 'ownable',
        incremental: true
      }
    };
    const incrementalSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(incrementalSource).toContain('uint256 private _nextTokenId');
    expect(incrementalSource).toContain('_nextTokenId++');
  });

  it('should generate ERC721 with votes feature', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'VotesNFT',
        symbol: 'VNFT',
        votes: true
      }
    };
    const votesSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(votesSource).toContain('import {ERC721Votes}');
    expect(votesSource).toContain('ERC721Votes');
  });

  it('should generate ERC721 with custom access control', async () => {
    // Test roles
    const rolesInput: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'RolesNFT',
        symbol: 'RNFT',
        mintable: true,
        access: 'roles'
      }
    };
    const rolesSource = await contractHandler.generateContract(rolesInput); // <<< Use generateContract

    expect(rolesSource).toContain('import {AccessControl}');
    expect(rolesSource).toContain('MINTER_ROLE');
    expect(rolesSource).toContain('onlyRole(MINTER_ROLE)');

    // Test ownable
    const ownableInput: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'OwnableNFT',
        symbol: 'ONFT',
        mintable: true,
        access: 'ownable'
      }
    };
    const ownableSource = await contractHandler.generateContract(ownableInput); // <<< Use generateContract

    expect(ownableSource).toContain('import {Ownable}');
    expect(ownableSource).toContain('onlyOwner');
  });

  it('should generate ERC721 with multiple features combined', async () => {
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
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
    };
    const complexSource = await contractHandler.generateContract(input); // <<< Use generateContract

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
    const input: GenerateContractInput = { // <<< Use GenerateContractInput
      language: 'solidity',
      template: 'openzeppelin_erc721',
      options: {
        name: 'UpgradeableNFT',
        symbol: 'UNFT',
        mintable: true,
        access: 'ownable',
        upgradeable: 'uups'
      }
    };
    const upgradeableSource = await contractHandler.generateContract(input); // <<< Use generateContract

    expect(upgradeableSource).toContain('import {ERC721Upgradeable}');
    expect(upgradeableSource).toContain('UUPSUpgradeable');
    expect(upgradeableSource).toContain('initialize');
  });
});

(RUN_INTEGRATION_TESTS ? describe : describe.skip)('Full ERC721 Integration Tests', () => {
  let walletAdapter: IEVMWallet; // <<< ADDED
  let contractHandler: IBaseContractHandler;
  let provider: ethers.Provider; // Add provider

  beforeEach(async () => {
    const rpcUrl = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
    provider = new ethers.JsonRpcProvider(rpcUrl);

    const network = await provider.getNetwork();
    const chainId = network.chainId;
    console.log(`[Test Setup] Using RPC: ${rpcUrl}, ChainID: ${chainId}`);

    walletAdapter = await createWallet<IEVMWallet>({
      adapterName: 'ethers',
      options: {
        privateKey: TEST_PRIVATE_KEY
      }
    });

    console.log(`[Test Setup] After createWallet: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);

    // <<< Ensure wallet adapter is initialized >>>
    if (!(await walletAdapter.isInitialized())) {
      console.log("[Test Setup] Wallet not initialized by create, calling initialize...");
      await walletAdapter.initialize();
    } else {
      console.log("[Test Setup] Wallet already initialized by create.");
    }

    console.log(`[Test Setup] After initialize check: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);


    try {
      // Use the explicitly defined rpcUrl
      await walletAdapter.setProvider({ rpcUrl, chainId: String(chainId) });
      console.log(`[Test Setup] After setProvider SUCCESS: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);
    } catch (error) {
      console.error(`[Test Setup] setProvider FAILED:`, error);
      // Re-throw to ensure the test fails clearly if setProvider has an issue
      throw error;
    }

    contractHandler = await createContractHandler({
      adapterName: 'openZeppelin',
      options: {
        workDir: path.join(process.cwd(), 'test-contracts-output', 'erc721'),
        preserveOutput: true,
        providerConfig: {
          rpcUrl: rpcUrl,
          chainId: chainId
        }
      }
    });
    console.log(`[Test Setup] After createContractHandler. beforeEach complete.`);
  });

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
  // <<< End waitForReceipt helper >>>

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

    console.log(`[Test Run] Before getAccounts call: isInitialized=${await walletAdapter.isInitialized()}, isConnected=${await walletAdapter.isConnected()}`);
    const accounts = await walletAdapter.getAccounts();
    // <<< Log the raw result from getAccounts >>>
    console.log(`[Test Run] After getAccounts call: received accounts =`, accounts);
    const deployerAddress = accounts[0];
    console.log(`Deployer address from walletAdapter: ${deployerAddress}`);

    if (!deployerAddress || !ethers.isAddress(deployerAddress)) {
      throw new Error(`Failed to get a valid deployer address from wallet adapter. Received: ${deployerAddress}`);
    }

    // <<< Correct constructor args for Ownable ERC721 >>>
    const constructorArgs: any[] = [deployerAddress]; // Only initialOwner is needed

    const deployed: DeployedOutput = await contractHandler.deploy({
      compiledContract: compiled,
      constructorArgs: constructorArgs,
      wallet: walletAdapter // <<< Pass walletAdapter
    });
    console.log(`Contract deployed: ${deployed.contractId}, Tx: ${deployed.deploymentInfo?.transactionId}`); // <<< Use deploymentInfo
    expect(deployed.contractId).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(deployed.deploymentInfo?.transactionId).toBeDefined(); // <<< Check deploymentInfo

    // --- Test Features ---
    const contractId = deployed.contractId;
    const contractAbi = compiled.artifacts.abi;
    const tokenId = 0; // First token ID (due to incremental)

    // 1. Mint a token (write)
    console.log(`Testing mint functionality (minting token ${tokenId})...`);
    // <<< Update safeMint args for incremental + URI storage >>>
    const mintResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'safeMint',
      args: [deployerAddress, `metadata/${tokenId}.json`], // Mint to deployer, provide URI part
      wallet: walletAdapter // <<< Pass walletAdapter
    });
    // <<< Use waitForReceipt >>>
    const mintReceipt = await waitForReceipt(mintResult.transactionHash);
    expect(mintReceipt).toBeDefined();
    expect(mintReceipt).not.toBeNull();
    expect(mintReceipt!.status).toBe(1);
    console.log(`✅ Token ${tokenId} minted successfully`);

    // Verify ownership (read)
    const owner = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'ownerOf',
      args: [tokenId]
      // wallet: walletAdapter // Optional for reads
    });
    expect(owner.toLowerCase()).toBe(deployerAddress.toLowerCase());
    console.log(`✅ Ownership verified`);

    // 2. Test URI Storage & Base URI (read)
    console.log('Testing token URI...');
    const retrievedURI = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'tokenURI',
      args: [tokenId]
      // wallet: walletAdapter // Optional for reads
    });

    // <<< CORRECTED EXPECTATION: OZ concatenates base URI + specific URI when both exist >>>
    const baseUri = 'ipfs://QmNFTCollection/'; // The base URI used in generation
    const uriSuffix = `metadata/${tokenId}.json`; // The URI provided during mint
    const expectedTokenURI = baseUri + uriSuffix; // Concatenated result
    // <<< END CORRECTION >>>
    console.log(`Retrieved token URI: ${retrievedURI}`);
    expect(retrievedURI).toBe(expectedTokenURI);
    console.log(`✅ Token URI verified`);

    // 3. Test enumerable feature (read)
    console.log('Testing enumerable feature...');
    const balance = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'balanceOf',
      args: [deployerAddress]
      // wallet: walletAdapter // Optional for reads
    });
    expect(Number(balance)).toBe(1);

    const tokenByIndex = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'tokenOfOwnerByIndex',
      args: [deployerAddress, 0] // First token for this owner
      // wallet: walletAdapter // Optional for reads
    });
    expect(Number(tokenByIndex)).toBe(tokenId); // Should be the token we minted
    console.log('✅ Enumerable feature verified');

    // 4. Test pause functionality (write)
    console.log('Testing pause functionality...');
    const pauseResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'pause',
      args: [],
      wallet: walletAdapter // <<< Pass walletAdapter
    });
    // <<< Use waitForReceipt >>>
    const pauseReceipt = await waitForReceipt(pauseResult.transactionHash);
    expect(pauseReceipt).toBeDefined();
    expect(pauseReceipt).not.toBeNull();
    expect(pauseReceipt!.status).toBe(1);

    const pausedState = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'paused',
      args: []
      // wallet: walletAdapter // Optional for reads
    });
    expect(pausedState).toBe(true);
    console.log('✅ Contract successfully paused');

    // 5. Test unpause (write)
    console.log('Testing unpause functionality...');
    const unpauseResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'unpause',
      args: [],
      wallet: walletAdapter // <<< Pass walletAdapter
    });
    // <<< Use waitForReceipt >>>
    const unpauseReceipt = await waitForReceipt(unpauseResult.transactionHash);
    expect(unpauseReceipt).toBeDefined();
    expect(unpauseReceipt).not.toBeNull();
    expect(unpauseReceipt!.status).toBe(1);

    const unpausedState = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'paused',
      args: []
      // wallet: walletAdapter // Optional for reads
    });
    expect(unpausedState).toBe(false);
    console.log('✅ Contract successfully unpaused');

    // 6. Test burning (write)
    console.log('Testing burn functionality...');
    const burnResult = await contractHandler.callMethod({
      contractId: contractId,
      contractInterface: contractAbi, // <<< Pass ABI
      functionName: 'burn',
      args: [tokenId],
      wallet: walletAdapter // <<< Pass walletAdapter
    });
    // <<< Use waitForReceipt >>>
    const burnReceipt = await waitForReceipt(burnResult.transactionHash);
    expect(burnReceipt).toBeDefined();
    expect(burnReceipt).not.toBeNull();
    expect(burnReceipt!.status).toBe(1);

    // Verify token is burned by checking if ownerOf throws (read)
    try {
      await contractHandler.callMethod({
        contractId: contractId,
        contractInterface: contractAbi, // <<< Pass ABI
        functionName: 'ownerOf',
        args: [tokenId]
        // wallet: walletAdapter // Optional for reads
      });
      // If we get here, the token still exists - fail the test
      throw new Error('Token was not burned successfully');
    } catch (error: any) {
      // Expecting an error (like 'ERC721NonexistentToken')
      // Error message might differ slightly based on ethers/provider version
      expect(error.message).toMatch(
        /ERC721NonexistentToken|execution reverted.*(NonexistentToken|0x04f8074e)/i
      );
      console.log('✅ Token successfully burned (ownerOf reverted as expected)');
    }

    console.log('✨ All testable ERC721 features verified successfully!');
  }, 300000); // Longer timeout for blockchain interaction
});