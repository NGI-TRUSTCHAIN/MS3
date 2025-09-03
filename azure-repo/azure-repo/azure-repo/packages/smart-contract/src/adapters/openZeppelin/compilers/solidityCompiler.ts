import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { ethers, ContractFactory } from "ethers";
import { AdapterError, SmartContractErrorCode } from '@m3s/shared';
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
        throw new AdapterError(`Incorrect number of arguments: expected ${abiInputs.length} (${abiInputs.map(i => `${i.type} ${i.name}`).join(', ')}), got ${args.length}`, { methodName: 'validateArgs', code: SmartContractErrorCode.InvalidInput });
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

            // Guard: require a non-empty ABI and bytecode. Empty-array ABI was observed in HHv3 artifacts.
            if (!Array.isArray(artifact.abi) || artifact.abi.length === 0 || !artifact.bytecode) {
                console.error(`[SolidityCompiler] Invalid artifact at ${artifactPath}. Artifact preview:\n${artifactJson.substring(0, 2000)}`);
                throw new AdapterError(`Compilation produced an invalid artifact for ${proxyContractName}. ABI empty or bytecode missing. See log for ${artifactPath}`, { methodName: 'compileProxyContractSource', code: SmartContractErrorCode.CompilationFailed, details: { artifactPath } });
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
            throw new AdapterError(`[SolidityCompiler] This compiler only supports 'solidity'. Language provided: ${language}`, { methodName: 'compile', code: SmartContractErrorCode.CompilationFailed });
        }

        const effectiveCompilerSettings = { ...this.compilerSettings, ...compilerOptions };
        const contractName = this._getContractName(sourceCode, inputContractName);
        const contractDir = this._getContractDir(contractName, sourceCode, effectiveCompilerSettings);
        let versionForHardhat = this._getSolidityVersion(sourceCode);

        try {
            // 1. Prepare a new, clean workspace
            await this._prepareWorkspace(contractDir, contractName, sourceCode, effectiveCompilerSettings, versionForHardhat);

            // 2. Install dependencies if needed
            await this._installDependencies(contractDir, sourceCode, contractName);

            // 3. Compile and get the artifact path directly from the compile function
            console.log(`[SolidityCompiler] Compiling contract ${contractName} in ${contractDir} with solc version ${versionForHardhat}`);
            const artifactPath = await this._runHardhatCompile(contractDir, contractName);

            // 4. Validate and build output from the artifact
            const artifactJson = await fs.readFile(artifactPath as string, 'utf-8');
            const artifact = JSON.parse(artifactJson);

            // Guard: require a non-empty ABI and bytecode. Empty-array ABI was observed in HHv3 artifacts.
            if (!Array.isArray(artifact.abi) || artifact.abi.length === 0 || !artifact.bytecode) {
                console.error(`[SolidityCompiler] Invalid artifact at ${artifactPath}. Artifact preview:\n${artifactJson.substring(0, 2000)}`);
                throw new AdapterError(`Compilation produced an invalid artifact for ${contractName}. ABI empty or bytecode missing. See log for ${artifactPath}`, { methodName: 'compile', code: SmartContractErrorCode.CompilationFailed, details: { artifactPath } });
            }

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
                await fs.writeFile(artifactPath as string, JSON.stringify(artifact, null, 2));
            }

            return this._buildCompiledOutput(finalArtifacts, factory, finalMetadata);

        } catch (error: any) {
            console.error(`[SolidityCompiler] Compilation failed: ${error.message}`, error.stack);
            if (error.stderr) console.error("Compilation stderr:", error.stderr);
            throw new AdapterError(`Solidity compilation failed: ${error?.message || String(error)}`, { methodName: 'compile', cause: error, code: SmartContractErrorCode.CompilationFailed });
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
        return inputContractName || sourceCode.match(/contract\s+([a-zA-Z0-9_]+)/)?.[1] || (() => { 
            throw new AdapterError("Could not determine contract name from source or input", { methodName: '_getContractName', code: SmartContractErrorCode.InvalidInput });
        })();
    }

    private _getContractDir(contractName: string, sourceCode: string, settings: any): string {
        const hashInput = contractName + sourceCode + JSON.stringify(settings) + this.solcVersion;
        const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
        return path.join(this.workDir, `${contractName}_${hash}`);
    }

    private _getSolidityVersion(sourceCode: string): string {
        let version = this.solcVersion;
        // Updated regex to handle prefixes and ranges
        const pragmaRegex = /pragma\s+solidity\s+([~^<>=]?\s*\d+\.\d+\.\d+)/;
        const pragmaMatch = sourceCode.match(pragmaRegex);
        if (pragmaMatch && pragmaMatch[1]) {
            // The wizard expects just the version number without the prefix
            const specificVersionRegex = /(\d+\.\d+\.\d+)/;
            const specificVersionMatch = pragmaMatch[1].match(specificVersionRegex);
            if (specificVersionMatch && specificVersionMatch[0]) {
                version = specificVersionMatch[0];
            }
        }
        return version;
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

    private async _runHardhatCompile(contractDir: string, contractName?: string) {
        const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName);
        let hardhatCommand = "npx hardhat";
        try {
            const projectHardhatPath = path.resolve(contractDir, 'node_modules', '.bin', 'hardhat');
            await fs.access(projectHardhatPath);
            hardhatCommand = `"${projectHardhatPath}"`;
        } catch { /* npx is fine */ }

        const compileCommand = `${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
        console.log(`[SolidityCompiler] Executing implementation compile (cwd=${contractDir}): ${compileCommand}`);

        let stdout: string | undefined;
        let stderr: string | undefined;

        try {
            const res = await execAsync(compileCommand, { cwd: contractDir, windowsHide: true });
            stdout = res.stdout;
            stderr = res.stderr;
            if (stdout) console.log(`[SolidityCompiler] Implementation compile stdout:\n${stdout}`);
            if (stderr) console.warn(`[SolidityCompiler] Implementation compile stderr:\n${stderr}`);
        } catch (error: any) {
            console.error(`[SolidityCompiler] Hardhat compile command failed. See details below.`);
            if (error.stderr) {
                console.error(`[SolidityCompiler] Hardhat Compile Error Output:\n${error.stderr}`);
                throw new AdapterError(`Hardhat compilation failed. Details:\n${error.stderr}`, { methodName: '_runHardhatCompile', code: SmartContractErrorCode.CompilationFailed });
            } else {
                throw new AdapterError(`Hardhat compilation failed with an unknown error: ${error.message}`, { methodName: '_runHardhatCompile', code: SmartContractErrorCode.CompilationFailed });
            }
        }

        // If caller provided a contractName, wait deterministically for that contract's artifact to exist
        if (contractName) {
            const artifactContractsDir = path.join(contractDir, 'artifacts', 'contracts');
            const nested = path.join(artifactContractsDir, `${contractName}.sol`, `${contractName}.json`);
            const flat = path.join(artifactContractsDir, `${contractName}.json`);
            const maxAttempts = 20;
            const delayMs = 300;
            let found: string | undefined;

            for (let i = 0; i < maxAttempts && !found; i++) {
                try {
                    await fs.access(nested, fs.constants.R_OK);
                    found = nested;
                    break;
                } catch { /* not yet */ }
                try {
                    await fs.access(flat, fs.constants.R_OK);
                    found = flat;
                    break;
                } catch { /* not yet */ }

                // small sleep before retry
                await new Promise(r => setTimeout(r, delayMs));
            }

            if (!found) {
                // fall back to a bounded recursive scan once
                const recursiveSearch = async (dir: string, depth = 0, maxDepth = 6): Promise<string | undefined> => {
                    try {
                        const entries = await fs.readdir(dir, { withFileTypes: true });
                        for (const e of entries) {
                            const p = path.join(dir, e.name);
                            if (e.isFile() && e.name === `${contractName}.json`) return p;
                            if (e.isDirectory() && depth < maxDepth) {
                                const f = await recursiveSearch(p, depth + 1, maxDepth);
                                if (f) return f;
                            }
                        }
                    } catch { /* ignore */ }
                    return undefined;
                };
                found = await recursiveSearch(path.join(contractDir, 'artifacts'));
            }

            if (!found) {
                console.error(`[SolidityCompiler] Compile completed but artifact for ${contractName} not found under ${path.join(contractDir, 'artifacts')}`);
                if (stdout) console.error(`[SolidityCompiler] Compile stdout (truncated):\n${stdout?.substring(0, 2000)}`);
                if (stderr) console.error(`[SolidityCompiler] Compile stderr (truncated):\n${stderr?.substring(0, 2000)}`);
                throw new AdapterError(`Hardhat compilation finished but artifact for '${contractName}' not found under ${path.join(contractDir, 'artifacts')}`, { methodName: '_runHardhatCompile', code: SmartContractErrorCode.CompilationFailed });
            }

            console.log(`[SolidityCompiler] Found artifact for ${contractName}: ${found}`);
            // return the artifact path to the caller so they don't need to re-scan
            this.currentContractDir = contractDir;
            return found;
        }

        this.currentContractDir = contractDir;
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