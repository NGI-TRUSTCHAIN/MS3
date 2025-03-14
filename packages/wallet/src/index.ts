import { BaseWallet } from "./wallet.core";
import { EvmWallet } from "./wallet.evm";
import { Web3AuthWallet } from "./wallet.web3auth";

export * from "./types/interfaces";
export { BaseWallet, EvmWallet, Web3AuthWallet };

// Define a union type for all possible wallet types
export type WalletInstance = BaseWallet | EvmWallet | Web3AuthWallet;

// Factory function instead of a class constructor
export function createWallet(
  adapterName: string,
  neededFeature?: string,
  provider?: any,
  options?: any
): WalletInstance {
  if (adapterName === "evmWallet") {
    return new EvmWallet(adapterName, neededFeature, provider, options);
  } else if (adapterName === "web3auth") {
    return new Web3AuthWallet(adapterName, neededFeature, provider, options);
  } else {
    return new BaseWallet(adapterName, neededFeature, provider, options);
  }
}

// Backward compatibility: Keep the Wallet class but with proper typing
// export class Wallet {
//   static create(
//     adapterName: string,
//     neededFeature?: string,
//     provider?: any,
//     options?: any
//   ): WalletInstance {
//     return createWallet(adapterName, neededFeature, provider, options);
//   }
  
//   // Constructor that makes TypeScript happy
//   constructor(
//     adapterName: string,
//     neededFeature?: string,
//     provider?: any,
//     options?: any
//   ) {
//     // This is a workaround for TypeScript's constructor limitations
//     // It won't actually return, but we'll use the static method in practice
//     return createWallet(adapterName, neededFeature, provider, options) as any;
//   }
// }