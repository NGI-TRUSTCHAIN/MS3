import { ICoreWallet, IWalletOptions } from './types/index.js';
export * from './types/index.js';
export * from './adapters/index.js';
export declare function createWallet<T extends ICoreWallet = ICoreWallet>(params: IWalletOptions): Promise<T>;
