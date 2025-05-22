import { WalletErrorCode } from "./error.js"; // Assuming WalletErrorCode is in error.ts

export interface ModuleMetadata {
    name: string;
    version: string;
}

export interface Requirement {
  /**
   * Dot-separated path to the required option within the params object (e.g., within params.options).
   * e.g., "options.privateKey", "options.web3authConfig.clientId"
   */
  path: string;
  /** Optional: Expected type of the value at the path. */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function';
  /** Optional: Custom error message if this requirement is not met. */
  message?: string;
  /** Optional: If true, the path must exist but its value can be undefined. Defaults to false (value must be defined). */
  allowUndefined?: boolean;
}

export interface AdapterMetadata {
  name: string;
  module: string;
  adapterType: string | number;
  adapterClass: any; // Constructor type for the adapter (typically with a static `create` method)
  requirements?: Requirement[];
  errorMap?: Record<string, WalletErrorCode | string>;
  features?: string[];
}