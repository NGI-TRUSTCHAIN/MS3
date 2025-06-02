import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { CompileInput, CompiledOutput } from "@m3s/smart-contract";

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

            const hashInput = contractName + sourceCode + JSON.stringify(this.compilerSettings) + this.solcVersion;
            const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
            contractDir = path.join(this.workDir, `${contractName}_${hash}`);
            const artifactPath = path.join(contractDir, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);

            // --- Determine Solidity version for Hardhat config ---
            let versionForHardhat = this.solcVersion; // Fallback to initialized version
            const pragmaRegex = /pragma\s+solidity\s+([^\s;]+)\s*;/;
            const pragmaMatch = sourceCode.match(pragmaRegex);

            if (pragmaMatch && pragmaMatch[1]) {
                const pragmaVersionString = pragmaMatch[1];
                const specificVersionRegex = /(\d+\.\d+\.\d+)/; // Extracts "0.x.y"
                const specificVersionMatch = pragmaVersionString.match(specificVersionRegex);
                if (specificVersionMatch && specificVersionMatch[0]) {
                    versionForHardhat = specificVersionMatch[0];
                    console.log(`[SolidityCompiler] Extracted version ${versionForHardhat} from pragma "${pragmaVersionString}" to use for Hardhat config.`);
                } else {
                    console.warn(`[SolidityCompiler] Could not extract a specific version like "0.x.y" from pragma "${pragmaVersionString}". Using fallback version: ${this.solcVersion}`);
                }
            } else {
                console.warn(`[SolidityCompiler] No Solidity pragma found or could not parse. Using fallback version: ${this.solcVersion}`);
            }

            // --- Check Cache ---

            if (this.preserveOutput) {
                try {
                    const existingArtifactJson = await fs.readFile(artifactPath, 'utf-8');
                    const existingArtifact = JSON.parse(existingArtifactJson);
                    // Additionally check if the compiler version matches, if we want strict caching
                    if (existingArtifact.abi && existingArtifact.bytecode && existingArtifact.metadata?.compilerVersion === versionForHardhat) {
                        console.log(`[SolidityCompiler] Using cached artifact for ${contractName} from ${contractDir} (version: ${versionForHardhat})`);
                        return {
                            artifacts: {
                                abi: existingArtifact.abi,
                                bytecode: existingArtifact.bytecode,
                                contractName: existingArtifact.contractName,
                                sourceName: existingArtifact.sourceName,
                            },
                            metadata: {
                                compiler: 'hardhat',
                                compilerVersion: existingArtifact.metadata?.compilerVersion || versionForHardhat,
                                language: 'solidity',
                                contractName: existingArtifact.contractName,
                            }
                        };
                    }
                } catch (readError) { /* Cache miss or version mismatch, continue */ }
            }

            console.log(`[SolidityCompiler] Compiling ${contractName} in temporary directory: ${contractDir} using Solidity ${versionForHardhat}`);
            await fs.rm(contractDir, { recursive: true, force: true });
            await fs.mkdir(contractDir, { recursive: true });
            const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName);
            const contractsDirPath = path.join(contractDir, 'contracts');
            await fs.mkdir(contractsDirPath, { recursive: true });
            const contractPath = path.join(contractsDirPath, `${contractName}.sol`);
            await fs.writeFile(contractPath, sourceCode);

            const hardhatConfigContent = `
module.exports = {
  solidity: { 
    version: "${versionForHardhat}", 
    settings: ${JSON.stringify(this.compilerSettings, null, 2)} 
  },
  paths: { sources: "./contracts", artifacts: "./artifacts" },
  ...${JSON.stringify(this.compilerSettings?.customSettings || {}, null, 2)}
};`;
            await fs.writeFile(hardhatConfigPath, hardhatConfigContent);

            let hardhatCommand = "npx hardhat";
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