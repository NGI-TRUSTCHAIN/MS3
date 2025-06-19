import { CompatibilityMatrix } from '../types/registry.js';

/**
 * ✅ STATIC COMPATIBILITY DATABASE
 * All cross-package compatibility information hardcoded here
 */

// ✅ Wallet Compatibility Matrices
export const WALLET_COMPATIBILITY: Record<string, CompatibilityMatrix> = {
  'ethers@1.0.0': {
    adapterName: 'ethers',
    version: '1.0.0',
    compatibleVersions: ['1.0.0'],
    breakingChanges: [],
    crossModuleCompatibility: [
      {
        moduleName: 'smart-contract',
        compatibleAdapters: [
          { name: 'openZeppelin', versions: ['1.0.0'] }
        ]
      },
      {
        moduleName: 'crosschain',
        compatibleAdapters: [
          { name: 'lifi', versions: ['1.0.0'] }
        ]
      }
    ]
  },
  'web3auth@1.0.0': {
    adapterName: 'web3auth',
    version: '1.0.0',
    compatibleVersions: ['1.0.0'],
    breakingChanges: [],
    crossModuleCompatibility: [
      {
        moduleName: 'smart-contract',
        compatibleAdapters: [
          { name: 'openZeppelin', versions: ['1.0.0'] }
        ]
      },
      // ❌ NOTE: web3auth is BROWSER-only, so NO crosschain compatibility
      // crosschain adapters typically need server environment
    ]
  }
};

// ✅ Smart Contract Compatibility Matrices
export const SMART_CONTRACT_COMPATIBILITY: Record<string, CompatibilityMatrix> = {
  'openZeppelin@1.0.0': {
    adapterName: 'openZeppelin',
    version: '1.0.0',
    compatibleVersions: ['1.0.0'],
    breakingChanges: [],
    crossModuleCompatibility: [
      {
        moduleName: 'wallet',
        compatibleAdapters: [
          { name: 'ethers', versions: ['1.0.0'] },
          { name: 'web3auth', versions: ['1.0.0'] }
        ]
      }
    ]
  }
};

// ✅ Crosschain Compatibility Matrices  
export const CROSSCHAIN_COMPATIBILITY: Record<string, CompatibilityMatrix> = {
  'lifi@1.0.0': {
    adapterName: 'lifi',
    version: '1.0.0',
    compatibleVersions: ['1.0.0'],
    breakingChanges: [],
    crossModuleCompatibility: [
      {
        moduleName: 'wallet',
        compatibleAdapters: [
          { name: 'ethers', versions: ['1.0.0'] }
          // ❌ NOTE: NO web3auth - environment incompatibility
        ]
      }
    ]
  }
};

// ✅ Master lookup function
export function getStaticCompatibilityMatrix(
  moduleName: string, 
  adapterName: string, 
  version: string
): CompatibilityMatrix | undefined {
  const key = `${adapterName}@${version}`;
  
  switch (moduleName) {
    case 'wallet':
      return WALLET_COMPATIBILITY[key];
    case 'smart-contract':
      return SMART_CONTRACT_COMPATIBILITY[key];
    case 'crosschain':
      return CROSSCHAIN_COMPATIBILITY[key];
    default:
      return undefined;
  }
}

// ✅ Compatibility checker function
export function checkCrossPackageCompatibility(
  sourceModule: string, sourceAdapter: string, sourceVersion: string,
  targetModule: string, targetAdapter: string, targetVersion: string
): boolean {
  const matrix = getStaticCompatibilityMatrix(sourceModule, sourceAdapter, sourceVersion);
  if (!matrix) return false;
  
  const targetModuleCompat = matrix.crossModuleCompatibility.find(
    cmc => cmc.moduleName === targetModule
  );
  
  if (!targetModuleCompat) return false;
  
  const compatibleAdapter = targetModuleCompat.compatibleAdapters.find(
    ca => ca.name === targetAdapter && ca.versions.includes(targetVersion)
  );
  
  return !!compatibleAdapter;
}