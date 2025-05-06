// import { CompileInput, CompiledOutput } from '../../../types/index.js'; // Adjust path
// import { promisify } from "util";
// import { exec } from "child_process";
// import * as fs from "fs/promises";
// import * as path from "path";

// export default class CairoCompiler {
//     private workDir: string;
//     private compilerSettings: any; // Now holds potential Cairo-specific settings
//     private preserveOutput: boolean;
//     private execAsync = promisify(exec);

//     constructor(config: {
//         workDir: string;
//         compilerSettings?: {
//             cairo?: { // Namespace Cairo settings
//                 openzeppelinTag?: string; // e.g., "v0.14.0"
//                 starknetVersion?: string; // e.g., ">=2.6.3"
//                 edition?: string; // e.g., "2023_11"
//                 // Add other scarb/cairo settings if needed
//             };
//             // Keep existing general/solidity settings if any
//             [key: string]: any;
//         };
//         preserveOutput: boolean;
//     }) {
//         this.workDir = config.workDir;
//         this.compilerSettings = config.compilerSettings || {};
//         this.preserveOutput = config.preserveOutput;
//         // Use a more recent default tag if none is provided in settings
//         const defaultOzTag = 'v1.0.0'; // <<< CHANGE THIS LINE
//         console.log(`[CairoCompiler] Initialized (using Scarb). OZ Tag default/override: ${this.compilerSettings?.cairo?.openzeppelinTag || defaultOzTag}`);
//     }

//     async compile(input: CompileInput): Promise<CompiledOutput> {
//         const { sourceCode, language, contractName: inputContractName } = input;
//         console.log(`[CairoCompiler] Attempting to compile Cairo contract...`);

//         if (language.toLowerCase() !== 'cairo') {
//             throw new Error(`[CairoCompiler] This compiler only supports 'cairo'. Language provided: ${language}`);
//         }

//         // --- Check Scarb Availability Early & Capture Version ---
//         let scarbVersion = 'unknown'; // Declare scarbVersion in the outer scope
//         try {
//             const { stdout: versionStdout } = await this.execAsync('scarb --version'); // Use unique name for stdout
//             scarbVersion = versionStdout.trim();
//             console.log(`[CairoCompiler] Found Scarb: ${scarbVersion}`);
//         } catch (versionError) {
//             console.error("[CairoCompiler] Error: 'scarb' command not found or failed. Ensure Scarb (Starknet toolchain) is installed and in PATH.");
//             console.error("[CairoCompiler] See Starknet documentation for installation: https://docs.starknet.io/develop/getting-started/installation");
//             throw new Error("'scarb' not found. Cairo compilation requires the Scarb toolchain.");
//         }

//         // --- Determine Contract & Project Names ---
//         const contractName = inputContractName || sourceCode.match(/mod\s+([a-zA-Z0-9_]+)/)?.[1];
//         if (!contractName) throw new Error("Could not determine contract name from source or input");

//         // --- Define Paths ---
//         const hashInput = contractName + sourceCode + JSON.stringify(this.compilerSettings?.cairo || {});
//         const hash = Buffer.from(hashInput).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
//         const contractDir = path.join(this.workDir, `cairo_${contractName}_${hash}`);
//         const scarbPackageName = `m3s_scarb_project_${hash}`.toLowerCase();
//         const sierraArtifactPath = path.join(contractDir, 'target', 'dev', `${scarbPackageName}_${contractName}.contract_class.json`);
//         const casmArtifactPath = path.join(contractDir, 'target', 'dev', `${scarbPackageName}_${contractName}.compiled_contract_class.json`);
//         const sourceFilePath = path.join(contractDir, 'src', 'lib.cairo');

//         // --- Check Cache ---
//         if (this.preserveOutput) {
//             try {
//                 const existingSierraJson = await fs.readFile(sierraArtifactPath, 'utf-8');
//                 const existingSierraArtifact = JSON.parse(existingSierraJson);
//                 if (existingSierraArtifact && existingSierraArtifact.abi && existingSierraArtifact.sierra_program) {
//                     console.log(`[CairoCompiler] Using cached Scarb artifact for ${contractName} from ${contractDir}`);
//                     let casmArtifact = undefined;
//                     try {
//                         const existingCasmJson = await fs.readFile(casmArtifactPath, 'utf-8');
//                         casmArtifact = JSON.parse(existingCasmJson);
//                     } catch { /* CASM might not exist */ }

//                     return { // <<< RETURN CACHED RESULT
//                         artifacts: {
//                             abi: existingSierraArtifact.abi,
//                             sierra: existingSierraArtifact,
//                             casm: casmArtifact,
//                             contractName: contractName,
//                             sourceName: 'lib.cairo',
//                         },
//                         metadata: {
//                             compiler: 'scarb',
//                             compilerVersion: scarbVersion.split(' ')[1] || scarbVersion, // Use captured version
//                             language: 'cairo',
//                             contractName: contractName,
//                         }
//                     };
//                 }
//             } catch (readError) { /* Cache miss, continue */ }
//         }

//         // --- Compilation Required ---
//         try {
//             // --- Prepare Scarb Project ---
//             console.log(`[CairoCompiler] Preparing Scarb project for ${contractName} in temporary directory: ${contractDir}`);
//             await fs.rm(contractDir, { recursive: true, force: true });
//             await fs.mkdir(path.join(contractDir, 'src'), { recursive: true });
//             await fs.writeFile(sourceFilePath, sourceCode);

