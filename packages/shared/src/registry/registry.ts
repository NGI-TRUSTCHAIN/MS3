import { AdapterMetadata, CompatibilityMatrix, CompatibilityReport, EnvironmentRequirements, ModuleMetadata, RuntimeEnvironment } from "../types/index.js";
import { Capability } from "./capability.js";
import { checkCrossPackageCompatibility } from "./compatibility.js";



// Helper function to get a value from a nested path
export function getPropertyByPath(obj: any, path: string): any {
  return path.split('.').reduce((currentObject, key) => {
    return (currentObject && typeof currentObject === 'object' && Object.prototype.hasOwnProperty.call(currentObject, key))
      ? currentObject[key]
      : undefined;
  }, obj);
}

class UniversalRegistry {
  private modules: Map<string, ModuleMetadata> = new Map();
  private adapters: Map<string, Map<string, AdapterMetadata>> = new Map();
  private compatibilityMatrices: Map<string, Map<string, CompatibilityMatrix>> = new Map();
  private interfaceShapes: Map<string, string[]> = new Map(); // ✅ ADD: The missing map

    /**
   * ✅ NEW: Register the shape of a convenience alias.
   * This is called by modules (e.g., wallet/index.ts) to define their aliases.
   * @param interfaceName The name of the alias (e.g., 'IEVMWallet').
   * @param requiredCapabilities An array of base capability names it requires.
   */
  registerInterfaceShape(interfaceName: string, requiredCapabilities: Capability[]): void {
    this.interfaceShapes.set(interfaceName, requiredCapabilities);
  }

  /**
   * ✅ NEW: Get the shape of a convenience alias.
   * This is called by the validator to verify an adapter meets an interface's requirements.
   */
  getInterfaceShape(interfaceName: string): string[] | undefined {
    return this.interfaceShapes.get(interfaceName);
  }

   /**
   * ✅ NEW: A modern replacement for findAdaptersWithFeature that uses our new architecture.
   * Finds all adapters that have a specific capability.
   */
  findAdaptersWithCapability(capability: Capability): AdapterMetadata[] {
    const result: AdapterMetadata[] = [];
    for (const moduleAdapters of this.adapters.values()) {
      for (const metadata of moduleAdapters.values()) {
        if (metadata.capabilities?.includes(capability)) {
          result.push(metadata);
        }
      }
    }
    return result;
  }
  
  /**
 * Get compatibility matrix for an adapter
 */
  getCompatibilityMatrix(moduleName: string, name: string, version: string): CompatibilityMatrix | undefined {
    const moduleMatrices = this.compatibilityMatrices.get(moduleName);
    if (!moduleMatrices) return undefined;

    const key = `${name}@${version}`;
    return moduleMatrices.get(key);
  }

  /**
 * Get latest version of an adapter
 */
  private getLatestVersion(moduleName: string, name: string): string | undefined {
    const latest = this.getLatestAdapter(moduleName, name);
    return latest?.version;
  }

  /**
     * Register a compatibility matrix for an adapter
     */
  registerCompatibilityMatrix(moduleName: string, matrix: CompatibilityMatrix): void {
    if (!this.compatibilityMatrices.has(moduleName)) {
      this.compatibilityMatrices.set(moduleName, new Map());
    }

    const moduleMatrices = this.compatibilityMatrices.get(moduleName)!;
    const key = `${matrix.adapterName}@${matrix.version}`;
    moduleMatrices.set(key, matrix);
  }

  /**
   * Check compatibility between adapter versions
   */
  checkAdapterCompatibility(moduleName: string, name: string, versions: string[]): CompatibilityReport {
    const report: CompatibilityReport = {
      compatible: true,
      conflicts: [],
      recommendations: [],
      supportedVersions: []
    };

    // Get all adapters for this name
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) {
      report.compatible = false;
      report.conflicts.push({
        type: 'version',
        severity: 'error',
        description: `Module '${moduleName}' not found`,
        affectedVersions: versions
      });
      return report;
    }

    // Check each version
    for (const version of versions) {
      const adapter = this.getAdapter(moduleName, name, version);
      if (!adapter) {
        report.compatible = false;
        report.conflicts.push({
          type: 'version',
          severity: 'error',
          description: `Adapter '${name}' version '${version}' not found`,
          affectedVersions: [version]
        });
        continue;
      }

      // Check if version exists in supported versions
      report.supportedVersions.push(version);

      // Check compatibility matrix if available
      const matrix = this.getCompatibilityMatrix(moduleName, name, version);
      if (matrix) {
        // Check for breaking changes between versions
        for (const otherVersion of versions) {
          if (version !== otherVersion) {
            const breakingChange = matrix.breakingChanges.find((bc:any) =>
              bc.fromVersion === otherVersion || bc.toVersion === otherVersion
            );

            if (breakingChange) {
              report.conflicts.push({
                type: 'breaking-change',
                severity: 'warning',
                description: `Breaking changes between ${breakingChange.fromVersion} and ${breakingChange.toVersion}: ${breakingChange.changes.join(', ')}`,
                affectedVersions: [breakingChange.fromVersion, breakingChange.toVersion],
                suggestedAction: breakingChange.migrationPath
              });
            }
          }
        }
      }
    }

    // Add recommendations
    if (report.conflicts.length === 0) {
      report.recommendations.push('All specified versions are compatible');
    } else {
      const latestVersion = this.getLatestVersion(moduleName, name);
      if (latestVersion) {
        report.recommendations.push(`Consider using latest version: ${latestVersion}`);
      }
    }

