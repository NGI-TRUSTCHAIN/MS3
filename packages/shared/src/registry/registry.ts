import { AdapterMetadata, CompatibilityMatrix, EnvironmentRequirements, ModuleMetadata } from "../types/index.js";
import { Capability } from "./capability.js";
import semver from 'semver';

class UniversalRegistry {
  private modules: Map<string, ModuleMetadata> = new Map();
  private adapters: Map<string, Map<string, AdapterMetadata>> = new Map();
  private compatibilityMatrices: Map<string, Map<string, CompatibilityMatrix>> = new Map();
  private interfaceShapes: Map<string, Capability[]> = new Map();

  /**
 * Resets the registry to its initial empty state.
 * This is primarily used for testing purposes to ensure test isolation.
 */
  reset(): void {
    this.modules = new Map();
    this.adapters = new Map();
    this.compatibilityMatrices = new Map();
    this.interfaceShapes = new Map();
  }
  /**
 * Merges data from another registry instance into this one.
 * This is the key to enabling cross-package communication.
 * @param sourceRegistry The registry instance to import data from.
 */
  mergeRegistry(sourceRegistry: UniversalRegistry): void {
    // This is a controlled operation, so we can safely access the private members.
    const source = sourceRegistry as any;

    // Merge Modules from another Registry.
    source.modules.forEach((value: ModuleMetadata, key: string) => {
      if (!this.modules.has(key)) {
        this.modules.set(key, value);
      }
    });

    // Merge Adapters
    source.adapters.forEach((sourceModuleAdapters: Map<string, AdapterMetadata>, moduleName: string) => {
      if (!this.adapters.has(moduleName)) {
        this.adapters.set(moduleName, new Map());
      }
      const targetModuleAdapters = this.adapters.get(moduleName)!;
      sourceModuleAdapters.forEach((adapterMeta: AdapterMetadata, adapterKey: string) => {
        if (!targetModuleAdapters.has(adapterKey)) {
          targetModuleAdapters.set(adapterKey, adapterMeta);
        }
      });
    });

    // Merge Compatibility Matrices
    source.compatibilityMatrices.forEach((sourceModuleMatrices: Map<string, CompatibilityMatrix>, moduleName: string) => {
      if (!this.compatibilityMatrices.has(moduleName)) {
        this.compatibilityMatrices.set(moduleName, new Map());
      }
      const targetModuleMatrices = this.compatibilityMatrices.get(moduleName)!;
      sourceModuleMatrices.forEach((matrix: CompatibilityMatrix, key: string) => {
        if (!targetModuleMatrices.has(key)) {
          targetModuleMatrices.set(key, matrix);
        }
      });
    });
  }

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
  getInterfaceShape(interfaceName: string): Capability[] | undefined {
    return this.interfaceShapes.get(interfaceName);
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
 * Get compatibility matrix for an adapter
 */
  getCompatibilityMatrix(moduleName: string, name: string, version: string): CompatibilityMatrix | undefined {
    const moduleMatrices = this.compatibilityMatrices.get(moduleName);
    if (!moduleMatrices) return undefined;

    const key = `${name}@${version}`;
    return moduleMatrices.get(key);
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
    if (!this.modules.has(moduleName)) {
      this.registerModule({ name: moduleName, version: metadata.version });
    }
    const moduleAdapters = this.adapters.get(moduleName)!;
    const adapterKey = `${metadata.name}@${metadata.version}`;
    moduleAdapters.set(adapterKey, metadata);
  }

  /**
   * Get an adapter by module and adapter name
   */
  getAdapter(moduleName: string, name: string, version: string): AdapterMetadata | undefined {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return undefined;
    const adapterKey = `${name}@${version}`;
    return moduleAdapters.get(adapterKey);
  }

  getLatestAdapter(moduleName: string, name: string): AdapterMetadata | undefined {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return undefined;

    const matchingAdapters: AdapterMetadata[] = [];
    for (const metadata of moduleAdapters.values()) {
      if (metadata.name === name) {
        matchingAdapters.push(metadata);
      }
    }

    if (matchingAdapters.length === 0) return undefined;

    // Sort by version using semver, rsort sorts from newest to oldest.
    matchingAdapters.sort((a, b) => semver.rcompare(a.version, b.version));

    return matchingAdapters[0];
  }

  /**
 * Get all available versions of a specific adapter
 */
  getAdapterVersions(moduleName: string, name: string): string[] {
    const moduleAdapters = this.adapters.get(moduleName);
    if (!moduleAdapters) return [];

    const versions: string[] = [];
    // This loop is correct because .entries() returns [key, value] pairs.
    for (const [, metadata] of moduleAdapters.entries()) {
      if (metadata.name === name) {
        versions.push(metadata.version);
      }
    }
    // Sort versions from newest to oldest using semver.
    return versions.sort(semver.rcompare);
  }

  /**
   * Get all adapters for a module
   */
  getModuleAdapters(moduleName: string): AdapterMetadata[] {
    const moduleAdapters = this.adapters.get(moduleName);
    return moduleAdapters ? Array.from(moduleAdapters.values()) : [];
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

}

export { UniversalRegistry };