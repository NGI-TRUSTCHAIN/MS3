/**
 * Universal Adapter Registry for M3S Modules
 * Internal package - not published to NPM
 */

// Type definitions for module metadata
interface ModuleMetadata {
    name: string;
    version: string;
  }
  
  // Type definitions for adapter metadata
interface AdapterMetadata {
    name: string;
    module: string;
    adapterType: string;
    adapterClass: any;
    requirements?: string[];
  }
  
  // Universal Registry singleton
  class UniversalRegistry {
    private modules: Map<string, ModuleMetadata> = new Map();
    private adapters: Map<string, Map<string, AdapterMetadata>> = new Map();
    
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
          version: '1.0.0' // Default version
        };
        this.registerModule(moduleMetadata);
      }
      
      // Get module's adapter map
      const moduleAdapters = this.adapters.get(moduleName);
      
      if (!moduleAdapters) {
        throw new Error(`Module ${moduleName} not properly initialized in registry`);
      }
      
      // Register adapter
      moduleAdapters.set(metadata.name, metadata);
    }
    
    /**
     * Get an adapter by module and adapter name
     */
    getAdapter(moduleName: string, adapterName: string): AdapterMetadata | undefined {
      const moduleAdapters = this.adapters.get(moduleName);
      if (!moduleAdapters) return undefined;
      
      return moduleAdapters.get(adapterName);
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
     * Get all modules
     */
    getAllModules(): ModuleMetadata[] {
      return Array.from(this.modules.values());
    }
    
    /**
     * Check if an adapter supports a specific feature/method
     */
    supportsFeature(moduleName: string, adapterName: string, featureName: string): boolean {
      const adapter = this.getAdapter(moduleName, adapterName);
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
      for (const [moduleName, moduleAdapters] of this.adapters.entries()) {
        for (const [adapterName, metadata] of moduleAdapters.entries()) {
          if (this.supportsFeature(moduleName, adapterName, featureName)) {
            result.push(metadata);
          }
        }
      }
      
      return result;
    }
  }
  
  // Export the singleton instance
  // This is a bundled version of the registry
export const registry = new UniversalRegistry();