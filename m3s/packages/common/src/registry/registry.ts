import { AdapterMetadata, CompatibilityConflict, CompatibilityMatrix, CompatibilityReport, EnvironmentRequirements, ModuleMetadata, RuntimeEnvironment } from "../types/index.js";

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
      const moduleAdapters = this.adapters.get(moduleName);
      if (!moduleAdapters) continue;

      // Get compatibility matrix for current adapter
      const matrix = this.getCompatibilityMatrix(
        currentAdapter.moduleName,
        currentAdapter.name,
        currentAdapter.version
      );

      for (const [, adapterMetadata] of moduleAdapters) {
        // Skip same adapter
        if (moduleName === currentAdapter.moduleName &&
          adapterMetadata.name === currentAdapter.name &&
          adapterMetadata.version === currentAdapter.version) {
          continue;
        }

        let isCompatible = true;

        // Check environment compatibility
        if (adapterMetadata.environment && matrix) {
          const currentAdapterMeta = this.getAdapter(currentAdapter.moduleName, currentAdapter.name, currentAdapter.version);
          if (currentAdapterMeta?.environment) {
            // Check if environments overlap
            const environmentOverlap = currentAdapterMeta.environment.supportedEnvironments.some(env =>
              adapterMetadata.environment!.supportedEnvironments.includes(env)
            );
            if (!environmentOverlap) {
              isCompatible = false;
            }
          }
        }

        // Check cross-module compatibility from matrix
        if (matrix && isCompatible) {
          const crossModuleCompat = matrix.crossModuleCompatibility.find(cmc =>
            cmc.moduleName === moduleName
          );

          if (crossModuleCompat) {
            const compatibleAdapter = crossModuleCompat.compatibleAdapters.find(ca =>
              ca.name === adapterMetadata.name && ca.versions.includes(adapterMetadata.version)
            );
            isCompatible = !!compatibleAdapter;
          }
        }

        if (isCompatible) {
          compatibleAdapters.push(adapterMetadata);
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
   * Check if an adapter supports a specific feature/method
   */
  supportsFeature(moduleName: string, name: string, version: string, featureName: string): boolean {
    const adapter = this.getAdapter(moduleName, name, version);
    if (!adapter) return false;

    // Check if the method exists on the adapter class prototype
    return typeof adapter.adapterClass.prototype[featureName] === 'function';
  }

  /**
    * Find adapters that support a specific feature across all modules
    */
  findAdaptersWithFeature(featureName: string): AdapterMetadata[] {
    const result: AdapterMetadata[] = [];

    // Check each module's adapters
    for (const [moduleName, moduleAdapters] of Array.from(this.adapters.entries())) {
      for (const [, metadata] of Array.from(moduleAdapters.entries())) {
        if (this.supportsFeature(moduleName, metadata.name, metadata.version, featureName)) {
          result.push(metadata);
        }
      }
    }

    return result;
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

  /**
   * ✅ NEW: Helper methods extracted from devtool.ts
   */
  private areEnvironmentsCompatible(adapter1: AdapterMetadata, adapter2: AdapterMetadata): boolean {
    if (!adapter1.environment || !adapter2.environment) return true;
    
    return adapter1.environment.supportedEnvironments.some(env =>
      adapter2.environment!.supportedEnvironments.includes(env)
    );
  }

  private areInterfacesCompatible(adapter1: AdapterMetadata, adapter2: AdapterMetadata): boolean {
    if (!adapter1.features || !adapter2.features) return true;
    
    const methods1 = adapter1.features.map(f => f.name);
    const methods2 = adapter2.features.map(f => f.name);
    
    const coreMethods = ['initialize', 'isInitialized'];
    return coreMethods.every(method => 
      methods1.includes(method) && methods2.includes(method)
    );
  }

  /**
   * ✅ NEW: Find all compatible adapters for a given adapter
   */
  findCompatibleAdapters(
    moduleName: string, 
    adapterName: string, 
    version: string
  ): { module: string; adapter: string; version: string; compatibility: number }[] {
    const sourceAdapter = this.getAdapter(moduleName, adapterName, version);
    if (!sourceAdapter) return [];

    const compatible: { module: string; adapter: string; version: string; compatibility: number }[] = [];
    
    // ✅ Check all modules except source module
    for (const module of this.getAllModules()) {
      if (module.name === moduleName) continue;
      
      const moduleAdapters = this.getModuleAdapters(module.name);
      for (const targetAdapter of moduleAdapters) {
        const report = this.getCompatibilityReport(
          moduleName, adapterName, version,
          module.name, targetAdapter.name, targetAdapter.version
        );
        
        if (report.compatible) {
          // ✅ Calculate compatibility score
          const envScore = this.areEnvironmentsCompatible(sourceAdapter, targetAdapter) ? 1 : 0;
          const interfaceScore = this.areInterfacesCompatible(sourceAdapter, targetAdapter) ? 1 : 0;
          const compatibility = (envScore + interfaceScore) / 2;
          
          compatible.push({
            module: module.name,
            adapter: targetAdapter.name,
            version: targetAdapter.version,
            compatibility
          });
        }
      }
    }

    return compatible.sort((a, b) => b.compatibility - a.compatibility);
  }
  
    /**
   * ✅ NEW: Get detailed compatibility report between adapters
   */
  getCompatibilityReport(
    module1: string, adapter1: string, version1: string,
    module2: string, adapter2: string, version2: string
  ): CompatibilityReport {
    const metadata1 = this.getAdapter(module1, adapter1, version1);
    const metadata2 = this.getAdapter(module2, adapter2, version2);
    
    if (!metadata1 || !metadata2) {
      return {
        compatible: false,
        conflicts: [{
          type: 'version',
          severity: 'error',
          description: 'One or both adapters not found',
          affectedVersions: [version1, version2]
        }],
        recommendations: ['Verify adapter names and versions'],
        supportedVersions: []
      };
    }

    const conflicts: CompatibilityConflict[] = [];
    let compatible = true;

    // ✅ Environment compatibility
    if (!this.areEnvironmentsCompatible(metadata1, metadata2)) {
      compatible = false;
      conflicts.push({
        type: 'environment',
        severity: 'error',
        description: `Environment incompatibility: ${adapter1} requires ${metadata1.environment?.supportedEnvironments.join(', ')}, ${adapter2} requires ${metadata2.environment?.supportedEnvironments.join(', ')}`,
        affectedVersions: [version1, version2],
        suggestedAction: `Use ${adapter1} in ${metadata1.environment?.supportedEnvironments.join('/')} environment, or ${adapter2} in ${metadata2.environment?.supportedEnvironments.join('/')} environment`
      });
    }

    // ✅ Interface compatibility
    if (!this.areInterfacesCompatible(metadata1, metadata2)) {
      compatible = false;
      conflicts.push({
        type: 'feature',
        severity: 'error',
        description: `Interface incompatibility: Core methods missing or incompatible`,
        affectedVersions: [version1, version2],
        suggestedAction: 'Verify both adapters implement required interface methods'
      });
    }

    // ✅ Build recommendations
    const recommendations: string[] = [];
    if (compatible) {
      recommendations.push(`✅ ${adapter1}@${version1} and ${adapter2}@${version2} are compatible`);
      if (metadata1.environment && metadata2.environment) {
        const commonEnvs = metadata1.environment.supportedEnvironments.filter(env =>
          metadata2.environment!.supportedEnvironments.includes(env)
        );
        recommendations.push(`💡 Use in ${commonEnvs.join(' or ')} environment${commonEnvs.length > 1 ? 's' : ''}`);
      }
    } else {
      recommendations.push(`❌ ${adapter1}@${version1} and ${adapter2}@${version2} are not compatible`);
      
      if (conflicts.some(c => c.type === 'environment')) {
        // ✅ Suggest environment-compatible alternatives
        const allAdapters = this.getModuleAdapters(module1);
        for (const alt of allAdapters) {
          if (alt.name !== adapter1 && metadata2.environment && 
              alt.environment?.supportedEnvironments.some(env => 
                metadata2.environment!.supportedEnvironments.includes(env))) {
            recommendations.push(`💡 Try ${alt.name}@${alt.version} instead of ${adapter1} for ${metadata2.environment.supportedEnvironments.join('/')} compatibility`);
          }
        }
      }
    }

    return {
      compatible,
      conflicts,
      recommendations,
      supportedVersions: compatible ? [version1, version2] : []
    };
  }
}

// Export the singleton instance
export const registry = new UniversalRegistry();

export type { UniversalRegistry };