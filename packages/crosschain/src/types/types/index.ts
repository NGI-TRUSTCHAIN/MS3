export * from '../interfaces/index.js';

// Define adapter types for cross-chain operations
export enum CrossChainAdapterType {
  'aggregator' = 'aggregator',
  'bridge' = 'bridge',
  'core' = 'core'
}

// Define options for cross-chain module
export interface ICrossChainOptions {
  adapterName: string;
  config?: any;
  options?: any;
  neededFeature?: string;
}