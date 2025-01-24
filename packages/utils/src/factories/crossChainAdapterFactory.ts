export class CrossChainAdapterFactory {
    instance: any;

    constructor(args:any) {
        // Initialize the adapter.
        this.instance = this.initAdapter(args);
    }

    initAdapter(args:any) {
      // Return CrossChainAdapter or instance of MockWalletAdapter
      return {};
    }
  }