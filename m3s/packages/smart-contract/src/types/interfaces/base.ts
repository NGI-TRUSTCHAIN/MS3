import { IAdapterIdentity, IAdapterLifecycle } from "@m3s/common";

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
  type: 'regular';
  data: string; // Full calldata for deployment (bytecode + encoded constructor args)
  value?: string;
}

export interface ProxyDeployment {
  type: 'proxy';
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
interface IContractGenerator {
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
interface IContractCompiler {
  /**
   * Compiles contract source code for a specific language.
   * @param input - Source code, language, and compiler options.
   * @returns A promise resolving to a generic structure containing compiled artifacts.
   */
  compile(input: CompileInput): Promise<CompiledOutput>;
}

/**
 * Complete contract handler interface - composed of all contract operations
 */
export interface IBaseContractHandler extends
  IAdapterIdentity,
  IAdapterLifecycle,
  IContractGenerator,
  IContractCompiler { }