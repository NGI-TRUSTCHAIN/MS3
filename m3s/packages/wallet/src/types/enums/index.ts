// ---- ENUMS ---- //
export enum WalletEvent {
  connect = 'connect',
  disconnect = 'disconnect',
  accountsChanged = 'accountsChanged',
  chainChanged = 'chainChanged',
  balanceChanged = 'balanceChanged',
  message = 'message',
  error = 'error'
};

export enum WalletType {
  'core' = 'core',
  'evm' = 'evm',
  'web3auth' = 'web3auth'
};
// ---- ENUMS --- //