import { exec } from "child_process";
import { CompileInput, CompiledOutput } from "packages/smart-contract/src/types/index.js";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

export default class SolidityCompiler {
    private workDir: string;
    private solcVersion: string;
    private compilerSettings: any;
    private hardhatConfigFileName: string;
    private preserveOutput: boolean;

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
            const { stdout, stderr } = await execAsync(compileCommand);
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