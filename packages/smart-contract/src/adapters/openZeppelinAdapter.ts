import { erc20 as ozErc20, erc721 as ozErc721, erc1155 as ozErc1155 } from "@openzeppelin/wizard";
import { ERC1155Options, ERC1155Options as ozERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { ERC20Options, ERC20Options as ozERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options, ERC721Options as ozERC721Options } from "@openzeppelin/wizard/dist/erc721.js";
import { ICoreWallet, IEVMWallet,  WalletEvent, ProviderConfig, GenericTransactionData } from "@m3s/wallet";
import { ethers, Provider, Signer, TransactionRequest, TransactionResponse, TransactionReceipt, Interface, JsonRpcProvider } from "ethers"; // Ensure all needed types are imported

import { promisify } from "util";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
// Import the new interfaces
import {
    IBaseContractHandler,
    GenerateContractInput,
    CompileInput,
    CompiledOutput,
    DeployInput, // Ensure this expects IEVMWallet
    DeployedOutput,
    CallInput, // Ensure this expects IEVMWallet? and contractInterface
    IContractOptions
} from "../types/index.js";

// --- Interfaces & Types ---
interface WizardAPI { print: (options: any) => string; }
type CairoWizardKey = 'erc20' | 'erc721' | 'erc1155' | 'account' | 'governor' | 'vesting' | 'custom';
type StylusWizardKey = 'erc20' | 'erc721' | 'erc1155';
type CairoContractOptions = any;
type StellarContractOptions = any;
type StylusContractOptions = any;

const execAsync = promisify(exec);

// Keep existing args interface for adapter-specific config
interface OpenZeppelinAdapterArgs {
    options?: {
        workDir?: string;
        hardhatConfig?: {
            configFileName?: string;
            customSettings?: Record<string, any>;
        };
        preserveOutput?: boolean;
        providerConfig?: ProviderConfig;
        compilerSettings?: any; // Primarily for Solidity/Hardhat
        solcVersion?: string;
    }
}

class CodeGenerator {
    async generate(input: GenerateContractInput): Promise<string> {
        console.log(`[CodeGenerator] Generating contract for language: ${input.language}, template: ${input.template || 'default'}`);
        const { language, template, options } = input;

        try {
            switch (language.toLowerCase()) {
                case 'solidity':
                    const standard = template?.replace('openzeppelin_', '').toUpperCase();
                    // Use dynamic imports to avoid loading unused wizards
                    const wizard = await import('@openzeppelin/wizard');
                    switch (standard) {
                        case 'ERC20': return wizard.erc20.print(options as ozERC20Options);
                        case 'ERC721': return wizard.erc721.print(options as ozERC721Options);
                        case 'ERC1155': return wizard.erc1155.print(options as ozERC1155Options);
                        // Add other Solidity templates if OZ Wizard supports them
                        default: throw new Error(`Unsupported Solidity template via OZ Wizard: ${template}`);
                    }
                case 'cairo':
                    try {
                        const cairoModule = await import('@openzeppelin/wizard-cairo');
                        const { printContract: cairoPrint, ...cairoWizards } = cairoModule;
                        const cairoTemplate = template?.toLowerCase() as CairoWizardKey | undefined;
                        if (!cairoTemplate) throw new Error(`Cairo template not specified.`);
                        if (cairoTemplate === 'custom' && typeof cairoPrint === 'function') {
                            return cairoPrint(options as CairoContractOptions);
                        }
                        const wizardImpl = cairoWizards[cairoTemplate as keyof typeof cairoWizards];
                        if (wizardImpl && typeof wizardImpl === 'object' && 'print' in wizardImpl && typeof wizardImpl.print === 'function') {
                            return (wizardImpl as WizardAPI).print(options as CairoContractOptions);
                        }
                        throw new Error(`Unsupported or invalid Cairo template: ${template}`);
                    } catch (e: any) {
                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Cairo generation requires '@openzeppelin/wizard-cairo'. Please install it.");
                        throw e; // Re-throw other errors
                    }
                case 'stellar': // Soroban (Rust)
                    try {
                        const { fungible: stellarFungible } = await import('@openzeppelin/wizard-stellar');
                        if (template?.toLowerCase() === 'fungible') {
                            return stellarFungible.print(options as StellarContractOptions);
                        }
                        throw new Error(`Unsupported Stellar template: ${template}. Use 'fungible'.`);
                    } catch (e: any) {
                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Stellar generation requires '@openzeppelin/wizard-stellar'. Please install it.");
                        throw e;
                    }
                case 'stylus': // Arbitrum Stylus (Rust)
                    try {
                        const stylusModule = await import('@openzeppelin/wizard-stylus');
                        const { printContract: stylusPrint, ...stylusWizards } = stylusModule;
                        const stylusTemplate = template?.toLowerCase() as StylusWizardKey | undefined;
                        if (!stylusTemplate) throw new Error(`Stylus template not specified.`);
                        const wizardImpl = stylusWizards[stylusTemplate as keyof typeof stylusWizards];
                        if (wizardImpl && typeof wizardImpl === 'object' && 'print' in wizardImpl && typeof wizardImpl.print === 'function') {
                            return (wizardImpl as WizardAPI).print(options as StylusContractOptions);
                        }
                        throw new Error(`Unsupported or invalid Stylus template: ${template}. Use 'erc20', 'erc721', or 'erc1155'.`);
                    } catch (e: any) {
                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Stylus generation requires '@openzeppelin/wizard-stylus'. Please install it.");
                        throw e;
                    }
                default:
                    throw new Error(`Unsupported contract language for generation: ${language}`);
            }
        } catch (error: any) {
            console.error(`[CodeGenerator] Failed to generate contract: ${error.message}`, error.stack);
            // Avoid re-wrapping the error if it's already informative
            if (error instanceof Error && error.message.startsWith('Failed to generate contract')) throw error;
            if (error instanceof Error && error.message.includes('requires')) throw error; // Pass specific requirement errors up
            throw new Error(`Failed to generate contract: ${error.message}`);
        }
    }
}

// --- Internal Helper: Solidity Compilation (using Hardhat) ---
class SolidityCompiler {
    private workDir: string;
    private solcVersion: string;
    private compilerSettings: any;
    private hardhatConfigFileName: string;
    private preserveOutput: boolean;
    private execAsync = promisify(exec);

    constructor(config: {
        workDir: string;
        solcVersion: string;
        compilerSettings: any;
        hardhatConfigFileName: string;
        preserveOutput: boolean;
    }) {
        this.workDir = config.workDir;
        this.solcVersion = config.solcVersion;
        this.compilerSettings = config.compilerSettings;
        this.hardhatConfigFileName = config.hardhatConfigFileName;
        this.preserveOutput = config.preserveOutput;
        console.log(`[SolidityCompiler] Initialized with solc version: ${this.solcVersion}`);
    }

    async compile(input: CompileInput): Promise<CompiledOutput> {
        const { sourceCode, language, contractName: inputContractName } = input;
        console.log(`[SolidityCompiler] Attempting to compile...`);

        if (language.toLowerCase() !== 'solidity') {
            throw new Error(`[SolidityCompiler] This compiler only supports 'solidity'. Language provided: ${language}`);
        }

        let contractDir: string | undefined;
        try {
            const contractName = inputContractName || sourceCode.match(/contract\s+([a-zA-Z0-9_]+)/)?.[1];
            if (!contractName) throw new Error("Could not determine contract name from source or input");

            // Create a unique-ish directory name based on content hash and config
            const hashInput = contractName + sourceCode + JSON.stringify(this.compilerSettings) + this.solcVersion;
            const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
            contractDir = path.join(this.workDir, `${contractName}_${hash}`);
            const artifactPath = path.join(contractDir, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);

            // --- Check Cache ---
            if (this.preserveOutput) {
                 try {
                     const existingArtifactJson = await fs.readFile(artifactPath, 'utf-8');
                     const existingArtifact = JSON.parse(existingArtifactJson);
                     if (existingArtifact.abi && existingArtifact.bytecode) {
                         console.log(`[SolidityCompiler] Using cached artifact for ${contractName} from ${contractDir}`);
                         return {
                             artifacts: {
                                 abi: existingArtifact.abi,
                                 bytecode: existingArtifact.bytecode,
                                 contractName: existingArtifact.contractName,
                                 sourceName: existingArtifact.sourceName,
                             },
                             metadata: {
                                 compiler: 'hardhat',
                                 compilerVersion: this.solcVersion, // Use configured version
                                 language: 'solidity',
                                 contractName: existingArtifact.contractName,
                             }
                         };
                     }
                 } catch (readError) { /* Cache miss, continue */ }
            }

            // --- Compile ---
            console.log(`[SolidityCompiler] Compiling ${contractName} in temporary directory: ${contractDir}`);
            await fs.rm(contractDir, { recursive: true, force: true }); // Clean slate
            await fs.mkdir(contractDir, { recursive: true });
            const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName);
            const contractsDirPath = path.join(contractDir, 'contracts');
            await fs.mkdir(contractsDirPath, { recursive: true });
            const contractPath = path.join(contractsDirPath, `${contractName}.sol`);
            await fs.writeFile(contractPath, sourceCode);

            const hardhatConfig = `
module.exports = {
  solidity: { version: "${this.solcVersion}", settings: ${JSON.stringify(this.compilerSettings, null, 2)} },
  paths: { sources: "./contracts", artifacts: "./artifacts" },
  ...${JSON.stringify(this.compilerSettings?.customSettings || {}, null, 2)}
};`;
            await fs.writeFile(hardhatConfigPath, hardhatConfig);

            let hardhatCommand = "npx hardhat"; // Default to npx
            try {
                // Prefer local hardhat if available in the project running this adapter
                const projectHardhatPath = path.resolve(process.cwd(), 'node_modules', '.bin', 'hardhat');
                await fs.access(projectHardhatPath);
                hardhatCommand = `"${projectHardhatPath}"`;
            } catch { /* npx is fine */ }

            const compileCommand = `cd "${contractDir}" && ${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
            console.log(`[SolidityCompiler] Executing: ${compileCommand}`);
            const { stdout, stderr } = await this.execAsync(compileCommand);
            if (stdout) console.log(`[SolidityCompiler] stdout:\n${stdout}`);
            if (stderr) console.warn(`[SolidityCompiler] stderr:\n${stderr}`); // Hardhat often uses stderr for warnings

            console.log(`[SolidityCompiler] Reading artifact: ${artifactPath}`);
            const artifactJson = await fs.readFile(artifactPath, 'utf-8');
            const artifact = JSON.parse(artifactJson);

            if (!artifact.abi || !artifact.bytecode) {
                throw new Error("Compilation succeeded but artifact missing ABI or bytecode.");
            }

            const compiledOutput: CompiledOutput = {
                artifacts: {
                    abi: artifact.abi,
                    bytecode: artifact.bytecode,
                    contractName: artifact.contractName,
                    sourceName: artifact.sourceName,
                },
                metadata: {
                    compiler: 'hardhat',
                    compilerVersion: this.solcVersion,
                    language: 'solidity',
                    contractName: artifact.contractName,
                }
            };

            if (this.preserveOutput) {
                 try {
                    const readmePath = path.join(contractDir, 'README.md');
                    const readmeContent = `# ${contractName}\n\nCompiled by M3S SolidityCompiler on ${new Date().toISOString()}\nCompiler: Hardhat (solc ${this.solcVersion})\nSource: \`contracts/${contractName}.sol\`\nArtifact: \`artifacts/contracts/${contractName}.sol/${contractName}.json\``;
                    await fs.writeFile(readmePath, readmeContent);
                } catch (err: any) { console.warn(`[SolidityCompiler] Failed to write README: ${err.message}`); }
            }

            console.log(`[SolidityCompiler] Compilation successful for ${contractName}.`);
            return compiledOutput;

        } catch (error: any) {
            console.error(`[SolidityCompiler] Compilation failed: ${error.message}`, error.stack);
            if (error.stderr) console.error("Compilation stderr:", error.stderr); // Log stderr on failure too
            throw new Error(`Solidity compilation failed: ${error.message}`);
        } finally {
            if (contractDir && !this.preserveOutput) {
                try {
                    await fs.rm(contractDir, { recursive: true, force: true });
                    console.log(`[SolidityCompiler] Cleaned up temporary directory: ${contractDir}`);
                } catch (cleanupError: any) {
                    console.warn(`[SolidityCompiler] Failed to cleanup temporary directory ${contractDir}: ${cleanupError.message}`);
                }
            }
        }
    }
}

