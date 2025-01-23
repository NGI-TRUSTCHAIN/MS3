import { getAdapterFactory } from '../../../utils/getter';

export class Wallet {
  private adapter: any;

  constructor(adapterName: string) {
    const walletFactory = getAdapterFactory('wallet', adapterName);
    this.adapter = walletFactory.instance;
  }

  getWallet() {
    return this.adapter.getWallet();
  }

  getAddress() {
    return this.adapter.getAddress();
  }

  getPrivateKey() {
    return this.adapter.getPrivateKey();
  }
}