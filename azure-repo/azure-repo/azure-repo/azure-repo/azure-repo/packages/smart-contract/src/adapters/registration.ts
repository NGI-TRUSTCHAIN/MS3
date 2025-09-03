import { openZeppelinCompatibilityMatrix,  openZeppelinAdapterMetadata} from './openZeppelin/openZeppelin.registration.js'

// This file acts as a public manifest of all adapters in this package.
export const smartContractAdapters = {
  web3auth: {
    meta: openZeppelinAdapterMetadata,
    matrix: openZeppelinCompatibilityMatrix
  }
};