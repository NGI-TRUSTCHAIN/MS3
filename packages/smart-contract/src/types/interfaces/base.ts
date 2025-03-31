import { ERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { ERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options } from "@openzeppelin/wizard/dist/erc721.js";

// Type alias for contract options
export type ContractOptions = ERC20Options | ERC721Options | ERC1155Options;

// Result of compilation
export interface CompiledContract {
  abi: any[];
  bytecode: string;
  contractName: string;
}

// Deployed contract result
export interface DeployedContract {
  address: string;
  transactionHash: string;
  abi: any[];
}

export interface IGenerateContractParams {
    standard: string;
    options: ContractOptions;
}

export interface IBaseContractHandler {
  /** General Initialization */
  initialize(args?: any): Promise<any>;
  isInitialized(): boolean;
  disconnect(): void; // Clean disconnect

  /** Contract Generation & Compilation (No wallet needed) */
  generateContract(args:IGenerateContractParams): Promise<string>; 
  compile(source: string): Promise<CompiledContract>;
  
  /** Contract Deployment & Interaction (Wallet needed) */
  deploy(
    compiledContract: CompiledContract, 
    constructorArgs: any[], 
    signer: any
  ): Promise<DeployedContract>;
  
  callMethod(
    contractAddress: string, 
    abi: any[],  // Add ABI for type safety
    method: string, 
    args: any[], 
    signer: any
  ): Promise<any>;
  
}

export interface IContractOptions {
  adapterName: string;
  neededFeature?: string;
  provider?: any;
  options?: any;
}