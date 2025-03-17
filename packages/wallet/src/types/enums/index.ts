// LOS METODOS DEL BASE WALLET
// TODO: Meter todos los metodos enumerados y organizar en carpetas.
export enum IRequiredMethods {
  GET_WALLET_NAME = "getWalletName",
  GET_WALLET_VERSION = "getWalletVersion",
  IS_CONNECTED = "isConnected",
  REQUEST_ACCOUNTS = "requestAccounts",
  GET_ACCOUNTS = "getAccounts",
  ON = "on",
  OFF = "off",
  GET_NETWORK = "getNetwork",
  SWITCH_NETWORK = "switchNetwork",
  SEND_TRANSACTION = "sendTransaction",
  SIGN_TRANSACTION = "signTransaction",
  SIGN_MESSAGE = "signMessage"
}

export enum IEVMRequiredMethods {
  SIGN_TYPED_DATA = "signTypedData",
  GET_GAS_PRICE = "getGasPrice",
  ESTIMATE_GAS = "estimateGas"
}

export enum WalletEvent {
  connect = 'connect',
  disconnect = 'disconnect',
  accountsChanged = 'accountsChanged',
  chainChanged = 'chainChanged'
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
