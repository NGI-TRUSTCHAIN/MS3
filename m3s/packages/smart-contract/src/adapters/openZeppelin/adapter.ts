import { Provider, JsonRpcProvider } from "ethers"; // Ensure all needed types are imported
import * as fs from "fs/promises";
import * as path from "path";
import { IBaseContractHandler, GenerateContractInput, CompileInput, CompiledOutput } from "../../types/index.js";
import SolidityCompiler from "./compilers/solidityCompiler.js";
import CodeGenerator from "./generator.js";
import { NetworkConfig } from "@m3s/wallet"
import { AdapterArguments, AdapterError, SmartContractErrorCode } from "@m3s/common";

export interface IOpenZeppelinAdapterOptionsV1 {
    workDir?: string;
    hardhatConfig?: {
        configFileName?: string;
        customSettings?: Record<string, any>;
    };
    preserveOutput?: boolean;
    providerConfig?: NetworkConfig;
    compilerSettings?: any;
    solcVersion?: string;
}

interface args extends AdapterArguments<IOpenZeppelinAdapterOptionsV1> { }

export class OpenZeppelinAdapter implements IBaseContractHandler {
    public readonly name: string;
    public readonly version: string;

    protected initialized: boolean = false;
    private workDir: string;
    private preserveOutput: boolean;
    private providerConfig?: NetworkConfig;
    private defaultProvider?: Provider;
    private generator: CodeGenerator;
    private solidityCompiler: SolidityCompiler;

    private solidityCompilerConfig: {
        workDir: string;
        solcVersion: string;
        compilerSettings: any;
        hardhatConfigFileName: string;
        preserveOutput: boolean;
    };

    private constructor(args: args) {

        const defaultWorkDir = path.join(process.cwd(), 'contracts');
        this.workDir = args.options?.workDir || defaultWorkDir;
        this.preserveOutput = args.options?.preserveOutput ?? false;
        this.providerConfig = args.options?.providerConfig;

        this.name = args.name;
        this.version = args.version;


        // Configuration specific to helpers
        this.solidityCompilerConfig = {
            workDir: this.workDir, // Pass the determined workDir
            solcVersion: args.options?.solcVersion || '0.8.22',
            compilerSettings: args.options?.compilerSettings || { optimizer: { enabled: true, runs: 200 } },
            hardhatConfigFileName: args.options?.hardhatConfig?.configFileName || 'hardhat.config.cjs',
            preserveOutput: this.preserveOutput,
        };

        // Create helper instances 1.0
        this.generator = new CodeGenerator();
        this.solidityCompiler = new SolidityCompiler(this.solidityCompilerConfig);

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

    // // --- Delegate to Internal Helpers ---
    // async generateContract(input: GenerateContractInput): Promise<string> {
    //     if (!this.initialized) {
    //         throw new AdapterError("Adapter not initialized", {
    //             code: SmartContractErrorCode.AdapterNotInitialized,
    //             methodName: 'generateContract'
    //         });
    //     }
    //     try {
    //         return await this.generator.generate(input);
    //     } catch (error: any) {
    //         if (error instanceof AdapterError) throw error;
    //         throw new AdapterError(`Contract generation failed: ${error.message}`, {
    //             cause: error,
    //             code: SmartContractErrorCode.MethodCallFailed, // Or a more specific SC_GENERATION_FAILED if added
    //             methodName: 'generateContract',
    //             details: { input }
    //         });
    //     }
    // }

    async generateContract(input: GenerateContractInput): Promise<string> {
        if (!this.initialized) {
            throw new AdapterError("Adapter not initialized", {
                code: SmartContractErrorCode.AdapterNotInitialized,
                methodName: 'generateContract'
            });
        }

        // ✅ FIX: Template-specific validation
        const { template, options } = input;

        if (template?.includes('erc20') || template?.includes('erc721')) {
            // ERC20 and ERC721 require both name and symbol
            if (!options?.name || !options?.symbol) {
                throw new AdapterError("Contract 'name' and 'symbol' are required for ERC20/ERC721 templates", {
                    code: SmartContractErrorCode.InvalidInput,
                    methodName: 'generateContract',
                    details: { template, providedOptions: options }
                });
            }
        } else if (template?.includes('erc1155')) {
            // ERC1155 requires name and uri, but NOT symbol
            if (!options?.name || !options?.uri) {
                throw new AdapterError("Contract 'name' and 'uri' are required for ERC1155 templates", {
                    code: SmartContractErrorCode.InvalidInput,
                    methodName: 'generateContract',
                    details: { template, providedOptions: options }
                });
            }
        }

        try {
            const code = await this.generator.generate(input);
            console.log('GENERATED CODE --- generateContract', code)
            return code
        } catch (error: any) {
            if (error instanceof AdapterError) throw error;
            throw new AdapterError(`Contract generation failed: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.MethodCallFailed,
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
                    throw new AdapterError(`Compilation for 'cairo' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput,
                        methodName,
                        details: { language: input.language }
                    });
                case 'stellar':
                    throw new AdapterError(`Compilation for 'stellar' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput,
                        methodName,
                        details: { language: input.language }
                    });
                case 'stylus':
                    throw new AdapterError(`Compilation for 'stylus' is not yet implemented.`, {
                        code: SmartContractErrorCode.InvalidInput,
                        methodName,
                        details: { language: input.language }
                    });
                default:
                    throw new AdapterError(`Compilation not supported for language: ${input.language}`, {
                        code: SmartContractErrorCode.InvalidInput,
                        methodName,
                        details: { language: input.language }
                    });
            }
        } catch (error: any) {
            if (error instanceof AdapterError) throw error;
            throw new AdapterError(`Compilation failed: ${error.message}`, {
                cause: error,
                code: SmartContractErrorCode.CompilationFailed,
                methodName,
                details: { input }
            });
        }
    }
}