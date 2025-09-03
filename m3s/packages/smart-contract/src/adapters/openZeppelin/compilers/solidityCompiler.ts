import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { ethers, ContractFactory } from "ethers";
import { CompileInput, CompiledOutput, DeploymentDataType } from "../../../types/index.js";

const execAsync = promisify(exec);

function getAbiInputs(abi: any[], type: 'constructor' | 'function', name?: string) {
    return abi.find(
        (item: any) =>
            item.type === type && (type !== 'function' || item.name === name)
    )?.inputs || [];
}

function validateArgs(args: any[] = [], abiInputs: any[]) {
    if (args.length !== abiInputs.length) {
        throw new Error(
            `Incorrect number of arguments: expected ${abiInputs.length} (${abiInputs.map(i => `${i.type} ${i.name}`).join(', ')}), got ${args.length}`
        );
    }
}

export default class SolidityCompiler {
    private workDir: string;
    private solcVersion: string;
    private compilerSettings: any;
    private hardhatConfigFileName: string;
    private preserveOutput: boolean;
    private currentContractDir: string | null = null;

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
        console.info(`[SolidityCompiler] Initialized with solc version: ${this.solcVersion}, workDir: ${this.workDir}, preserveOutput: ${this.preserveOutput}`);
    }

    private async compileProxyContractSource(proxySource: string, proxyContractName: string): Promise<{ abi: any[], bytecode: string, contractName: string, sourceName: string }> {
        const hashInput = proxyContractName + proxySource + JSON.stringify(this.compilerSettings) + this.solcVersion;
        const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);

        const baseDirForProxyCompilation = path.join(this.workDir, 'm3s_proxies_cache');
        const proxyCompilationInstanceDir = path.join(baseDirForProxyCompilation, `proxy_${hash}`);

        console.log(`[SolidityCompiler] Using directory for proxy compilation: ${proxyCompilationInstanceDir}`);
        await fs.mkdir(proxyCompilationInstanceDir, { recursive: true });

        try {
            const hardhatConfigPath = path.join(proxyCompilationInstanceDir, this.hardhatConfigFileName);
            const contractsDirPath = path.join(proxyCompilationInstanceDir, 'contracts');
            await fs.mkdir(contractsDirPath, { recursive: true });

            const contractPath = path.join(contractsDirPath, `${proxyContractName}.sol`);
            await fs.writeFile(contractPath, proxySource);

            const hardhatConfigContent = `
module.exports = {
  solidity: { 
    version: "${this.solcVersion}", 
    settings: ${JSON.stringify(this.compilerSettings, null, 2)} 
  },
  paths: { sources: "./contracts", artifacts: "./artifacts" },
  ${this.compilerSettings?.customSettings ? `...${JSON.stringify(this.compilerSettings.customSettings, null, 2)}` : ''}
};`;
            await fs.writeFile(hardhatConfigPath, hardhatConfigContent);

            const packageJsonPath = path.join(proxyCompilationInstanceDir, 'package.json');
            const ozContractsVersion = "^5.0.0";
            await fs.writeFile(packageJsonPath, JSON.stringify({
                name: `proxy-compilation-${hash}`,
                version: "1.0.0",
                type: "module",
                dependencies: { "@openzeppelin/contracts": ozContractsVersion }
            }, null, 2));

            let installCommand = `cd "${proxyCompilationInstanceDir}" && npm install --legacy-peer-deps`;
            try {
                console.log(`[SolidityCompiler] Running npm install in ${proxyCompilationInstanceDir}`);
                await execAsync(installCommand);
            } catch (installError: any) {
                console.warn(`[SolidityCompiler] npm install failed in ${proxyCompilationInstanceDir}, proxy compilation may fail: ${installError.message}`);
            }

            let hardhatCommand = "npx hardhat";
            try {
                const projectHardhatPath = path.resolve(process.cwd(), 'node_modules', '.bin', 'hardhat');
                await fs.access(projectHardhatPath);
                hardhatCommand = `"${projectHardhatPath}"`;
            } catch { /* npx is fine as fallback */ }

            const compileCommand = `cd "${proxyCompilationInstanceDir}" && ${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
            console.log(`[SolidityCompiler] Executing proxy compile: ${compileCommand}`);
            const { stdout, stderr } = await execAsync(compileCommand);
            if (stdout) console.log(`[SolidityCompiler] Proxy compile stdout:\n${stdout}`);
            if (stderr) console.warn(`[SolidityCompiler] Proxy compile stderr:\n${stderr}`);

            const artifactPath = path.join(proxyCompilationInstanceDir, 'artifacts', 'contracts', `${proxyContractName}.sol`, `${proxyContractName}.json`);
            console.log(`[SolidityCompiler] Reading proxy artifact: ${artifactPath}`);
            const artifactJson = await fs.readFile(artifactPath, 'utf-8');
            const artifact = JSON.parse(artifactJson);

            if (!artifact.abi || !artifact.bytecode) {
                throw new Error("Proxy compilation succeeded but artifact missing ABI or bytecode.");
            }

            return {
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                contractName: artifact.contractName || proxyContractName,
                sourceName: artifact.sourceName || `${proxyContractName}.sol`
            };

        } finally {
            if (this.preserveOutput) {
                console.log(`[SolidityCompiler] Preserving output for proxy in: ${proxyCompilationInstanceDir}`);
            } else {
                try {
                    await fs.rm(proxyCompilationInstanceDir, { recursive: true, force: true });
                    console.log(`[SolidityCompiler] Cleaned up temporary proxy directory: ${proxyCompilationInstanceDir}`);
                } catch (cleanupError: any) {
                    console.warn(`[SolidityCompiler] Failed to cleanup temporary proxy directory ${proxyCompilationInstanceDir}: ${cleanupError.message}`);
                }
            }
        }
    }

    private async getStandardProxyArtifacts(): Promise<{ abi: any[], bytecode: string, contractName: string, sourceName: string }> {
        const proxyContractName = "M3S_ERC1967Proxy";
        const proxySource = `
// SPDX-License-Identifier: MIT
pragma solidity ^${this.solcVersion.startsWith('0.') ? this.solcVersion : '0.8.20'};

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ${proxyContractName} is ERC1967Proxy {
    constructor(address logic, bytes memory data) ERC1967Proxy(logic, data) {}
}
`;
        return this.compileProxyContractSource(proxySource, proxyContractName);
    }

    async compile(input: CompileInput): Promise<CompiledOutput> {
        const { sourceCode, language, contractName: inputContractName, compilerOptions } = input;
        console.log(`[SolidityCompiler] Attempting to compile '${inputContractName || 'contract'}'. Language: ${language}, PreserveOutput: ${this.preserveOutput}`);

        if (language.toLowerCase() !== 'solidity') {
            throw new Error(`[SolidityCompiler] This compiler only supports 'solidity'. Language provided: ${language}`);
        }

        const effectiveCompilerSettings = { ...this.compilerSettings, ...compilerOptions };
        const contractName = this._getContractName(sourceCode, inputContractName);
        const contractDir = this._getContractDir(contractName, sourceCode, effectiveCompilerSettings);
        const artifactOutputDir = path.join(contractDir, 'artifacts', 'contracts');
        let versionForHardhat = this._getSolidityVersion(sourceCode);

        try {
            // Check cache
            const cached = await this._tryReadCachedArtifact(artifactOutputDir, contractName, versionForHardhat);
            if (cached) return cached;

            // Prepare workspace and config
            await this._prepareWorkspace(contractDir, contractName, sourceCode, effectiveCompilerSettings, versionForHardhat);

            // Install dependencies if needed
            await this._installDependencies(contractDir, sourceCode, contractName);

            // Compile
            console.log(`[SolidityCompiler] Compiling contract ${contractName} in ${contractDir} with solc version ${versionForHardhat}`);
            await this._runHardhatCompile(contractDir);

            // Find and read artifact, but pass the correct path
            const artifactPath = await this._findArtifactFile(artifactOutputDir, contractName);
            if (!artifactPath) throw new Error(`Artifact for contract ${contractName} not found. Compilation may have failed.`);
            const artifactJson = await fs.readFile(artifactPath, 'utf-8');
            const artifact = JSON.parse(artifactJson);

            // Validate artifact
            if (!artifact.abi || !artifact.bytecode) {
                throw new Error("Compilation succeeded but artifact missing ABI or bytecode.");
            }

            // Build output
            const factory = new ContractFactory(artifact.abi, artifact.bytecode);
            const finalArtifacts = {
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                contractName: artifact.contractName,
                sourceName: artifact.sourceName,
            };
            const finalMetadata = this._buildMetadata(finalArtifacts, sourceCode, versionForHardhat);

            // Optionally save metadata
            if (this.preserveOutput) {
                artifact.metadata = { ...(artifact.metadata || {}), ...finalMetadata };
                await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2));
            }

            return this._buildCompiledOutput(finalArtifacts, factory, finalMetadata);

        } catch (error: any) {
            console.error(`[SolidityCompiler] Compilation failed: ${error.message}`, error.stack);
            if (error.stderr) console.error("Compilation stderr:", error.stderr);
            throw new Error(`Solidity compilation failed: ${error.message}`);
        } finally {
            if (this.currentContractDir && !this.preserveOutput) {
                try {
                    await fs.rm(this.currentContractDir, { recursive: true, force: true });
                    console.log(`[SolidityCompiler] Cleaned up temporary contract directory: ${this.currentContractDir}`);
                } catch (cleanupError: any) {
                    console.warn(`[SolidityCompiler] Failed to cleanup temporary contract directory ${this.currentContractDir}: ${cleanupError.message}`);
                }
                this.currentContractDir = null;
            }
        }
    }

    private _getContractName(sourceCode: string, inputContractName?: string): string {
        return inputContractName || sourceCode.match(/contract\s+([a-zA-Z0-9_]+)/)?.[1] || (() => { throw new Error("Could not determine contract name from source or input"); })();
    }

    private _getContractDir(contractName: string, sourceCode: string, settings: any): string {
        const hashInput = contractName + sourceCode + JSON.stringify(settings) + this.solcVersion;
        const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
        return path.join(this.workDir, `${contractName}_${hash}`);
    }

    private _getSolidityVersion(sourceCode: string): string {
        let version = this.solcVersion;
        const pragmaRegex = /pragma\s+solidity\s+([^\s;]+)\s*;/;
        const pragmaMatch = sourceCode.match(pragmaRegex);
        if (pragmaMatch && pragmaMatch[1]) {
            const specificVersionRegex = /(\d+\.\d+\.\d+)/;
            const specificVersionMatch = pragmaMatch[1].match(specificVersionRegex);
            if (specificVersionMatch && specificVersionMatch[0]) {
                version = specificVersionMatch[0];
            }
        }
        return version;
    }

    private async _tryReadCachedArtifact(artifactOutputDir: string, contractName: string, versionForHardhat: string): Promise<CompiledOutput | null> {
        const artifactPath = await this._findArtifactFile(artifactOutputDir, contractName);
        if (!artifactPath) return null;
        try {
            const existingArtifactJson = await fs.readFile(artifactPath, 'utf-8');
            const existingArtifact = JSON.parse(existingArtifactJson);
            if (existingArtifact.abi && existingArtifact.bytecode && existingArtifact.metadata && existingArtifact.metadata.compilerVersion === versionForHardhat) {
                console.log(`[SolidityCompiler] Using cached artifact for ${contractName} (version: ${versionForHardhat})`);
                const factory = new ContractFactory(existingArtifact.abi, existingArtifact.bytecode);
                const artifacts = {
                    abi: existingArtifact.abi,
                    bytecode: existingArtifact.bytecode,
                    contractName: existingArtifact.contractName,
                    sourceName: existingArtifact.sourceName,
                };
                const metadata = existingArtifact.metadata;
                return this._buildCompiledOutput(artifacts, factory, metadata);
            }
        } catch { /* Cache miss, continue */ }
        return null;
    }

    private async _prepareWorkspace(contractDir: string, contractName: string, sourceCode: string, settings: any, versionForHardhat: string) {
        await fs.rm(contractDir, { recursive: true, force: true });
        await fs.mkdir(contractDir, { recursive: true });
        const contractsDirPath = path.join(contractDir, 'contracts');
        await fs.mkdir(contractsDirPath, { recursive: true });
        const contractPath = path.join(contractsDirPath, `${contractName}.sol`);
        await fs.writeFile(contractPath, sourceCode);

        const hardhatConfigPath = path.join(contractDir, "hardhat.config.cjs");
        const hardhatConfigContent = `
module.exports = {
  solidity: { version: "${versionForHardhat}", settings: ${JSON.stringify(settings, null, 2)} },
  paths: { sources: "./contracts", artifacts: "./artifacts" },
  ...${JSON.stringify(settings?.customSettings || {}, null, 2)}
};`;
        await fs.writeFile(hardhatConfigPath, hardhatConfigContent);
    }

    private async _installDependencies(contractDir: string, sourceCode: string, contractName: string) {
        const packageJsonPath = path.join(contractDir, 'package.json');
        const dependencies: Record<string, string> = {};

        // Check for standard OpenZeppelin contracts
        if (sourceCode.includes('@openzeppelin/contracts')) {
            dependencies["@openzeppelin/contracts"] = "^5.0.0";
        }

        // Check for upgradeable contracts
        if (sourceCode.includes('@openzeppelin/contracts-upgradeable')) {
            dependencies["@openzeppelin/contracts-upgradeable"] = "^5.0.0";
            // Also need the regular contracts as a peer dependency for upgradeable ones
            dependencies["@openzeppelin/contracts"] = "^5.0.0";
        }

        // Only proceed if dependencies are needed
        if (Object.keys(dependencies).length === 0) {
            console.log("[SolidityCompiler] No OpenZeppelin dependencies found. Skipping npm install.");
            return;
        }

        await fs.writeFile(packageJsonPath, JSON.stringify({
            name: `implementation-compilation-${contractName}`,
            version: "1.0.0",
            type: "module",
            dependencies: dependencies
        }, null, 2));

        const installCommand = `cd "${contractDir}" && npm install --legacy-peer-deps`;
        try {
            console.log(`[SolidityCompiler] Running npm install for implementation in ${contractDir}`);
            await execAsync(installCommand);
        } catch (installError: any) {
            console.warn(`[SolidityCompiler] npm install for implementation failed in ${contractDir}, compilation may fail: ${installError.message}`);
        }
    }

    private async _runHardhatCompile(contractDir: string) {
        const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName); // should be 'hardhat.config.cjs'
        let hardhatCommand = "npx hardhat";
        try {
            const projectHardhatPath = path.resolve(contractDir, 'node_modules', '.bin', 'hardhat');
            await fs.access(projectHardhatPath);
            hardhatCommand = `"${projectHardhatPath}"`;
        } catch { /* npx is fine */ }
        const compileCommand = `cd "${contractDir}" && ${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
        console.log(`[SolidityCompiler] Executing implementation compile: ${compileCommand}`);
        const { stdout, stderr } = await execAsync(compileCommand);
        if (stdout) console.log(`[SolidityCompiler] Implementation compile stdout:\n${stdout}`);
        if (stderr) console.warn(`[SolidityCompiler] Implementation compile stderr:\n${stderr}`);

        // After successful compilation, store the path to the temp directory
        this.currentContractDir = contractDir;
    }

    private async _findArtifactFile(tempArtifactOutputDir: string, contractName: string): Promise<string | undefined> {
        try {
            // Read the contents of the artifacts/contracts directory
            const sourceDirectories = await fs.readdir(tempArtifactOutputDir, { withFileTypes: true });

            // Iterate through each directory (which corresponds to a .sol file)
            for (const dir of sourceDirectories) {
                if (dir.isDirectory()) {
                    const sourceDir = path.join(tempArtifactOutputDir, dir.name);
                    const artifactPath = path.join(sourceDir, `${contractName}.json`);

                    try {
                        // Check if the artifact file exists
                        await fs.access(artifactPath);
                        console.log(`[SolidityCompiler] Found artifact at: ${artifactPath}`);
                        return artifactPath;
                    } catch {
                        // Artifact not in this directory, continue searching
                    }
                }
            }
        } catch (error) {
            console.error(`[SolidityCompiler] Error reading artifact directory: ${error}`);
        }
        return undefined;
    }

    private _buildMetadata(finalArtifacts: any, sourceCode: string, versionForHardhat: string) {
        const hasInitializeFunction = finalArtifacts.abi.some((item: any) => item.type === "function" && item.name === "initialize");
        const hasExplicitConstructorArgs = finalArtifacts.abi.some((item: any) => item.type === "constructor" && item.inputs && item.inputs.length > 0);
        const isUUPS = sourceCode.includes('UUPSUpgradeable') || sourceCode.includes('_authorizeUpgrade');
        let isUpgradeable = false;
        let upgradeabilityType: string | undefined = undefined;
        if (hasInitializeFunction && !hasExplicitConstructorArgs) {
            isUpgradeable = true;
            upgradeabilityType = isUUPS ? 'uups' : 'transparent';
        }
        return {
            compiler: 'hardhat',
            compilerVersion: versionForHardhat,
            language: 'solidity',
            contractName: finalArtifacts.contractName,
            isUpgradeable,
            upgradeabilityType
        };
    }

    private _buildCompiledOutput(
        artifacts: { abi: any[], bytecode: string, contractName: string, sourceName: string },
        factory: ContractFactory,
        metadata: any
    ): CompiledOutput {
        const getDeploymentArgsSpec = (opts?: { proxy?: boolean }) => {
            if (opts?.proxy) {
                return getAbiInputs(artifacts.abi, 'function', 'initialize');
            }
            return getAbiInputs(artifacts.abi, 'constructor');
        };

        return {
            artifacts,
            getDeploymentArgsSpec,
            getRegularDeploymentData: async (constructorArgs?: any[]) => {
                const abiInputs = getAbiInputs(artifacts.abi, 'constructor');
                validateArgs(constructorArgs || [], abiInputs);
                const deployTx = await factory.getDeployTransaction(...(constructorArgs || []));
                return { type: DeploymentDataType.regular, data: deployTx.data!, value: deployTx.value?.toString() || "0" };
            },
            getProxyDeploymentData: async (initializeArgs?: any[]) => {
                const abiInputs = getAbiInputs(artifacts.abi, 'function', 'initialize');
                validateArgs(initializeArgs || [], abiInputs);
                const implDeployTx = await factory.getDeployTransaction();
                const logicInterface = new ethers.Interface(artifacts.abi);
                const initDataForLogic = logicInterface.encodeFunctionData('initialize', initializeArgs || []);
                const proxyArtifacts = await this.getStandardProxyArtifacts();
                return {
                    type: DeploymentDataType.proxy,
                    implementation: { data: implDeployTx.data!, value: implDeployTx.value?.toString() || "0" },
                    proxy: {
                        bytecode: proxyArtifacts.bytecode,
                        abi: proxyArtifacts.abi,
                        logicInitializeData: initDataForLogic,
                        value: "0"
                    }
                };
            },
            metadata
        };
    }
}