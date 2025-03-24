import { WalletType } from "../types/index.js";
export interface AdapterMetadata {
    name: string;
    adapterType: WalletType;
    adapterClass: any;
    requirements?: string[];
}
declare class AdapterRegistry {
    private adapters;
    register(metadata: AdapterMetadata): void;
    getAdapter(name: string): AdapterMetadata | undefined;
    getAllAdapters(): AdapterMetadata[];
}
export declare const adapterRegistry: AdapterRegistry;
export {};