class BlockchainInteractor {
    private defaultProvider?: Provider; // Store the default provider instance
    constructor(defaultProvider?: Provider) {
        this.defaultProvider = defaultProvider;
        if (this.defaultProvider) {
            console.log(`[BlockchainInteractor] Initialized with a default provider.`);
        } else {
            console.log(`[BlockchainInteractor] Initialized without a default provider (reads without wallet will fail).`);
        }
    }

    async deployContract(input: DeployInput): Promise<DeployedOutput> {
        const { compiledContract, constructorArgs = [], wallet, deployOptions = {} } = input;
        
        const contractName = compiledContract.metadata?.contractName || compiledContract.artifacts?.contractName || 'UnknownContract';
        console.log(`[BlockchainInteractor] Deploying ${contractName}...`);

        // Wallet Validation (Crucial for EVM operations)
        if (!wallet || typeof wallet.sendTransaction !== 'function' || typeof wallet.getAccounts !== 'function' || typeof wallet.getTransactionReceipt !== 'function') {
            throw new Error("Invalid or incomplete IEVMWallet provided for deployment. Requires sendTransaction, getAccounts, getTransactionReceipt.");
        }

        const abi = compiledContract.artifacts?.abi;
        const bytecode = compiledContract.artifacts?.bytecode;
        if (!abi || !bytecode) throw new Error(`Compiled artifacts for ${contractName} missing 'abi' or 'bytecode'.`);

        let txHash: string | undefined;
        try {
            // 1. Prepare Tx Data using ethers
            const factory = new ethers.ContractFactory(abi, bytecode);
            const overrides: ethers.Overrides = {};
            if (deployOptions.gasLimit) overrides.gasLimit = deployOptions.gasLimit;
            if (deployOptions.gasPrice) overrides.gasPrice = deployOptions.gasPrice;
            if (deployOptions.maxFeePerGas) overrides.maxFeePerGas = deployOptions.maxFeePerGas;
            if (deployOptions.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = deployOptions.maxPriorityFeePerGas;
            if (deployOptions.nonce) overrides.nonce = deployOptions.nonce;
            if (deployOptions.value) overrides.value = deployOptions.value;
            const deployTxRequest: TransactionRequest = await factory.getDeployTransaction(...constructorArgs, overrides);

            // 2. Map to GenericTransactionData
            const genericDeployTx: GenericTransactionData = {
                to: undefined, // Contract creation
                value: deployTxRequest.value?.toString(),
                data: deployTxRequest.data ?? undefined,
                options: { /* Map relevant options */ }
            };
            // Clean up undefined options (important for some wallets)
            Object.assign(genericDeployTx.options!, {
                gasLimit: deployTxRequest.gasLimit,
                gasPrice: deployTxRequest.gasPrice,
                maxFeePerGas: deployTxRequest.maxFeePerGas,
                maxPriorityFeePerGas: deployTxRequest.maxPriorityFeePerGas,
                nonce: deployTxRequest.nonce
            });
            Object.keys(genericDeployTx.options!).forEach(key =>
                genericDeployTx.options![key as keyof typeof genericDeployTx.options] === undefined &&
                delete genericDeployTx.options![key as keyof typeof genericDeployTx.options]
            );
             if (Object.keys(genericDeployTx.options!).length === 0) delete genericDeployTx.options;


            // 3. Send via Wallet Adapter
            console.log(`[BlockchainInteractor] Sending deployment tx for ${contractName} via wallet...`);
            txHash = await wallet.sendTransaction(genericDeployTx as any);
            console.log(`[BlockchainInteractor] Deployment tx sent: ${txHash}`);

            // 4. Wait for Receipt via Wallet Adapter
            console.log(`[BlockchainInteractor] Waiting for receipt for ${txHash}...`);
            let receipt: TransactionReceipt | null = null;
            const maxAttempts = 20; // ~2 minutes total wait time
            const waitTime = 6000; // 6 seconds
            for (let i = 0; i < maxAttempts; i++) {
                receipt = await wallet.getTransactionReceipt(txHash); // IEVMWallet guarantees this method
                if (receipt) {
                    console.log(`[BlockchainInteractor] Receipt found (attempt ${i + 1}). Status: ${receipt.status}`);
                    break;
                }
                if (i < maxAttempts - 1) await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // 5. Process Receipt
            if (!receipt) throw new Error(`Deployment transaction ${txHash} did not confirm after ${maxAttempts} attempts.`);
            if (receipt.status === 0) throw new Error(`Deployment transaction ${txHash} failed (receipt status 0).`);
            if (!receipt.contractAddress) throw new Error(`Deployment transaction ${txHash} succeeded but receipt missing contractAddress.`);

            console.log(`[BlockchainInteractor] ${contractName} deployed successfully at ${receipt.contractAddress}`);

            // 6. Format Output
            const deployerAddress = receipt.from || (await wallet.getAccounts())[0]; // Get deployer address
            const deployedOutput: DeployedOutput = {
                contractId: receipt.contractAddress,
                deploymentInfo: {
                    transactionId: receipt.hash,
                    blockHeight: receipt.blockNumber,
                    gasUsed: receipt.gasUsed?.toString(),
                    effectiveGasPrice: receipt.gasPrice?.toString(), // Ethers v6 uses gasPrice in receipt
                    deployerAddress: deployerAddress,
                },
                contractInterface: abi // Include ABI in output
            };
            return deployedOutput;

        } catch (error: any) {
            console.error(`[BlockchainInteractor] Deployment of ${contractName} failed: ${error.message}`, error.stack);
            if (txHash) console.error("Failed Tx Hash:", txHash);
            // Re-throw a cleaner error
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }

    async callContractMethod(input: CallInput): Promise<any> {
        const { contractId, functionName, args = [], wallet, contractInterface, callOptions = {} } = input;
        console.log(`[BlockchainInteractor] Calling ${functionName} on ${contractId}`);

        const abi = contractInterface; // ABI is now required in CallInput
        if (!abi) throw new Error(`ABI (contractInterface) is required in CallInput for contract ${contractId}`);

        let functionAbiFragment: ethers.FunctionFragment | null = null;
        try {
            const iface = new Interface(abi);
            functionAbiFragment = iface.getFunction(functionName);
            if (!functionAbiFragment) throw new Error('Function fragment not found'); // Should not happen if getFunction doesn't throw
        } catch (abiError: any) {
             throw new Error(`Error processing ABI for function '${functionName}': ${abiError.message}`);
        }

        const isWriteCall = !(functionAbiFragment.constant || functionAbiFragment.stateMutability === 'view' || functionAbiFragment.stateMutability === 'pure');

        if (isWriteCall) {
            // --- WRITE CALL ---
            console.log(`[BlockchainInteractor] Preparing WRITE call for ${functionName}...`);
            if (!wallet || typeof wallet.sendTransaction !== 'function') { // Check wallet is present and capable
                throw new Error("IEVMWallet with sendTransaction capability is required for write operations.");
            }

            try {
                // 1. Encode Function Data
                const iface = new Interface(abi); // Recreate or reuse iface
                const txData = iface.encodeFunctionData(functionName, args);

                // 2. Map to GenericTransactionData
                const genericWriteTx: GenericTransactionData = {
                    to: contractId,
                    data: txData,
                    value: callOptions.value?.toString(),
                    options: { /* Map relevant options */ }
                };
                 // Clean up undefined options
                Object.assign(genericWriteTx.options!, {
                    gasLimit: callOptions.gasLimit,
                    gasPrice: callOptions.gasPrice,
                    maxFeePerGas: callOptions.maxFeePerGas,
                    maxPriorityFeePerGas: callOptions.maxPriorityFeePerGas,
                    nonce: callOptions.nonce
                });
                Object.keys(genericWriteTx.options!).forEach(key =>
                    genericWriteTx.options![key as keyof typeof genericWriteTx.options] === undefined &&
                    delete genericWriteTx.options![key as keyof typeof genericWriteTx.options]
                );
                if (Object.keys(genericWriteTx.options!).length === 0) delete genericWriteTx.options;


                // 3. Send via Wallet Adapter
                console.log(`[BlockchainInteractor] Sending write tx for ${functionName} via wallet...`);
                const txHash = await wallet.sendTransaction(genericWriteTx as any);
                console.log(`[BlockchainInteractor] Write tx sent: ${txHash}`);

                // Return hash (user can wait separately if needed)
                // Consider adding an option in callOptions to wait for receipt here?
                return { transactionHash: txHash };

            } catch (error: any) {
                console.error(`[BlockchainInteractor] Write call to ${functionName} failed: ${error.message}`, error.stack);
                throw new Error(`Write call to method '${functionName}' failed: ${error.message}`);
            }
        } else {
            // --- READ CALL ---
            console.log(`[BlockchainInteractor] Preparing READ call for ${functionName}...`);
            let readProvider: Provider | undefined = this.defaultProvider; // Use the interactor's default provider

            // If a wallet IS provided, try to get its provider (might be connected to a different network!)
            // This logic needs refinement based on IEVMWallet interface - does it guarantee getProvider?
            // For now, we prioritize the default provider for consistency in read-only scenarios without a wallet.
            // If a wallet is present, it's primarily for WRITES in this model. Reads *could* use it, but let's keep it simple first.

            if (!readProvider) {
                throw new Error("Provider is required for read operations. Configure the adapter with 'providerConfig' or ensure the wallet provides one.");
            }

            try {
                // 1. Create Contract Instance with Provider
                const contract = new ethers.Contract(contractId, abi, readProvider);

                // 2. Execute Read Call
                console.log(`[BlockchainInteractor] Executing read call: ${functionName}(${args.join(', ')})`);
                // Ethers v6 uses contract.functionName(...args, overrides?)
                // Read calls usually don't need overrides, but pass if provided in callOptions
                const readOverrides: ethers.Overrides = {};
                if (callOptions.blockTag) readOverrides.blockTag = callOptions.blockTag;
                // Add other relevant read overrides if needed

                const result = await (contract[functionName] as Function)(...args, readOverrides);
                console.log(`[BlockchainInteractor] Read call result for ${functionName}:`, result);
                return result;

            } catch (error: any) {
                console.error(`[BlockchainInteractor] Read call to ${functionName} failed: ${error.message}`, error.stack);
                 if (error.message.includes('call revert exception')) {
                     console.error("Read call reverted. Check contract state, arguments, and ensure the contract exists at the address on the connected network.");
                }
                throw new Error(`Read call to method '${functionName}' failed: ${error.message}`);
            }
        }
    }
}


// --- Main Adapter Class (Facade) ---

export class OpenZeppelinAdapter implements IBaseContractHandler {
    protected initialized: boolean = false;
    private workDir: string;
    private preserveOutput: boolean;
    private providerConfig?: ProviderConfig; // Store config
    private defaultProvider?: Provider;
    private generator: CodeGenerator;
    private solidityCompiler: SolidityCompiler; // Specific compiler instance
    private interactor: BlockchainInteractor;

    // Configuration specific to helpers
    private solidityCompilerConfig: {
        workDir: string;
        solcVersion: string;
        compilerSettings: any;
        hardhatConfigFileName: string;
        preserveOutput: boolean;
    };

    private constructor(args: OpenZeppelinAdapterArgs = {}) {
        this.workDir = args.options?.workDir || path.join(process.cwd(), 'contracts-output');
        this.preserveOutput = args.options?.preserveOutput ?? false;
        this.providerConfig = args.options?.providerConfig;

        // Configuration specific to helpers
        this.solidityCompilerConfig = {
            workDir: this.workDir,
            solcVersion: args.options?.solcVersion || '0.8.22',
            compilerSettings: args.options?.compilerSettings || { optimizer: { enabled: true, runs: 200 } },
            hardhatConfigFileName: args.options?.hardhatConfig?.configFileName || 'hardhat.config.cjs',
            preserveOutput: this.preserveOutput,
        };

        // Create helper instances
        this.generator = new CodeGenerator();
        this.solidityCompiler = new SolidityCompiler(this.solidityCompilerConfig);
        this.interactor = undefined as any; // Placeholder
    }

    static async create(args: OpenZeppelinAdapterArgs = {}): Promise<OpenZeppelinAdapter> {
        const adapter = new OpenZeppelinAdapter(args);
        await adapter.initialize();
        return adapter;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log(`[OpenZeppelinAdapter] Initializing...`);
        try {
            // 1. Ensure work directory exists
            await fs.mkdir(this.workDir, { recursive: true });
            console.log(`[OpenZeppelinAdapter] Work directory ensured: ${this.workDir}`);

            // 2. Initialize default provider if config exists
            if (this.providerConfig?.rpcUrl) {
                try {
                    console.log(`[OpenZeppelinAdapter] Configuring default provider from: ${this.providerConfig.rpcUrl}`);
                    this.defaultProvider = new JsonRpcProvider(this.providerConfig.rpcUrl, this.providerConfig.chainId); // Pass chainId if available
                    await this.defaultProvider.getNetwork(); // Test connection
                    console.log(`[OpenZeppelinAdapter] Default provider connected successfully to network: ${(await this.defaultProvider.getNetwork()).name}`);
                } catch (providerError: any) {
                    console.warn(`[OpenZeppelinAdapter] Failed to initialize default provider: ${providerError.message}`);
                    this.defaultProvider = undefined;
                }
            } else {
                 console.log(`[OpenZeppelinAdapter] No default provider configuration found.`);
            }

            // 3. Initialize BlockchainInteractor with the provider
            this.interactor = new BlockchainInteractor(this.defaultProvider);

            this.initialized = true;
            console.log(`[OpenZeppelinAdapter] Initialized successfully.`);
        } catch (error: any) {
            this.initialized = false;
            console.error(`[OpenZeppelinAdapter] Initialization failed: ${error.message}`, error.stack);
            throw new Error(`Failed to initialize OpenZeppelinAdapter: ${error.message}`);
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    disconnect(): void {
        this.initialized = false;
        this.defaultProvider = undefined; // Clear provider instance
        // No specific disconnect for helpers needed currently
        console.log(`[OpenZeppelinAdapter] Disconnected.`);
    }

    // --- Delegate to Internal Helpers ---

    async generateContract(input: GenerateContractInput): Promise<string> {
        if (!this.initialized) throw new Error("Adapter not initialized");
        return this.generator.generate(input);
    }

    async compile(input: CompileInput): Promise<CompiledOutput> {
        if (!this.initialized) throw new Error("Adapter not initialized");
        console.log(`[OpenZeppelinAdapter] Routing compile request for language: ${input.language}`);

        // --- Language-Based Compiler Routing ---
        switch (input.language.toLowerCase()) {
            case 'solidity':
                console.log(`[OpenZeppelinAdapter] Using SolidityCompiler (solc ${this.solidityCompilerConfig.solcVersion})...`);
                return this.solidityCompiler.compile(input);

            // Placeholder for other languages - requires specific compiler implementations
            case 'cairo':
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'cairo' is not yet implemented in this adapter.`);
            case 'stellar': // Soroban (Rust)
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'stellar' (Soroban/Rust) is not yet implemented in this adapter.`);
            case 'stylus': // Arbitrum Stylus (Rust)
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'stylus' (Rust) is not yet implemented in this adapter.`);

            default:
                throw new Error(`[OpenZeppelinAdapter] Compilation not supported for language: ${input.language}`);
        }
    }

    async deploy(input: DeployInput): Promise<DeployedOutput> {
        if (!this.initialized) throw new Error("Adapter not initialized");
        // Input validation (e.g., ensuring wallet is IEVMWallet) should ideally happen
        // at the type level (in DeployInput definition) and potentially here as a runtime check if needed.
        return this.interactor.deployContract(input);
    }

    async callMethod(input: CallInput): Promise<any> {
        if (!this.initialized) throw new Error("Adapter not initialized");
        // Input validation (e.g., requiring contractInterface, checking wallet for writes)
        // happens within the interactor or via types.
        return this.interactor.callContractMethod(input);
    }

    // Private methods like fetchAbi, getDefaultProvider might live here or in BlockchainInteractor
}