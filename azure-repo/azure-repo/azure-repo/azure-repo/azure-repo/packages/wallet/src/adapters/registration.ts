import { ethersAdapterMetadata, ethersCompatibilityMatrix } from './ethers/ethersWallet.registration.js';
import { web3authAdapterMetadata, web3authCompatibilityMatrix } from './web3auth/web3authWallet.registration.js'

// This file acts as a public manifest of all adapters in this package.
export const walletAdapters = {
  ethers: {
    meta: ethersAdapterMetadata,
    matrix: ethersCompatibilityMatrix
  },
  web3auth: {
    meta: web3authAdapterMetadata,
    matrix: web3authCompatibilityMatrix
  }
};