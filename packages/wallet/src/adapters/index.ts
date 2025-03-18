// Export all adapters
export * from './mockedWallet';
export * from './etheresWallet';
export * from "./web3authWallet";

// Load all registrations
import './mockedWallet.registration';
import './ethersWallet.registration';
import './web3authWallet.registration';