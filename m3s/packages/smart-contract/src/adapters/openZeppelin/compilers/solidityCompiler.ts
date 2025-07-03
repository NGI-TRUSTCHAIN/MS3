import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { ethers, ContractFactory } from "ethers";
import { CompileInput, CompiledOutput } from "../../../types/index.js";

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
        console.log(`[SolidityCompiler] Initialized with solc version: ${this.solcVersion}, workDir: ${this.workDir}, preserveOutput: ${this.preserveOutput}`);
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

        let contractDir: string | undefined;
        const effectiveCompilerSettings = { ...this.compilerSettings, ...compilerOptions };

        try {
            const contractName = inputContractName || sourceCode.match(/contract\s+([a-zA-Z0-9_]+)/)?.[1];
            if (!contractName) throw new Error("Could not determine contract name from source or input");

            const hashInput = contractName + sourceCode + JSON.stringify(effectiveCompilerSettings) + this.solcVersion;
            const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
            contractDir = path.join(this.workDir, `${contractName}_${hash}`);
            const artifactPath = path.join(contractDir, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);

            let versionForHardhat = this.solcVersion;
            const pragmaRegex = /pragma\s+solidity\s+([^\s;]+)\s*;/;
            const pragmaMatch = sourceCode.match(pragmaRegex);

            if (pragmaMatch && pragmaMatch[1]) {
                const pragmaVersionString = pragmaMatch[1];
                const specificVersionRegex = /(\d+\.\d+\.\d+)/;
                const specificVersionMatch = pragmaVersionString.match(specificVersionRegex);
                if (specificVersionMatch && specificVersionMatch[0]) {
                    versionForHardhat = specificVersionMatch[0];
                }
            }

            // --- Check Cache ---
            if (this.preserveOutput) {
                try {
                    const existingArtifactJson = await fs.readFile(artifactPath, 'utf-8');
                    const existingArtifact = JSON.parse(existingArtifactJson);
                    if (existingArtifact.abi && existingArtifact.bytecode && existingArtifact.metadata && existingArtifact.metadata.compilerVersion === versionForHardhat) {
                        console.log(`[SolidityCompiler] Using cached artifact for ${contractName} (version: ${versionForHardhat}) from ${contractDir}`);
                        const factory = new ContractFactory(existingArtifact.abi, existingArtifact.bytecode);
                        const artifacts = {
                            abi: existingArtifact.abi,
                            bytecode: existingArtifact.bytecode,
                            contractName: existingArtifact.contractName,
                            sourceName: existingArtifact.sourceName,
                        };
                        const metadata = {
                            compiler: existingArtifact.metadata.compiler || 'hardhat',
                            compilerVersion: existingArtifact.metadata.compilerVersion,
                            language: existingArtifact.metadata.language || 'solidity',
                            contractName: existingArtifact.metadata.contractName || existingArtifact.contractName,
                            isUpgradeable: existingArtifact.metadata.isUpgradeable,
                            upgradeabilityType: existingArtifact.metadata.upgradeabilityType
                        };
                        return this._buildCompiledOutput(artifacts, factory, metadata);
                    }
                } catch (readError) { /* Cache miss, continue */ }
            }

            // --- Compile ---
            console.log(`[SolidityCompiler] Compiling ${contractName} using Solidity ${versionForHardhat} in ${contractDir}`);
            await fs.rm(contractDir, { recursive: true, force: true });
            await fs.mkdir(contractDir, { recursive: true });

            const hardhatConfigPath = path.join(contractDir, this.hardhatConfigFileName);
            const contractsDirPath = path.join(contractDir, 'contracts');
            await fs.mkdir(contractsDirPath, { recursive: true });
            const contractPath = path.join(contractsDirPath, `${contractName}.sol`);
            await fs.writeFile(contractPath, sourceCode);

            const hardhatConfigContent = `
module.exports = {
  solidity: { version: "${versionForHardhat}", settings: ${JSON.stringify(effectiveCompilerSettings, null, 2)} },
  paths: { sources: "./contracts", artifacts: "./artifacts" },
  ...${JSON.stringify(effectiveCompilerSettings?.customSettings || {}, null, 2)}
};`;
            await fs.writeFile(hardhatConfigPath, hardhatConfigContent);

            // --- Install dependencies for upgradeable contracts ---
            const isUpgradeableImplementation = sourceCode.includes('@openzeppelin/contracts-upgradeable');
            if (isUpgradeableImplementation) {
                const packageJsonPath = path.join(contractDir, 'package.json');
                const ozContractsVersion = "^5.0.0";
                const ozContractsUpgradeableVersion = "^5.0.0";
                await fs.writeFile(packageJsonPath, JSON.stringify({
                    name: `implementation-compilation-${hash}`,
                    version: "1.0.0",
                    dependencies: {
                        "@openzeppelin/contracts": ozContractsVersion,
                        "@openzeppelin/contracts-upgradeable": ozContractsUpgradeableVersion,
                    }
                }, null, 2));

                let installCommand = `cd "${contractDir}" && npm install --legacy-peer-deps`;
                try {
                    console.log(`[SolidityCompiler] Running npm install for implementation in ${contractDir}`);
                    await execAsync(installCommand);
                } catch (installError: any) {
                    console.warn(`[SolidityCompiler] npm install for implementation failed in ${contractDir}, compilation may fail: ${installError.message}`);
                }
            }

            let hardhatCommand = "npx hardhat";
            try {
                const projectHardhatPath = path.resolve(process.cwd(), 'node_modules', '.bin', 'hardhat');
                await fs.access(projectHardhatPath);
                hardhatCommand = `"${projectHardhatPath}"`;
            } catch { /* npx is fine */ }

            const compileCommand = `cd "${contractDir}" && ${hardhatCommand} compile --config "${hardhatConfigPath}" --force`;
            console.log(`[SolidityCompiler] Executing implementation compile: ${compileCommand}`);
            const { stdout, stderr } = await execAsync(compileCommand);
            if (stdout) console.log(`[SolidityCompiler] Implementation compile stdout:\n${stdout}`);
            if (stderr) console.warn(`[SolidityCompiler] Implementation compile stderr:\n${stderr}`);

            const artifactJson = await fs.readFile(artifactPath, 'utf-8');
            const artifact = JSON.parse(artifactJson);

            if (!artifact.abi || !artifact.bytecode) {
                throw new Error("Compilation succeeded but artifact missing ABI or bytecode.");
            }

            const factory = new ContractFactory(artifact.abi, artifact.bytecode);
            const finalArtifacts = {
                abi: artifact.abi,
                bytecode: artifact.bytecode,
                contractName: artifact.contractName,
                sourceName: artifact.sourceName,
            };

            const hasInitializeFunction = finalArtifacts.abi.some((item: any) => item.type === "function" && item.name === "initialize");
            const hasExplicitConstructorArgs = finalArtifacts.abi.some((item: any) => item.type === "constructor" && item.inputs && item.inputs.length > 0);
            const isUUPS = sourceCode.includes('UUPSUpgradeable') || sourceCode.includes('_authorizeUpgrade');

            let isUpgradeable = false;
            let upgradeabilityType: string | undefined = undefined;

            if (hasInitializeFunction && !hasExplicitConstructorArgs) {
                isUpgradeable = true;
                upgradeabilityType = isUUPS ? 'uups' : 'transparent';
            }

            const finalMetadata = {
                compiler: 'hardhat',
                compilerVersion: versionForHardhat,
                language: 'solidity',
                contractName: finalArtifacts.contractName,
                isUpgradeable,
                upgradeabilityType
            };

            if (this.preserveOutput) {
                const artifactToSave = { ...artifact };
                artifactToSave.metadata = {
                    ...(artifactToSave.metadata || {}),
                    ...finalMetadata
                };
                await fs.writeFile(artifactPath, JSON.stringify(artifactToSave, null, 2));
            }

            return this._buildCompiledOutput(finalArtifacts, factory, finalMetadata);

        } catch (error: any) {
            console.error(`[SolidityCompiler] Compilation failed: ${error.message}`, error.stack);
            if (error.stderr) console.error("Compilation stderr:", error.stderr);
            throw new Error(`Solidity compilation failed: ${error.message}`);
        } finally {
            if (contractDir && !this.preserveOutput) {
                try {
                    await fs.rm(contractDir, { recursive: true, force: true });
                    console.log(`[SolidityCompiler] Cleaned up temporary contract directory: ${contractDir}`);
                } catch (cleanupError: any) {
                    console.warn(`[SolidityCompiler] Failed to cleanup temporary contract directory ${contractDir}: ${cleanupError.message}`);
                }
            }
        }
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
                return { type: 'regular', data: deployTx.data!, value: deployTx.value?.toString() || "0" };
            },
            getProxyDeploymentData: async (initializeArgs?: any[]) => {
                const abiInputs = getAbiInputs(artifacts.abi, 'function', 'initialize');
                validateArgs(initializeArgs || [], abiInputs);
                const implDeployTx = await factory.getDeployTransaction();
                const logicInterface = new ethers.Interface(artifacts.abi);
                const initDataForLogic = logicInterface.encodeFunctionData('initialize', initializeArgs || []);
                const proxyArtifacts = await this.getStandardProxyArtifacts();
                return {
                    type: 'proxy',
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