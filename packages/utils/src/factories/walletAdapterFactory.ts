import { VersionRepository } from "../persistence/versionRepository";
import { MockedWalletAdapter } from "../adapters";

export class WalletAdapterFactory {
  private versionRepo: VersionRepository;
  public instance: any;

  constructor(args: any) {
    this.versionRepo = new VersionRepository();
    console.log("Creating adapter instance...");
    const adapter = this.initAdapter(args);
    console.log("Adapter methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)));
    this.instance = adapter;
  }

  initAdapter(args: any) {
    switch (args.adapterName) {
      case "mockedAdapter":
        const instance = new MockedWalletAdapter();
        console.log("Created MockedWalletAdapter:", instance);
        return instance;
      default:
        throw new Error(`Unknown adapter: ${args.adapterName}`);
    }
  }
}