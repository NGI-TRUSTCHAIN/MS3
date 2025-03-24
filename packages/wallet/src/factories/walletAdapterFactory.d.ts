import { IWalletOptions } from '../types/index.js';
export declare class WalletAdapterFactory {
    instance: any;
    private constructor();
    static create(args: IWalletOptions): Promise<WalletAdapterFactory>;
    initAdapter(args: any): Promise<any>;
}
