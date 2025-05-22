import { Provider, Interface, JsonRpcProvider } from "ethers"; // Ensure all needed types are imported
import * as fs from "fs/promises";
import * as path from "path";
import { IBaseContractHandler, GenerateContractInput, CompileInput, CompiledOutput, DeployInput, DeployedOutput, CallInput } from "../../types/index.js";
import SolidityCompiler from "./compilers/solidityCompiler.js";
import CodeGenerator from "./generator.js";
import EvmInteractor from "./interactors/evmInteractor.js";
import { NetworkConfig } from "@m3s/wallet"
import { AdapterArguments, AdapterError, SmartContractErrorCode } from "@m3s/common";

export interface IOpenZeppelinAdapterOptionsV1 { // Renamed and using V1 convention
    workDir?: string;
    hardhatConfig?: {
        configFileName?: string;
        customSettings?: Record<string, any>;
    };
    preserveOutput?: boolean;
    providerConfig?: NetworkConfig; // This is good for passing network info
    compilerSettings?: any;
    solcVersion?: string;
}

interface args extends AdapterArguments<IOpenZeppelinAdapterOptionsV1> { } // Updated to use V1

export class OpenZeppelinAdapter implements IBaseContractHandler {
    protected initialized: boolean = false;
    private workDir: string;
    private preserveOutput: boolean;
    private providerConfig?: NetworkConfig; // Store config
    private defaultProvider?: Provider; // EVM Provider
    // TODO: Add Starknet Provider?
    private generator: CodeGenerator;

    // Compilers.
    private solidityCompiler: SolidityCompiler;
    // private cairoCompiler: CairoCompiler;

    // Interactors
    private evmInteractor: EvmInteractor;
    // private cairoInteractor: CairoInteractor; // Add Cairo interactor instance

    // Configuration specific to helpers
    private solidityCompilerConfig: {
        workDir: string;
        solcVersion: string;
        compilerSettings: any;
        hardhatConfigFileName: string;
        preserveOutput: boolean;
    };

    private readonly adapterName: string = "openZeppelin"

    private constructor(args: args) {
        const defaultWorkDir = path.join(process.cwd(), 'm3s_contracts');
        this.workDir = args.options?.workDir || defaultWorkDir;
        this.preserveOutput = args.options?.preserveOutput ?? false;
        this.providerConfig = args.options?.providerConfig;
        if (args.adapterName) this.adapterName = args.adapterName

        // Configuration specific to helpers
        this.solidityCompilerConfig = {
            workDir: this.workDir, // Pass the determined workDir
            solcVersion: args.options?.solcVersion || '0.8.22',
            compilerSettings: args.options?.compilerSettings || { optimizer: { enabled: true, runs: 200 } },
            hardhatConfigFileName: args.options?.hardhatConfig?.configFileName || 'hardhat.config.cjs',
            preserveOutput: this.preserveOutput,
        };

        // Create helper instances
        this.generator = new CodeGenerator();
        this.solidityCompiler = new SolidityCompiler(this.solidityCompilerConfig);
        // Interactors are initialized in the initialize method after provider setup
        this.evmInteractor = undefined as any; // Will be initialized in initialize()

    }

