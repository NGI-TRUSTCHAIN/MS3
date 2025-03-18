// import { createWallet, IWalletOptions } from '@m3s/wallet';
// import { EVMWallet } from '@m3s/wallet/types/interfaces/EVM/index.js';

// // When the page loads, set up the test fixtures
// document.addEventListener('DOMContentLoaded', () => {
//   const outputDiv = document.getElementById('output');
//   const walletStatusDiv = document.getElementById('wallet-status');
//   const walletAddressDiv = document.getElementById('walletAddress');
//   const signatureDiv = document.getElementById('signature');
//   const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
//   const signButton = document.getElementById('signButton') as HTMLButtonElement;
//   const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
  
//   let wallet: any;
  
//   function log(message: string) {
//     if (outputDiv) {
//       outputDiv.innerHTML += `<div>${message}</div>`;
//       console.log(message);
//     }
//   }
  
//   function updateStatus(status: string, isSuccess = false) {
//     if (walletStatusDiv) {
//       walletStatusDiv.textContent = status;
//       walletStatusDiv.className = `test-status ${isSuccess ? 'pass' : ''}`;
//     }
//   }
  
//   // Initialize Web3Auth wallet when login button is clicked
//   loginButton?.addEventListener('click', async () => {
//     try {
//       log('Initializing Web3Auth wallet...');
      
//       // Configure Web3Auth
//       const web3authConfig = {
//         clientId: "BCUGgXUJQX2T90W4YBqJQpvLsjKzNv-fmFzbqdMq5zW7EOsCikCvOrrIIUmbHwFGw8rNp5Cgmc5KQ2cafWVT2tk",
//         web3AuthNetwork: "sapphire_devnet", 
//         chainConfig: {
//           chainNamespace: "eip155",
//           chainId: "0xaa36a7", // Sepolia
//           rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
//           displayName: "Sepolia Testnet",
//           blockExplorer: "https://sepolia.etherscan.io/",
//           ticker: "ETH",
//           tickerName: "Ethereum"
//         },
//         loginConfig: {
//           loginProvider: "google"
//         }
//       };
      
//       // Create the wallet
//             const params: IWalletOptions = {
//               adapterName: 'web3auth',
//               neededFeature: undefined,
//               provider: null,
//               options: { web3authConfig }
//             }
            
//       wallet = createWallet<EVMWallet>(params);
      
//       await wallet.initialize();
      
//       log('Web3Auth initialized. Requesting accounts...');
      
//       // Request accounts (this will trigger the Web3Auth login popup)
//       const accounts = await wallet.requestAccounts();
      
//       if (accounts && accounts.length > 0) {
//         updateStatus('Connected', true);
//         if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
//         log(`Connected account: ${accounts[0]}`);
        
//         // Enable buttons
//         if (signButton) signButton.disabled = false;
//         if (disconnectButton) disconnectButton.disabled = false;
//       } else {
//         updateStatus('Connection failed');
//         log('No accounts returned');
//       }
//     } catch (error:any) {
//       updateStatus('Error');
//       log(`Error: ${error.message || error}`);
//       console.error(error);
//     }
//   });
  
//   // Sign a message when sign button is clicked
//   signButton?.addEventListener('click', async () => {
//     try {
//       if (!wallet) {
//         log('Wallet not connected');
//         return;
//       }
      
//       log('Signing message...');
//       const message = 'Hello from Web3Auth Integration Test';
//       const signature = await wallet.signMessage(message);
      
//       if (signatureDiv) signatureDiv.textContent = signature;
//       log(`Signature: ${signature}`);
//     } catch (error:any) {
//       log(`Signing error: ${error.message || error}`);
//       console.error(error);
//     }
//   });
  
//   // Disconnect when disconnect button is clicked
//   disconnectButton?.addEventListener('click', async () => {
//     try {
//       if (!wallet) {
//         log('Wallet not connected');
//         return;
//       }
      
//       log('Disconnecting...');
//       await wallet.disconnect();
      
//       updateStatus('Disconnected');
//       if (walletAddressDiv) walletAddressDiv.textContent = '';
//       if (signatureDiv) signatureDiv.textContent = '';
      
//       // Disable buttons
//       if (signButton) signButton.disabled = true;
//       if (disconnectButton) disconnectButton.disabled = true;
      
//       log('Wallet disconnected');
//     } catch (error:any) {
//       log(`Disconnect error: ${error.message || error}`);
//       console.error(error);
//     }
//   });
  
//   log('Web3Auth test page loaded');
// });