import { VersionRepository } from "../persistence/versionRepository";
import { MockedWalletAdapter } from "../adapters";

export class WalletAdapterFactory {
  private versionRepo: VersionRepository;
  public instance: any;

  constructor(args: any) {
    this.versionRepo = new VersionRepository(); // or true for DB

    this.instance = this.initAdapter(args);
  }

  initAdapter(args: any) {
    switch (args.adapterName) {
      case "mockedAdapter":
        return new MockedWalletAdapter();
      default:
        throw new Error(`Unknown adapter: ${args.adapterName}`);
    }
  }
}