    static async create(args: args): Promise<OpenZeppelinAdapter> {
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

            // 2. Initialize OpenZeppelinAdapter's optional default EVM provider
            let adapterRpcUrl: string | undefined;
            if (this.providerConfig) {
                if (this.providerConfig.rpcUrls && Array.isArray(this.providerConfig.rpcUrls) && this.providerConfig.rpcUrls.length > 0) {
                    adapterRpcUrl = this.providerConfig.rpcUrls[0];
                    console.log(`[OpenZeppelinAdapter] Using rpcUrls[0] for its default provider: ${adapterRpcUrl}`);
                }
            }

            if (adapterRpcUrl) {
                try {
                    console.log(`[OpenZeppelinAdapter] Configuring its default EVM provider from: ${adapterRpcUrl}`);
                    const chainId = this.providerConfig?.chainId ? Number(this.providerConfig.chainId) : undefined;
                    this.defaultProvider = new JsonRpcProvider(adapterRpcUrl, chainId);
                    await this.defaultProvider.getNetwork(); // Test connection
                    console.log(`[OpenZeppelinAdapter] Its default EVM provider connected successfully to network: ${(await this.defaultProvider.getNetwork()).name}`);
                } catch (providerError: any) {
                    console.warn(`[OpenZeppelinAdapter] Failed to initialize its default EVM provider: ${providerError.message}`);
                    this.defaultProvider = undefined;
                }
            } else {
                console.log(`[OpenZeppelinAdapter] No suitable RPC URL found in providerConfig for its own default provider.`);
            }

            // TODO: Initialize Starknet Provider if needed for CairoInteractor

            // 3. Initialize EvmInteractor with the providerConfig object
            // This allows EvmInteractor to set up its own mandatory defaultProvider for reads.
            this.evmInteractor = new EvmInteractor(this.providerConfig); // <<< Pass the config object

            // this.cairoInteractor = new CairoInteractor(/* Pass Starknet provider/account info here */);

            this.initialized = true;
            console.log(`[OpenZeppelinAdapter] Initialized successfully.`);
        } catch (error: any) {
            this.initialized = false;
            console.error(`[OpenZeppelinAdapter] Initialization failed: ${error.message}`, error.stack);
            if (error instanceof AdapterError) throw error;
            throw new AdapterError(`Failed to initialize OpenZeppelinAdapter: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'initialize'
            });
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    disconnect(): void {
        this.initialized = false;
        this.defaultProvider = undefined; // Clear EVM provider instance
        // TODO: Disconnect Starknet provider?
        console.log(`[OpenZeppelinAdapter] Disconnected.`);
    }

    /**
       * Public getter for the adapter name.
       */
    public getAdapterName(): string {
        return this.adapterName;
    }

    // --- Delegate to Internal Helpers ---

    async generateContract(input: GenerateContractInput): Promise<string> {
        if (!this.initialized) {
            throw new AdapterError("Adapter not initialized", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'generateContract'
            });
        }
        try {
            return await this.generator.generate(input);
        } catch (error: any) {
            if (error instanceof AdapterError) throw error;
            throw new AdapterError(`Contract generation failed: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.MethodCallFailed, // Or a more specific SC_GENERATION_FAILED if added
                methodName: 'generateContract',
                details: { input }
            });
        }
    }

    async compile(input: CompileInput): Promise<CompiledOutput> {
        const methodName = 'compile';
        if (!this.initialized) {
            throw new AdapterError("Adapter not initialized", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName
            });
        }
        console.log(`[OpenZeppelinAdapter] Routing compile request for language: ${input.language}`);

        try {
            // --- Language-Based Compiler Routing ---
            switch (input.language.toLowerCase()) {
                case 'solidity':
                    console.log(`[OpenZeppelinAdapter] Using SolidityCompiler (solc ${this.solidityCompilerConfig.solcVersion})...`);
                    return await this.solidityCompiler.compile(input);
                case 'cairo':
                    // throw new Error(`[OpenZeppelinAdapter] Compilation for 'cairo' (Soroban/Rust) is not yet implemented in this adapter.`);
                    throw new AdapterError(`Compilation for 'cairo' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput, // Or SC_UNSUPPORTED_LANGUAGE
                        methodName,
                        details: { language: input.language }
                    });
                case 'stellar':
                    // throw new Error(`[OpenZeppelinAdapter] Compilation for 'stellar' (Soroban/Rust) is not yet implemented in this adapter.`);
                    throw new AdapterError(`Compilation for 'stellar' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput, // Or SC_UNSUPPORTED_LANGUAGE
                        methodName,
                        details: { language: input.language }
                    });
                case 'stylus':
                    // throw new Error(`[OpenZeppelinAdapter] Compilation for 'stylus' (Rust) is not yet implemented in this adapter.`);
                    throw new AdapterError(`Compilation for 'stylus' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput, // Or SC_UNSUPPORTED_LANGUAGE
                        methodName,
                        details: { language: input.language }
                    });
                default:
                    // throw new Error(`[OpenZeppelinAdapter] Compilation not supported for language: ${input.language}`);
                    throw new AdapterError(`Compilation not supported for language: ${input.language}`, {
                        code: SmartContractErrorCode.InvalidInput, // Or SC_UNSUPPORTED_LANGUAGE
                        methodName,
                        details: { language: input.language }
                    });
            }
        } catch (error: any) {
            if (error instanceof AdapterError) throw error; // Re-throw if already an AdapterError (e.g., from solidityCompiler)
            throw new AdapterError(`Compilation failed: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.CompilationFailed,
                methodName,
                details: { input }
            });
        }
    }

    async deploy(input: DeployInput): Promise<DeployedOutput> {
        if (!this.initialized) {
            throw new AdapterError("Adapter not initialized", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'deploy'
            });
        }

        const language = input.compiledContract.metadata?.language?.toLowerCase();
        console.log(`[OpenZeppelinAdapter] Routing deploy request for language: ${language}`);

        try {
            if (language === 'solidity') {
                if (!this.evmInteractor) {
                    throw new AdapterError("EVM Interactor not available for deployment.", {
                        code: SmartContractErrorCode.AdapterNotInitialized, // Or a more specific internal error
                        methodName: 'deploy'
                    });
                }
                return await this.evmInteractor.deployContract(input);
            } else {
                // throw new Error(`Deployment not supported for language: ${language}`);
                throw new AdapterError(`Deployment not supported for language: ${language || 'unknown'}`, {
                    code: SmartContractErrorCode.InvalidInput, // Or SC_UNSUPPORTED_LANGUAGE
                    methodName: 'deploy',
                    details: { language: language || 'unknown' }
                });
            }
        } catch (error: any) {
            if (error instanceof AdapterError) throw error; // Re-throw if from evmInteractor
            throw new AdapterError(`Deployment failed: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.DeploymentFailed,
                methodName: 'deploy',
                details: { contractId: input.compiledContract?.metadata?.contractName }
            });
        }
    }

    async callMethod(input: CallInput): Promise<any> {
        if (!this.initialized) {
            throw new AdapterError("Adapter not initialized", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'callMethod'
            });
        }
        if (!this.evmInteractor) {
            throw new AdapterError("EVM Interactor not available for method call.", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'callMethod'
            });
        }

        try {
            // Try parsing as EVM ABI
            new Interface(input.contractInterface); // Throws if not a valid EVM ABI
            console.log(`[OpenZeppelinAdapter] Routing callMethod request to EvmInteractor (assuming EVM ABI).`);
            return await this.evmInteractor.callContractMethod(input);
        } catch (error: any) {
            if (error instanceof AdapterError) throw error; // Re-throw if from evmInteractor or Interface parsing

            // If error is from `new Interface`, it's likely an ABI issue.
            if (error.message.toLowerCase().includes('abi') || error.code === 'INVALID_ARGUMENT') {
                throw new AdapterError(`Invalid contract interface (ABI) provided: ${error.message}`, {
                    cause: error,
                    code: SmartContractErrorCode.InvalidAbi,
                    methodName: 'callMethod',
                    details: { functionName: input.functionName }
                });
            }

            // Fallback for other errors or if it was not an ABI parsing error initially
            console.warn(`[OpenZeppelinAdapter] callMethod failed. Assuming non-EVM ABI or other issue: ${error.message}`);
            // throw new Error("Missing interactor for this chain: ", evmAbiError as any)
            throw new AdapterError(`Method call failed or unsupported interface type: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.MethodCallFailed, // Or SC_UNSUPPORTED_LANGUAGE if we could determine that
                methodName: 'callMethod',
                details: { functionName: input.functionName }
            });
        }
    }

}