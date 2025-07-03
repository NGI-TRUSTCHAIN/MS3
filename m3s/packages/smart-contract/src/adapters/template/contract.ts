import { 
  IBaseContractHandler, 
  CompiledOutput,
  CompileInput,
  GenerateContractInput,
} from "../../types/index.js";
import { AdapterArguments } from "@m3s/common";

/**
 * Specific options for this contract adapter template.
 */
export interface ContractTemplateOptions {
  /** Required string option - describe what this does */
  option_1: string;
  
  /** Required nested object option */
  option_2: {
    /** Required number sub-option */
    option_2_1: number,
    /** Required string array sub-option */
    option_2_2: string[]
  },
  
  /** Optional BigInt option - describe what this does */
  option_3?: BigInt;
  
  // TODO: Add the options as required by your specific adapter implementation
}

interface args extends AdapterArguments<ContractTemplateOptions> { }

/**
 * Template Contract Handler Adapter
 */
export class ContractTemplateAdapter implements IBaseContractHandler {
   public readonly name: string;
  public readonly version: string;
  
  private initialized: boolean = false;

  private constructor(args: args) {
    this.name = args.name;
    this.version = args.version;
  }

  static async create(args: args): Promise<ContractTemplateAdapter> {
    const adapter = new ContractTemplateAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // TODO: Implement initialization logic
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ✅ CLEAN: Only implement what IBaseContractHandler actually requires
  async generateContract(input: GenerateContractInput): Promise<string> {
    console.debug('THE INPUT TO GENERATE CONTRACT IS', input)
    throw new Error("generateContract not implemented");
  }

  async compile(input: CompileInput): Promise<CompiledOutput> {
    console.debug('THE INPUT TO COMPILE CONTRACT IS', input)
    throw new Error("compile not implemented");
  }

}