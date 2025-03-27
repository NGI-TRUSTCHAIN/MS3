// Export all adapters
export * from './mockedWallet.js';
export * from './ethersWallet.js';
export * from './web3authWallet.js';

// Load all registrations
import './mockedWallet.registration.js';
import './ethersWallet.registration.js';
import './web3authWallet.registration.js';