import { liFiCompatibilityMatrix,  liFiAdapterMetadata} from './LI.FI.registration.js'

// This file acts as a public manifest of all adapters in this package.
export const crosschainAdapters = {
  lifi: {
    meta: liFiAdapterMetadata,
    matrix: liFiCompatibilityMatrix
  }
};