import { erc20, erc721, erc1155 } from "@openzeppelin/wizard";
import { ERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { ERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options } from "@openzeppelin/wizard/dist/erc721.js";

import { ethers } from "ethers";
import { promisify } from "util";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { IBaseContractHandler, CompiledContract, DeployedContract, IGenerateContractParams } from "../types/index.js";

const execAsync = promisify(exec);

interface OpenZeppelinAdapterArgs {
    workDir?: string;
    compilerSettings?: any;
    solcVersion?: string;
    hardhatConfig?: {
        configFileName?: string;
        customSettings?: Record<string, any>;
    };
    preserveOutput?: boolean;  // Add this
}

export class OpenZeppelinAdapter implements IBaseContractHandler {
    protected initialized: boolean = false;
    private workDir: string;
    private compilerSettings: any;
    private solcVersion: string;
    private hardhatConfigFileName: string;
    private preserveOutput: boolean;  // Add this

    private constructor(args: OpenZeppelinAdapterArgs = {}) {
        this.workDir = args.workDir || path.join(process.cwd(), 'contracts');
        this.compilerSettings = args.compilerSettings || {
            optimizer: {
                enabled: true,
                runs: 200
            }
        };
        this.solcVersion = args.solcVersion || '0.8.22';
        this.hardhatConfigFileName = args.hardhatConfig?.configFileName || 'hardhat.config.cjs';
        this.preserveOutput = args.preserveOutput || true;  // Default to true
    }

    static async create(args: OpenZeppelinAdapterArgs = {}): Promise<OpenZeppelinAdapter> {
        const adapter = new OpenZeppelinAdapter(args);
        await adapter.initialize();
        return adapter;
    }

    /** General Initialization */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Ensure work directory exists
        await fs.mkdir(this.workDir, { recursive: true });

        this.initialized = true;
        return;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    disconnect(): void {
        // Nothing to disconnect for this adapter
        this.initialized = false;
    }

    /** Contract Generation */
    async generateContract(args: IGenerateContractParams): Promise<string> {
        const { standard, options } = args;

        if (!this.initialized) {
            throw new Error("OpenZeppelin adapter not initialized");
        }

        try {

            switch (standard) {
                case 'ERC20':
                    return erc20.print(options as ERC20Options);
                case 'ERC721':
                    return erc721.print(options as ERC721Options);
                case 'ERC1155':
                    return erc1155.print(options as ERC1155Options);
                default:
                    throw new Error(`Unsupported contract standard: ${standard}`);
            }

        } catch (error: any) {
            throw new Error(`Failed to generate contract: ${error.message}`);
        }
    }

    /** Contract Compilation */
    async compile(source: string): Promise<CompiledContract> {
        if (!this.initialized) {
            throw new Error("OpenZeppelin adapter not initialized");
        }

        try {
            // Extract contract name from source
            const contractNameMatch = source.match(/contract\s+([a-zA-Z0-9_]+)/);
            if (!contractNameMatch) {
                throw new Error("Could not find contract name in source");
            }

            const contractName = contractNameMatch[1];

            // Use deterministic subdirectory to avoid conflicts but not use timestamps
            const hashInput = contractName + source;
            const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '_').substring(0, 8);
            const contractDir = path.join(this.workDir, `${contractName}_${hash}`);

            // Clean up any existing directory to prevent conflicts
            try {
                await fs.rm(contractDir, { recursive: true, force: true });
            } catch (err) {
                // Ignore errors if directory doesn't exist
            }

            // Create the directory
            await fs.mkdir(contractDir, { recursive: true });

            // Create a temporary Hardhat project (minimal files needed)
            const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName);
            const contractPath = path.join(contractDir, `${contractName}.sol`);

            // Write the contract code
            await fs.writeFile(contractPath, source);

            // Create a more explicit Hardhat config that ensures the right Solidity version
            const hardhatConfig = `
    module.exports = {
    solidity: {
        version: "${this.solcVersion}",
        settings: ${JSON.stringify(this.compilerSettings)}
    },
    paths: {
        sources: "./",
        artifacts: "./artifacts",
        cache: "./cache"
    }
    };`;

            await fs.writeFile(hardhatConfigPath, hardhatConfig);

            console.log(`Compiling contract in directory: ${contractDir}`);

            // Use hardhat from the project root instead of installing in the temp directory
            // This assumes hardhat is installed in the project (which it is)
            const projectHardhatPath = path.join(process.cwd(), 'node_modules', '.bin', 'hardhat');

            // Check if hardhat exists at the project level
            let hardhatCommand = "";
            try {
                await fs.access(projectHardhatPath);
                hardhatCommand = `"${projectHardhatPath}"`;  // Use explicit path with quotes
            } catch {
                // Fall back to npx, which might use global hardhat
                hardhatCommand = "npx hardhat";
            }

            // Run hardhat compile with the configuration in the temp directory
            const compileCommand = `cd "${contractDir}" && ${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
            console.log(`Running: ${compileCommand}`);

            const { stdout, stderr } = await execAsync(compileCommand);
            console.log(`Compilation stdout: ${stdout}`);
            if (stderr) console.log(`Compilation stderr: ${stderr}`);

            // Check for compilation errors
            if (stderr && !stderr.includes('Warning') && stderr.includes('Error')) {
                throw new Error(`Compilation error: ${stderr}`);
            }

            // Read the compiled artifact
            const artifactPath = path.join(
                contractDir,
                "artifacts",
                `${contractName}.sol`,
                `${contractName}.json`
            );

            console.log(`Looking for artifact at: ${artifactPath}`);

            try {
                const artifactContent = await fs.readFile(artifactPath, 'utf8');
                const artifact = JSON.parse(artifactContent);

                // Only clean up if preserveOutput is false
                if (!this.preserveOutput) {
                    try {
                        await fs.rm(contractDir, { recursive: true, force: true });
                    } catch (err: any) {
                        console.warn(`Could not clean up directory ${contractDir}: ${err.message}`);
                    }
                } else {
                    console.log(`Preserving output in: ${contractDir}`);
                    // Optionally create a README in the directory explaining what it is
                    try {
                        const readmePath = path.join(contractDir, 'README.md');
                        const readmeContent = `# Generated Contract: ${contractName}

    This contract was generated and compiled by the M3S Smart Contract module.
    - Contract Name: ${contractName}
    - Generated On: ${new Date().toISOString()}
    - Source hash: ${hash}

    The compiled artifacts are available in the \`artifacts\` directory.
    `;
                        await fs.writeFile(readmePath, readmeContent);
                    } catch (err) {
                        // Ignore README creation errors
                    }
                }

                return {
                    contractName,
                    abi: artifact.abi,
                    bytecode: artifact.bytecode
                };
            } catch (readError: any) {
                // If we can't read the artifact file, try to see what was actually created
                console.error(`Error reading artifact: ${readError.message}`);

                // List directory contents for debugging
                try {
                    const dirContents = await execAsync(`dir "${contractDir}" /s /b`);
                    console.log(`Directory contents: ${dirContents.stdout}`);
                } catch (e) {
                    console.error(`Error listing directory: ${e}`);
                }

                throw new Error(`Artifact file not found. Hardhat may have failed to compile correctly.`);
            }

        } catch (error: any) {
            throw new Error(`Compilation failed: ${error.message}`);
        }
    }

    /** Contract Deployment */
    async deploy(
        compiledContract: CompiledContract,
        constructorArgs: any[] = [],
        signer: ethers.Signer
    ): Promise<DeployedContract> {
        if (!this.initialized) {
            throw new Error("OpenZeppelin adapter not initialized");
        }

        try {
            // Create contract factory
            const factory = new ethers.ContractFactory(
                compiledContract.abi,
                compiledContract.bytecode,
                signer
            );

            // Get gas estimation for safer deployment
            const deployTx = await factory.getDeployTransaction(...constructorArgs);
            const gasEstimate = await signer.provider?.estimateGas(deployTx);
            const feeData = await signer.provider?.getFeeData();

            // Add 20% buffer to gas estimate for safety
            const gasLimit = gasEstimate ?
                BigInt(Math.floor(Number(gasEstimate) * 1.2)) :
                BigInt(3000000); // Fallback gas limit

            // Deploy with appropriate gas settings
            const options = {
                gasLimit,
                maxFeePerGas: feeData?.maxFeePerGas,
                maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas
            };

            // Deploy with constructor args and options correctly separated
            const contract = await factory.deploy(...constructorArgs, options);

            // Wait for deployment to complete
            const deployedContract = await contract.waitForDeployment();
            const address = await deployedContract.getAddress();
            const receipt = await deployedContract.deploymentTransaction()?.wait();

            if (!receipt) {
                throw new Error("Failed to get deployment receipt");
            }

            return {
                address,
                transactionHash: receipt.hash,
                abi: compiledContract.abi
            };
        } catch (error: any) {
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }

    /** Contract Interaction */
    async callMethod(
        contractAddress: string,
        abi: any[],
        method: string,
        args: any[] = [],
        signer: ethers.Signer | ethers.Provider
    ): Promise<any> {
        if (!this.initialized) {
            throw new Error("OpenZeppelin adapter not initialized");
        }

        try {
            // Create contract instance
            const contract = new ethers.Contract(contractAddress, abi, signer);

            // Check if method exists
            if (typeof contract[method] !== 'function') {
                throw new Error(`Method '${method}' not found in contract`);
            }

            // Call the method
            const result = await contract[method](...args);
            return result;
        } catch (error: any) {
            throw new Error(`Method call failed: ${error.message}`);
        }
    }
}