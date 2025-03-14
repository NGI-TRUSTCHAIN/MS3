import { BaseWallet } from "./wallet.core";
import { EvmWallet } from "./wallet.evm";
import { Web3AuthWallet } from "./wallet.web3auth";

export * from "./types/interfaces";

export class Wallet {
  constructor(
    adapterName: string,
    neededFeature?: string,
    provider?: any,
    options?: any
  ) {
    if (adapterName === "evmWallet") {
      return new EvmWallet(adapterName, neededFeature, provider, options);
    } else if (adapterName === "web3auth") {
      return new Web3AuthWallet(adapterName, neededFeature, provider, options);
    } else {
      return new BaseWallet(adapterName, neededFeature, provider, options);
    }
  }
}