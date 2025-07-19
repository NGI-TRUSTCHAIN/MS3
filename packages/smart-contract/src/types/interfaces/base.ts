import { DeploymentDataType } from "../enums/base.js";
import { ERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options } from "@openzeppelin/wizard/dist/erc721.js";
import { ERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { GenerateContractInput } from "../types/index.js";

/** Input for generating contract source code */
// Define a base that is common to all inputs
interface BaseContractInput {
  language: string; // e.g., 'solidity', 'cairo', 'rust'
}

// Create a specific interface for each template
export interface ERC20ContractInput extends BaseContractInput {
  template: 'openzeppelin_erc20'; // Use a literal type
  options: ERC20Options;
}

export interface ERC721ContractInput extends BaseContractInput {
  template: 'openzeppelin_erc721'; // Use a literal type
  options: ERC721Options;
}

export interface ERC1155ContractInput extends BaseContractInput {
  template: 'openzeppelin_erc1155'; // Use a literal type
  options: ERC1155Options;
}


/** Input for compiling source code */
export interface CompileInput {
  sourceCode: string;
  language: string; // Helps the adapter choose the right compiler toolchain
  contractName?: string; // Optional hint for the main contract artifact
  compilerOptions?: Record<string, any>; // Language/toolchain specific compiler flags
}

export interface CompiledOutput {
  artifacts: {
    abi: any[];
    bytecode: string;
    contractName: string;
    sourceName: string;
  };
  getDeploymentArgsSpec: (opts?: { proxy?: boolean }) => { name: string, type: string }[];
  getRegularDeploymentData: (constructorArgs?: any[]) => Promise<RegularDeployment>;
  getProxyDeploymentData: (initializeArgs?: any[]) => Promise<ProxyDeployment>;
  metadata?: Record<string, any>;
}

export interface RegularDeployment {
  type:  DeploymentDataType.regular;
  data: string; // Full calldata for deployment (bytecode + encoded constructor args)
  value?: string;
}

export interface ProxyDeployment {
  type: DeploymentDataType.proxy;
  implementation: { // Data to deploy the logic contract
    data: string; // Full calldata for logic contract deployment (bytecode + encoded constructor args, if any)
    value?: string;
  };
  proxy: { // Information to deploy the proxy contract (e.g., a standard ERC1967Proxy)
    bytecode: string; // Bytecode of the proxy contract itself (e.g., M3S_ERC1967Proxy)
    abi: any[];       // ABI of the proxy contract
    logicInitializeData: string; // Encoded call to logic.initialize(...args)
    value?: string;
    // The deployer will use proxy.bytecode, proxy.abi, the deployed implementationAddress, 
    // and proxy.logicInitializeData to construct the final proxy deployment transaction.
    // e.g., for ERC1967Proxy, constructor is (address logic, bytes memory dataToCallOnLogic)
  };
}

/**
 * Contract source code generation capabilities
 */
export interface IContractGenerator {
  /**
   * Generates contract source code based on language, template, and options.
   * @param input - Parameters defining the contract to generate.
   * @returns A promise resolving to the generated source code string.
   */
  generateContract(input: GenerateContractInput): Promise<string>;
}

/**
 * Contract compilation capabilities
 */
export interface IContractCompiler {
  /**
   * Compiles contract source code for a specific language.
   * @param input - Source code, language, and compiler options.
   * @returns A promise resolving to a generic structure containing compiled artifacts.
   */
  compile(input: CompileInput): Promise<CompiledOutput>;
}