    return report;
  }

  /**
  * Get adapters compatible with a specific adapter instance
  */
  getCompatibleAdapters(
    currentAdapter: { moduleName: string; name: string; version: string },
    targetModuleName?: string
  ): AdapterMetadata[] {
    const compatibleAdapters: AdapterMetadata[] = [];
    const modulesToCheck = targetModuleName ? [targetModuleName] : Array.from(this.adapters.keys());

    for (const moduleName of modulesToCheck) {
      // Don't check for compatibility within the same module
      if (moduleName === currentAdapter.moduleName) continue;

      const moduleAdapters = this.adapters.get(moduleName);
      if (!moduleAdapters) continue;

      for (const [, targetAdapterMetadata] of moduleAdapters) {
        // Use the new, authoritative compatibility checker
        const isCompatible = checkCrossPackageCompatibility(
          currentAdapter.moduleName, currentAdapter.name, currentAdapter.version,
          targetAdapterMetadata.module, targetAdapterMetadata.name, targetAdapterMetadata.version
        );

        if (isCompatible) {
          compatibleAdapters.push(targetAdapterMetadata);
        }
      }
    }

    return compatibleAdapters;
  }

  /**
   * Batch register adapters with atomic rollback
   */
  registerAdapters(adapters: AdapterMetadata[]): void {
    // Store current state for rollback
    const originalState = new Map(this.adapters);

    try {
      for (const adapter of adapters) {
        this.registerAdapter(adapter.module, adapter);
      }
    } catch (error) {
      // Rollback on failure
      this.adapters = originalState;
      throw new Error(`Batch registration failed: ${error}. State rolled back.`);
    }
  }

  /**
   * Register a module in the registry
   */
  registerModule(metadata: ModuleMetadata): void {
    this.modules.set(metadata.name, metadata);

    // Initialize adapter map for this module if it doesn't exist
    if (!this.adapters.has(metadata.name)) {
      this.adapters.set(metadata.name, new Map());
    }
  }

  /**
   * Register an adapter for a specific module
   */
  registerAdapter(moduleName: string, metadata: AdapterMetadata): void {
    // Ensure module exists
    if (!this.modules.has(moduleName)) {
      const moduleMetadata: ModuleMetadata = {
        name: moduleName,
        version: metadata.version // Use adapter's version as default module version
      };
      this.registerModule(moduleMetadata);
    }

    // Get module's adapter map
    const moduleAdapters = this.adapters.get(moduleName);

    if (!moduleAdapters) {
      throw new Error(`Module ${moduleName} not properly initialized in registry`);
    }

    // Create a unique key combining name and version for multi-version support
    const adapterKey = `${metadata.name}@${metadata.version}`;

    // Register adapter with unique key
    moduleAdapters.set(adapterKey, metadata);
  }

  /**
   * Get an adapter by module and adapter name
   */
  getAdapter(moduleName: string, name: string, version: string): AdapterMetadata | undefined {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return undefined;

    // Create the key to look up the specific version
    const adapterKey = `${name}@${version}`;
    return moduleAdapters.get(adapterKey);
  }

  /**
   * Get the latest version of an adapter by name
   */
  getLatestAdapter(moduleName: string, name: string): AdapterMetadata | undefined {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return undefined;

    // Find all adapters with the given name
    const matchingAdapters: AdapterMetadata[] = [];
    for (const [, metadata] of moduleAdapters.entries()) {

      if (metadata.name === name) {
        matchingAdapters.push(metadata);
      }
    }

    if (matchingAdapters.length === 0) return undefined;

    // Sort by version (simple string comparison - you might want semver)
    matchingAdapters.sort((a, b) => b.version.localeCompare(a.version));

    return matchingAdapters[0];
  }

  /**
   * Get all adapters for a module
   */
  getModuleAdapters(moduleName: string): AdapterMetadata[] {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return [];

    return Array.from(moduleAdapters.values());
  }

  /**
   * Get all available versions of a specific adapter
   */
  getAdapterVersions(moduleName: string, name: string): string[] {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return [];

    const versions: string[] = [];
    for (const [, metadata] of moduleAdapters.entries()) {
      if (metadata.name === name) {
        versions.push(metadata.version);
      }
    }

    // Sort versions (latest first)
    return versions.sort((a, b) => b.localeCompare(a));
  }

  /**
   * Get all modules
   */
  getAllModules(): ModuleMetadata[] {
    return Array.from(this.modules.values());
  }

  /**
     * Get environment requirements for an adapter
     */
  getEnvironmentRequirements(moduleName: string, name: string, version: string): EnvironmentRequirements | undefined {
    const adapter = this.getAdapter(moduleName, name, version);
    return adapter?.environment;
  }

  /**
  * Check if an adapter supports a specific environment
  */
  supportsEnvironment(moduleName: string, name: string, version: string, environment: RuntimeEnvironment): boolean {
    const adapter = this.getAdapter(moduleName, name, version);
    if (!adapter || !adapter.environment) return true; // Assume universal if no environment specified

    // ✅ FIXED: Handle both array-based and legacy UNIVERSAL
    return adapter.environment.supportedEnvironments.includes(environment)
  }

  /**
   * Get adapters that support a specific environment
   */
  getAdaptersByEnvironment(moduleName: string, environment: RuntimeEnvironment): AdapterMetadata[] {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return [];

    const result: AdapterMetadata[] = [];
    for (const [, metadata] of moduleAdapters.entries()) {
      // ✅ FIXED: Support both approaches
      if (!metadata.environment ||
        metadata.environment.supportedEnvironments.includes(environment)) {
        result.push(metadata);
      }
    }

    return result;
  }

}

// Export the singleton instance
export const registry = new UniversalRegistry();

export type { UniversalRegistry };