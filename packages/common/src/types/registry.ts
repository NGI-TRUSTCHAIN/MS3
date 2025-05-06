export interface ModuleMetadata {
    name: string;
    version: string;
}

// Type definitions for adapter metadata
export interface AdapterMetadata {
    name: string;
    module: string;
    adapterType: string;
    adapterClass: any;
    requirements?: string[];
}
