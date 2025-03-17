import { MockedWalletAdapter, EvmWalletAdapter } from "../adapters";
import { Web3AuthWalletAdapter } from "../adapters/web3authWallet";


export class WalletAdapterFactory {
  public instance: any;

  constructor(args: any) {
    const adapter = this.initAdapter(args);
    this.instance = adapter;
  }

  initAdapter(args: any): any {
    if (args.adapterName === "mockedAdapter") {
      return new MockedWalletAdapter(args.privateKey);
    } else if (args.adapterName === "evmWallet") {
      return new EvmWalletAdapter(args.privateKey);
    } else if (args.adapterName === "web3auth") {
      if (!args.web3authConfig) {
        throw new Error("web3authConfig is required for web3auth adapter");
      }
      return new Web3AuthWalletAdapter(args.web3authConfig);
    }
    throw new Error(`Unknown adapter: ${args.adapterName}`);
  }
}