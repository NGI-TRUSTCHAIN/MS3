import { ERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { ERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options } from "@openzeppelin/wizard/dist/erc721.js";
import { IEVMWallet } from "@m3s/wallet"; // Adjust path if necessary

// Type alias for contract options
export type ContractOptions = ERC20Options | ERC721Options | ERC1155Options;

/** Input for generating contract source code */
export interface GenerateContractInput {
  language: string; // e.g., 'solidity', 'cairo', 'rust'
  template?: string; // Optional: e.g., 'openzeppelin_erc20', 'spl_token'
  options: Record<string, any>; // Language/template specific options provided by the user
}

/** Input for compiling source code */
export interface CompileInput {
    sourceCode: string;
    language: string; // Helps the adapter choose the right compiler toolchain
    contractName?: string; // Optional hint for the main contract artifact
    compilerOptions?: Record<string, any>; // Language/toolchain specific compiler flags
}

/** Generic output from compilation, holding various artifact types */
export interface CompiledOutput {
    /**
     * A map where keys are artifact types (e.g., 'abi', 'bytecode', 'metadata', 'idl', 'sierra')
     * and values are the corresponding artifact content (e.g., JSON array, hex string, object).
     */
    artifacts: Record<string, any>;
    /** Optional metadata about the compilation (e.g., compiler version, contract name) */
    metadata?: Record<string, any>;
}

/** Input for deploying a compiled contract */
export interface DeployInput {
    compiledContract: CompiledOutput; // Uses the generic compilation result
    constructorArgs?: any[];
    wallet: IEVMWallet; // Use the generic wallet interface for signing
    deployOptions?: Record<string, any>; // Chain-specific options (gas limits, fees, payer)
}

/** Generic output from deployment */
export interface DeployedOutput {
  /** A unique identifier for the deployed contract instance (e.g., address, program ID) */
  contractId: string;
  /** Optional: Information about the deployment transaction or process */
  deploymentInfo?: {
      transactionId?: string; // e.g., transaction hash
      blockHeight?: number | string;
      [key: string]: any; // Allow other chain-specific details
  };
  /** Optional: The interface definition (e.g., ABI, IDL) used for deployment, useful for subsequent interactions */
  contractInterface?: any;
}

/** Input for interacting (read or write) with a deployed contract */
export interface CallInput {
  contractId: string; // The identifier from DeployedOutput
  functionName: string; // The name of the function/method to call
  args?: any[]; // Arguments for the function call
  /** The wallet to use for signing (required for write operations) */
  wallet?: IEVMWallet;
  /** Optional: The specific interface (ABI, IDL) if not implicitly known by the adapter */
  contractInterface?: any;
  /** Optional: Chain/VM specific call options (e.g., read-only hint, gas limits, fees) */
  callOptions?: Record<string, any>;
}

export interface IBaseContractHandler {
  /** General Initialization specific to the adapter */
  initialize(args?: any): Promise<void>; // Keep flexible args
  isInitialized(): boolean;
  disconnect(): void; // Clean up resources

  /**
   * Generates contract source code based on language, template, and options.
   * @param input - Parameters defining the contract to generate.
   * @returns A promise resolving to the generated source code string.
   * @remarks Adapters implement the logic for specific languages/templates (like OpenZeppelin Wizard).
   */
  generateContract(input: GenerateContractInput): Promise<string>; // Returns source string for now

  /**
   * Compiles contract source code for a specific language.
   * @param input - Source code, language, and compiler options.
   * @returns A promise resolving to a generic structure containing compiled artifacts (like ABI, bytecode).
   */
  compile(input: CompileInput): Promise<CompiledOutput>;

  /**
   * Deploys a compiled contract using a wallet.
   * @param input - Compiled artifacts, constructor arguments, wallet, and deployment options.
   * @returns A promise resolving to the deployed contract's identifier and deployment details.
   */
  deploy(input: DeployInput): Promise<DeployedOutput>;

  /**
   * Calls a method on a deployed contract (can be read or write).
   * @param input - Contract identifier, function name, arguments, wallet (for writes), and call options.
   * @returns A promise resolving to the result of the method call. Type is 'any' due to variability.
   * @remarks Adapters handle encoding/decoding based on contract interface (ABI/IDL).
   */
  callMethod(input: CallInput): Promise<any>;

  // Optional: Could add specific read/write methods later if needed
  // queryMethod(input: CallInput): Promise<any>;
  // executeMethod(input: CallInput): Promise<DeployedOutput['deploymentInfo']>; // e.g., return tx info
}