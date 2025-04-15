export enum WalletEvent {
  connect = 'connect',
  disconnect = 'disconnect',
  accountsChanged = 'accountsChanged',
  chainChanged = 'chainChanged',
  balanceChanged = 'balanceChanged'
};

export enum SignTypedDataVersion {
  V1 = 'V1',
  V3 = 'V3',
  V4 = 'V4'
};

export enum WalletType {
  'core' = 'core',
  'evm' = 'evm',
  'web3auth' = 'web3auth'
}
