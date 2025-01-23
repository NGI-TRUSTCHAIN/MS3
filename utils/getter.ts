import { CrossChainAdapterFactory } from "./factories/crossChainAdapterFactory";
import { SmartContractAdapterFactory } from "./factories/smartContractAdapterFactory";
import { WalletAdapterFactory } from "./factories/walletAdapterFactory";

export function getAdapterFactory(moduleName: string, adapterName: string) {
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
}