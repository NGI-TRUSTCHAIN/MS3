import { ProviderConfig } from "@m3s/common";

export interface OpenZeppelinAdapterArgs {
    options?: {
        workDir?: string;
        hardhatConfig?: {
            configFileName?: string;
            customSettings?: Record<string, any>;
        };
        preserveOutput?: boolean;
        providerConfig?: ProviderConfig;
        compilerSettings?: any; // Primarily for Solidity/Hardhat
        solcVersion?: string;
    }
}

export interface WizardAPI { print: (options: any) => string; }
