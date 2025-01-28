import { VersionRepository } from "../persistence/versionRepository";
import { MockedWalletAdapter } from "../adapters";

export class WalletAdapterFactory {
  private versionRepo: VersionRepository;
  public instance: any;

  constructor(args: any) {
    this.versionRepo = new VersionRepository();
    
    // Debug adapter creation
    console.log("1. Creating adapter instance...");
    const adapter = this.initAdapter(args);
    
    // Debug adapter methods
    console.log("2. Adapter constructor:", adapter.constructor.name);
    console.log("3. Adapter prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)));
    console.log("4. Adapter own methods:", Object.getOwnPropertyNames(adapter));

    this.instance = adapter;
  }

  initAdapter(args: any): MockedWalletAdapter {
    if (args.adapterName === "mockedAdapter") {
      const instance = new MockedWalletAdapter();
      return instance;
    }
    throw new Error(`Unknown adapter: ${args.adapterName}`);
  }
}