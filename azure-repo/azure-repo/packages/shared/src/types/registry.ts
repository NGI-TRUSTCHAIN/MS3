import { Capability } from "../registry/capability.js";
import { WalletErrorCode } from "./error.js";

export interface ModuleMetadata {
  name: string;
  version: string;
}

export enum Ms3Modules {
  'shared' = 'shared',
  'wallet' = 'wallet',
  'smartcontract' = 'smart-contract',
  'crosschain' = 'crosschain'
}

export interface Requirement {
  /**
   * Dot-separated path to the required option within the params object (e.g., within params.options).
   * e.g., "options.privateKey", "options.web3authConfig.clientId"
   */
  path: string;
  /** Optional: Expected type of the value at the path. */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function' | 'any';
  /** Optional: Custom error message if this requirement is not met. */
  message?: string;
  /** Optional: If true, the path must exist but its value can be undefined. Defaults to false (value must be defined). */
  allowUndefined?: boolean;
}

export enum RuntimeEnvironment {
  BROWSER = 'browser',
  SERVER = 'server',
}

export interface EnvironmentRequirements {
  supportedEnvironments: RuntimeEnvironment[];
  securityNotes?: string[];
  limitations?: string[];
}

export interface Parameter {
  name: string;
  type: string;
  optional: boolean;
}
export interface MethodSignature {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
}

export interface AdapterMetadata {
  name: string;
  version: string;
  module: string;
  adapterType: string | number;
  adapterClass: any;
  capabilities: Capability[];
  requirements?: Requirement[];
  errorMap?: Record<string, WalletErrorCode | string>;
  environment?: EnvironmentRequirements;
}

export interface CompatibilityReport {
  compatible: boolean;
  conflicts: CompatibilityConflict[];
  recommendations: string[];
  supportedVersions: string[];
}

export interface CompatibilityConflict {
  type: 'version' | 'environment' | 'feature' | 'breaking-change';
  severity: 'error' | 'warning' | 'info';
  description: string;
  affectedVersions: string[];
  suggestedAction?: string;
}

export interface AdapterRequirements {
  environment?: RuntimeEnvironment[];
  features?: string[];
  compatibleWith?: {
    moduleName: string;
    adapterName: string;
    version: string;
  }[];
}

export interface CompatibilityMatrix {
  adapterName: string;
  version: string;
  compatibleVersions: string[];
  breakingChanges: {
    fromVersion: string;
    toVersion: string;
    changes: string[];
    migrationPath?: string;
  }[];
  crossModuleCompatibility: {
    moduleName: string;
    requiresCapabilities: Capability[];
  }[];
}