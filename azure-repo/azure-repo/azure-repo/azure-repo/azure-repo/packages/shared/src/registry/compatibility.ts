import { detectRuntimeEnvironment } from '../helpers/environment.js';
import { CompatibilityMatrix, Ms3Modules } from '../types/registry.js';
import { Capability } from './capability.js';
import { UniversalRegistry } from './registry.js';

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
        moduleName: Ms3Modules.smartcontract,
        // ✅ This wallet can work with any smart-contract adapter that can generate contracts.
        requiresCapabilities: [Capability.ContractGenerator]
      },
      {
        moduleName: Ms3Modules.crosschain,
        // ✅ This wallet can work with any crosschain adapter that can execute operations.
        requiresCapabilities: [Capability.OperationHandler]
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
        moduleName: Ms3Modules.smartcontract,
        // ✅ This wallet can work with any smart-contract adapter that can generate contracts.
        requiresCapabilities: [Capability.ContractGenerator]
      },
      {
        moduleName: Ms3Modules.crosschain,
        // ✅ This wallet can work with any crosschain adapter that can execute operations.
        requiresCapabilities: [Capability.OperationHandler]
      }
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
        moduleName: Ms3Modules.wallet,
        // ✅ This smart-contract adapter needs a wallet that can handle transactions.
        requiresCapabilities: [Capability.TransactionHandler, Capability.RPCHandler]
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
        moduleName: Ms3Modules.wallet,
        // ✅ This crosschain adapter needs a wallet that can handle transactions and RPC calls.
        requiresCapabilities: [Capability.TransactionHandler, Capability.RPCHandler]
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
    case Ms3Modules.wallet:
      return WALLET_COMPATIBILITY[key];
    case Ms3Modules.smartcontract:
      return SMART_CONTRACT_COMPATIBILITY[key];
    case Ms3Modules.crosschain:
      return CROSSCHAIN_COMPATIBILITY[key];
    default:
      return undefined;
  }
}

// ✅ Compatibility checker function
export function checkCrossPackageCompatibility(
  registry: UniversalRegistry,
  sourceModule: string, sourceAdapter: string, sourceVersion: string,
  targetModule: string, targetAdapter: string, targetVersion: string
): boolean {
  const sourceMatrix = getStaticCompatibilityMatrix(sourceModule, sourceAdapter, sourceVersion);
  if (!sourceMatrix) return false;

  const targetModuleCompatRule = sourceMatrix.crossModuleCompatibility.find(
    cmc => cmc.moduleName === targetModule
  );

  if (!targetModuleCompatRule) return false;

  const targetAdapterInfo = registry.getAdapter(targetModule, targetAdapter, targetVersion);
  if (!targetAdapterInfo?.capabilities) return false;

  const sourceAdapterInfo = registry.getAdapter(sourceModule, sourceAdapter, sourceVersion);
  const currentEnvironments = detectRuntimeEnvironment();

  // 1. Check if the source adapter can run in the current environment.
  if (sourceAdapterInfo?.environment && !sourceAdapterInfo.environment.supportedEnvironments.some(env => currentEnvironments.includes(env))) {
    return false;
  }

  // 2. Check if the target adapter can run in the current environment.
  if (targetAdapterInfo.environment && !targetAdapterInfo.environment.supportedEnvironments.some(env => currentEnvironments.includes(env))) {
    return false;
  }

  // ✅ CORE LOGIC: Check if the target adapter's capabilities include ALL required capabilities.
  return targetModuleCompatRule.requiresCapabilities.every((requiredCap: Capability) =>{
    return targetAdapterInfo.capabilities.includes(requiredCap)
  });
}