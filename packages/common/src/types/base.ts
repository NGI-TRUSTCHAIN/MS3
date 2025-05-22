/**
 * Base interface for an adapter's own construction arguments, if it needs a specific type
 * distinct from the module factory's arguments.
 * @template SpecificOptionsType - The type of the adapter-specific 'options' object (e.g., IEthersWalletOptionsV1, ILiFiAdapterOptionsV1).
 */
export interface AdapterArguments<SpecificOptionsType = Record<string, any>> {
  adapterName: string;
  options: SpecificOptionsType; // Can be optional here if some adapters truly have no options
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
  adapterName: string;
  /**
   * Adapter-specific configuration options.
   * This field is required for factory functions, and its type is a union of all
   * possible option structures for the module.
   */
  options: ModuleOptionsUnion;
  /** Optional feature or capability string identifier required from the adapter. */
  neededFeature?: FeatureType;
}

export interface NetworkConfig {
  chainId: string;
  name: string;
  displayName: string;
  rpcUrls: string[];
  blockExplorer?: string;
  ticker?: string;
  tickerName?: string;
  shortName?: string;
  chainSlug?: string;
}