import { ProviderConfig } from "@m3s/common";
import { Provider, Interface, JsonRpcProvider } from "ethers"; // Ensure all needed types are imported
import * as fs from "fs/promises";
import * as path from "path";
import { IBaseContractHandler, OpenZeppelinAdapterArgs, GenerateContractInput, CompileInput, CompiledOutput, DeployInput, DeployedOutput, CallInput } from "../../types/index.js";
import SolidityCompiler from "./compilers/solidityCompiler.js";
import CodeGenerator from "./generator.js";
import EvmInteractor from "./interactors/evmInteractor.js";


export class OpenZeppelinAdapter implements IBaseContractHandler {
    protected initialized: boolean = false;
    private workDir: string;
    private preserveOutput: boolean;
    private providerConfig?: ProviderConfig; // Store config
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

    private constructor(args: OpenZeppelinAdapterArgs = {}) {
        this.workDir = args.options?.workDir || path.join(process.cwd(), 'm3s-contracts-output'); // Default output dir
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
        // Interactors are initialized in the initialize method after provider setup
        this.evmInteractor = undefined as any;
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

            // 2. Initialize default EVM provider if config exists
            if (this.providerConfig?.rpcUrl) {
                try {
                    console.log(`[OpenZeppelinAdapter] Configuring default EVM provider from: ${this.providerConfig.rpcUrl}`);
                    this.defaultProvider = new JsonRpcProvider(this.providerConfig.rpcUrl, this.providerConfig.chainId); // Pass chainId if available
                    await this.defaultProvider.getNetwork(); // Test connection
                    console.log(`[OpenZeppelinAdapter] Default EVM provider connected successfully to network: ${(await this.defaultProvider.getNetwork()).name}`);
                } catch (providerError: any) {
                    console.warn(`[OpenZeppelinAdapter] Failed to initialize default EVM provider: ${providerError.message}`);
                    this.defaultProvider = undefined;
                }
            } else {
                console.log(`[OpenZeppelinAdapter] No default EVM provider configuration found.`);
            }

            // TODO: Initialize Starknet Provider if needed for CairoInteractor

            // 3. Initialize EvmInteractor with the provider
            this.evmInteractor = new EvmInteractor(this.defaultProvider);
            // this.cairoInteractor = new CairoInteractor(/* Pass Starknet provider/account info here */); // Initialize Cairo interactor

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
        this.defaultProvider = undefined; // Clear EVM provider instance
        // TODO: Disconnect Starknet provider?
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
            case 'cairo':
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'cairo' (Soroban/Rust) is not yet implemented in this adapter.`);
            case 'stellar':
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'stellar' (Soroban/Rust) is not yet implemented in this adapter.`);
            case 'stylus':
                throw new Error(`[OpenZeppelinAdapter] Compilation for 'stylus' (Rust) is not yet implemented in this adapter.`);
            default:
                throw new Error(`[OpenZeppelinAdapter] Compilation not supported for language: ${input.language}`);
        }
    }

    async deploy(input: DeployInput): Promise<DeployedOutput> {
        if (!this.initialized) throw new Error("Adapter not initialized");

        const language = input.compiledContract.metadata?.language?.toLowerCase();
        console.log(`[OpenZeppelinAdapter] Routing deploy request for language: ${language}`);

        if (language === 'solidity') {
            return this.evmInteractor.deployContract(input);
        } else {
            throw new Error(`Deployment not supported for language: ${language}`);
        }
    }

    async callMethod(input: CallInput): Promise<any> {
        if (!this.initialized) throw new Error("Adapter not initialized");
        try {
            // Try parsing as EVM ABI
            new Interface(input.contractInterface);
            console.log(`[OpenZeppelinAdapter] Routing callMethod request to EvmInteractor (assuming EVM ABI).`);
            return this.evmInteractor.callContractMethod(input);
        } catch (evmAbiError) {
            
            console.log(`[OpenZeppelinAdapter] Routing callMethod request to CairoInteractor (assuming Cairo ABI).`);
            throw new Error("Missing interactor for this chain: ", evmAbiError as any)
        }
    }

}