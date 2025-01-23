import { VersionRepository } from "../persistance/versionRepository";
import { MockedWalletAdapter } from "../../adapters/wallet";

export class WalletAdapterFactory {
  private versionRepo: VersionRepository;
  public instance: any;

  constructor(args: any) {
    this.versionRepo = new VersionRepository(false); // or true for DB
    if (!this.versionRepo.isCompatible('wallet', args.adapterName)) {
      throw new Error(`Incompatible adapter version: ${args.adapterName}`);
    }
    this.instance = this.initAdapter(args);
  }

  initAdapter(args: any) {
    // Return real or mock wallet adapter
    return new MockedWalletAdapter();
  }
}