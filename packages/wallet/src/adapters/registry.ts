// adapters/registry.ts

import { WalletType } from "../types/enums";

// Type definitions for adapter metadata.
export interface AdapterMetadata {
  name: string;
  adapterType: WalletType;  // Explicit adapter type
  adapterClass: any;
  requirements?: string[];
}

// Registry singleton: Esto funciona como un inyector de dependencias.
// Se encarga de registrar los metadatos de los adapters y de proveer
// información sobre los mismos de forma dinámica (para que no haya que actualizarlo)
class AdapterRegistry {
  private adapters: Map<string, AdapterMetadata> = new Map();
  
  register(metadata: AdapterMetadata): void {
    this.adapters.set(metadata.name, metadata);
  }
  
  getAdapter(name: string): AdapterMetadata | undefined {
    return this.adapters.get(name);
  }
  
  getAllAdapters(): AdapterMetadata[] {
    return Array.from(this.adapters.values());
  }
}

export const adapterRegistry = new AdapterRegistry();