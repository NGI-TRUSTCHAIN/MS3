import { BaseWallet } from './wallet.core';
import { TransactionData } from './types/types';
import { EVMWallet } from './types/interfaces/EVM';

export class EvmWallet extends BaseWallet implements EVMWallet{
    constructor(adapterName: string, neededFeature?: string, provider?: any, options?: any) {
        // Pass options to the BaseWallet so it is used when initializing the adapter.
        super(adapterName, neededFeature, provider, options);
        // Validate that the adapter implements EVM-specific methods.
        if (typeof this.adapter.signTypedData !== 'function' ||
            typeof this.adapter.getGasPrice !== 'function' ||
            typeof this.adapter.estimateGas !== 'function') {
          throw new Error("Adapter does not support EVM extended methods");
        }
      }

      signTypedData(data: { domain: any; types: any; value: any }, version?: string): Promise<string> {
        return this.adapter.signTypedData(data, version);
      }
    
      getGasPrice(): Promise<string> {
        return this.adapter.getGasPrice();
      }
    
      estimateGas(tx: TransactionData): Promise<string> {
        return this.adapter.estimateGas(tx);
      }
}