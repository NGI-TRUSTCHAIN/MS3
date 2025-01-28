import { WalletAdapterFactory } from "./walletAdapterFactory";
import { SmartContractAdapterFactory } from "./smartContractAdapterFactory";
import { CrossChainAdapterFactory } from "./crossChainAdapterFactory";

export function getAdapterFactory(moduleName: string, adapterName: string) {
  try {
    switch (moduleName) {
      case 'wallet':
        return new WalletAdapterFactory({adapterName});
      case 'smartContract':
        return new SmartContractAdapterFactory({adapterName});
      case 'crossChain':
        return new CrossChainAdapterFactory({adapterName});
      default:
        throw new Error(`Unknown module: ${moduleName} - ${adapterName}`);
    }
  } catch (error) {
    throw new Error(`Error creating adapter factory: ${error}`);
  }

}
