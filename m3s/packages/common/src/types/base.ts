

/**
 * Identity interface that all adapters implement
 */
export interface IAdapterIdentity {
  name: string;
  version: string;
}

/**
 * Lifecycle interface for adapters that need initialization
 */
export interface IAdapterLifecycle {
  initialize(): Promise<void>;
  isInitialized(): boolean;
}

/**
 * Base interface for an adapter's own construction arguments.
 * @template SpecificOptionsType - The type of the adapter-specific 'options' object.
 */
export interface AdapterArguments<SpecificOptionsType = Record<string, any>> {
  /** The unique name of the adapter */
  name: string;
  /** The version of the adapter */
  version: string;
  /** Adapter-specific configuration options */
  options: SpecificOptionsType;
}

/**
 * Base interface for module factory function arguments (e.g., createWallet, createCrossChain).
 * @template FeatureType - The type for the 'neededFeature' property, typically a string.
 * @template ModuleOptionsUnion - A union of all possible specific option types for adapters within this module.
 */
export interface ModuleArguments<
  FeatureType = string,
  ModuleOptionsUnion = Record<string, any>
> {
  /** The unique name of the adapter to be created or configured. */
  name: string;
  
  version: string;
  /**
   * Adapter-specific configuration options.
   * This field is required for factory functions, and its type is a union of all
   * possible option structures for the module.
   */
  options: ModuleOptionsUnion;
  /** Optional feature or capability string identifier required from the adapter. */
  neededFeature?: FeatureType;
}

export interface NetworkInfo {
  chainId: string | number;
  name?: string;
  rpcUrl: string; // ✅ Required - the actual RPC being used
  displayName?: string;
  blockExplorerUrl?: string;
  ticker?: string;
  tickerName?: string;
}

export interface NetworkConfig {
  chainId: string;
  name: string;
  displayName: string;
  rpcUrls: string[];
  decimals: number;
  blockExplorerUrl?: string;
  ticker?: string;
  tickerName?: string;
  shortName?: string;
  chainSlug?: string;
}

