export class SmartContractAdapterFactory {
    instance: any;

    constructor(args:any) {
        // Initialize the adapter.
        this.instance = this.initAdapter(args);
    }
    
    initAdapter(args:any) {
      // Return SmartContractAdapter or instance of MockWalletAdapter
      return {};
    }
  }