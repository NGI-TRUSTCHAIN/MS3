import { Requirement, EnvironmentRequirements, RuntimeEnvironment, registry, WalletType } from "@m3s/wallet";
import { Web3AuthWalletAdapter } from "./web3auth.adapter";

const web3authRequirements: Requirement[] = [
  {
    path: 'options.web3authConfig',
    type: 'object',
    message: 'Web3AuthWalletAdapter requires the options.web3authConfig object.'
  },
  {
    path: 'options.web3authConfig.clientId',
    type: 'string',
    message: 'options.web3authConfig.clientId is required and must be a string.'
  },
  {
    path: 'options.web3authConfig.web3AuthNetwork',
    type: 'string',
    message: 'options.web3authConfig.web3AuthNetwork is required (e.g., "sapphire_devnet").'
  },
  {
    path: 'options.web3authConfig.chainConfig',
    type: 'object',
    message: 'options.web3authConfig.chainConfig object is required.'
  },
  {
    path: 'options.web3authConfig.chainConfig.chainId',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.chainId is required (hexadecimal string).'
  },
  {
    path: 'options.web3authConfig.chainConfig.rpcTarget',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.rpcTarget (RPC URL) is required.'
  },
  {
    path: 'options.web3authConfig.chainConfig.displayName',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.displayName is required.'
  },
  {
    path: 'options.web3authConfig.chainConfig.blockExplorerUrl',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.blockExplorerUrl URL is required.'
  },
  {
    path: 'options.web3authConfig.chainConfig.ticker',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.ticker (e.g., "ETH") is required.'
  },
  {
    path: 'options.web3authConfig.chainConfig.tickerName',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.tickerName (e.g., "Ethereum") is required.'
  },
  {
    path: 'options.web3authConfig.loginConfig',
    type: 'object',
    message: 'options.web3authConfig.loginConfig object is required.'
  }
];

const web3authEnvironment: EnvironmentRequirements = {
  supportedEnvironments: [RuntimeEnvironment.BROWSER],
  limitations: [
    'OAuth authentication flows require browser environment with window and document objects.',
    'Cannot be used in Node.js server environments.'
  ]
};

registry.registerAdapter('wallet', {
  name: 'web3auth',
  version: '1.0.0',
  module: 'wallet',
  adapterType: WalletType.web3auth,
  adapterClass: Web3AuthWalletAdapter,
  requirements: web3authRequirements,
  environment: web3authEnvironment,
});