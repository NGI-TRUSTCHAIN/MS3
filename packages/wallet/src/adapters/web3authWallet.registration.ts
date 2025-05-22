import { registry, Requirement } from '@m3s/common';
import { Web3AuthWalletAdapter } from './web3authWallet.js';
import { WalletType } from '../types/index.js';

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
    path: 'options.web3authConfig.chainConfig.blockExplorer',
    type: 'string',
    message: 'options.web3authConfig.chainConfig.blockExplorer URL is required.'
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
  },
  {
    path: 'options.web3authConfig.loginConfig.loginProvider',
    type: 'string',
    message: 'options.web3authConfig.loginConfig.loginProvider (e.g., "google") is required.'
  }
  // Add other specific requirements as needed, e.g., for chainConfig.chainNamespace if always mandatory
];

registry.registerAdapter('wallet', {
  name: 'web3auth',
  module: 'wallet',
  adapterType: WalletType.web3auth,
  adapterClass: Web3AuthWalletAdapter,
  requirements: web3authRequirements,
});