//             // Generate Scarb.toml content
//             const scarbTomlPath = path.join(contractDir, 'Scarb.toml');
//             const defaultOzTag = 'v1.0.0';
//             const ozTag = this.compilerSettings?.cairo?.openzeppelinTag || defaultOzTag;
//             const defaultStarknetVersion = ">=2.6.3";
//             const starknetVersion = this.compilerSettings?.cairo?.starknetVersion || defaultStarknetVersion;
//             const defaultCairoEdition = "2023_11";
//             const cairoEdition = this.compilerSettings?.cairo?.edition || defaultCairoEdition;

//             const scarbTomlContent = `
// [package]
// name = "${scarbPackageName}"
// version = "0.1.0"
// edition = "${cairoEdition}"

// [dependencies]
// starknet = "${starknetVersion}"
// openzeppelin = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "${ozTag}" }

// [[target.starknet-contract]]
// sierra = true
// casm = true
// `;
//             await fs.writeFile(scarbTomlPath, scarbTomlContent.trim());
//             console.log(`[CairoCompiler] Generated Scarb.toml with OZ tag: ${ozTag}`);

//             // --- Execute Scarb Build ---
//             const compileCommand = `cd "${contractDir}" && scarb build`;
//             console.log(`[CairoCompiler] Executing: ${compileCommand}`);
//             // Use unique names for build stdout/stderr
//             const { stdout: buildStdout, stderr: buildStderr } = await this.execAsync(compileCommand);
//             if (buildStdout) console.log(`[CairoCompiler] Scarb stdout:\n${buildStdout}`);
//             if (buildStderr) console.warn(`[CairoCompiler] Scarb stderr:\n${buildStderr}`);

//             // --- Read Artifacts ---
//             console.log(`[CairoCompiler] Reading Sierra artifact (Contract Class): ${sierraArtifactPath}`);
//             const sierraJson = await fs.readFile(sierraArtifactPath, 'utf-8');
//             const sierraArtifact = JSON.parse(sierraJson);
//             let casmArtifact = undefined;
//             try {
//                 console.log(`[CairoCompiler] Reading CASM artifact (Compiled Class): ${casmArtifactPath}`);
//                 const casmJson = await fs.readFile(casmArtifactPath, 'utf-8');
//                 casmArtifact = JSON.parse(casmJson);
//             } catch {
//                 console.warn(`[CairoCompiler] CASM artifact not found or failed to read at ${casmArtifactPath}.`);
//             }

//             // Basic validation
//             if (!sierraArtifact || !sierraArtifact.abi || !sierraArtifact.sierra_program) {
//                 throw new Error("Cairo compilation using Scarb succeeded but artifact missing Sierra program or ABI.");
//             }

//             // --- Format Output ---
//             const compiledOutput: CompiledOutput = {
//                 artifacts: {
//                     abi: sierraArtifact.abi,
//                     sierra: sierraArtifact,
//                     casm: casmArtifact,
//                     contractName: contractName,
//                     sourceName: 'lib.cairo',
//                 },
//                 metadata: {
//                     compiler: 'scarb',
//                     compilerVersion: scarbVersion.split(' ')[1] || scarbVersion, // Use captured version
//                     language: 'cairo',
//                     contractName: contractName,
//                 }
//             };

//             // --- Write README if preserving output ---
//             if (this.preserveOutput) {
//                 try {
//                     const readmePath = path.join(contractDir, 'README.md');
//                     const readmeContent = `# ${contractName} (Cairo / Scarb)\n\nCompiled by M3S CairoCompiler on ${new Date().toISOString()}\nCompiler: ${scarbVersion}\nOZ Contracts Tag: ${ozTag}\n\nSource: \`src/lib.cairo\`\nSierra (Contract Class): \`target/dev/${path.basename(sierraArtifactPath)}\`\nCASM (Compiled Class): \`${casmArtifact ? `target/dev/${path.basename(casmArtifactPath)}` : 'N/A'}\``;
//                     await fs.writeFile(readmePath, readmeContent);
//                 } catch (err: any) { console.warn(`[CairoCompiler] Failed to write README: ${err.message}`); }
//             }

//             console.log(`[CairoCompiler] Scarb compilation successful for ${contractName}.`);
//             return compiledOutput;

//         } catch (error: any) {
//             console.error(`[CairoCompiler] Scarb compilation failed: ${error.message}`, error.stack);
//             // Check if stderr was captured during build execution (it might be on the error object if execAsync throws)
//             if (error.stderr) console.error("Compilation stderr:", error.stderr);
//             if (error.message.includes('command failed')) {
//                 throw new Error(`Scarb build command failed. Check Scarb output/stderr for details. Ensure source code is valid and dependencies are correct. Error: ${error.message}`);
//             }
//             throw new Error(`Cairo (Scarb) compilation failed: ${error.message}`);
//         } finally {
//             // --- Cleanup ---
//             // Use the contractDir defined outside the try block
//             if (contractDir && !this.preserveOutput) {
//                 try {
//                     await fs.rm(contractDir, { recursive: true, force: true });
//                     console.log(`[CairoCompiler] Cleaned up temporary Scarb project directory: ${contractDir}`);
//                 } catch (cleanupError: any) {
//                     console.warn(`[CairoCompiler] Failed to cleanup temporary Scarb project directory ${contractDir}: ${cleanupError.message}`);
//                 }
//             }
//         }
//     }
// }