import { Wallet } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';

console.log('EVMWallet script loaded!');

document.addEventListener('DOMContentLoaded', () => {
  const outputDiv = document.getElementById('output');
  const walletStatusDiv = document.getElementById('wallet-status');
  const walletAddressDiv = document.getElementById('walletAddress');
  const networkDiv = document.getElementById('network');
  const signatureDiv = document.getElementById('signature');
  const transactionDiv = document.getElementById('transaction');
  const gasEstimateDiv = document.getElementById('gasEstimate');
  const gasPriceDiv = document.getElementById('gasPrice');
  const typedDataSignatureDiv = document.getElementById('typedDataSignature');
  
  const connectButton = document.getElementById('connectButton');
  const signMsgButton = document.getElementById('signMsgButton');
  const signTxButton = document.getElementById('signTxButton');
  const estimateGasButton = document.getElementById('estimateGasButton');
  const getGasPriceButton = document.getElementById('getGasPriceButton');
  const signTypedDataButton = document.getElementById('signTypedDataButton');
  
  let wallet;
  
  function log(message) {
    if (outputDiv) {
      outputDiv.innerHTML += `<div>${message}</div>`;
      console.log(message);
    }
  }
  
  function updateStatus(status, isSuccess = false) {
    if (walletStatusDiv) {
      walletStatusDiv.textContent = status;
      walletStatusDiv.className = isSuccess ? 'pass' : '';
    }
  }
  
  connectButton?.addEventListener('click', async () => {
    try {
      log('Initializing EVM wallet...');
      
      // Use a deterministic private key for tests
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

      // Create the wallet
      wallet = new Wallet('evmWallet', undefined, provider, privateKey);
      await wallet.initialize();
      
      log('EVM wallet initialized. Requesting accounts...');
      
      const accounts = await wallet.getAccounts();
      if (accounts && accounts.length > 0) {
        updateStatus('Connected', true);
        if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
        log(`Connected account: ${accounts[0]}`);
        
        // Get network info
        const network = await wallet.getNetwork();
        if (networkDiv) networkDiv.textContent = `Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`;
        
        // Enable action buttons
        signMsgButton.disabled = false;
        signTxButton.disabled = false;
        estimateGasButton.disabled = false;
        getGasPriceButton.disabled = false;
        signTypedDataButton.disabled = false;
      } else {
        updateStatus('Connection failed');
        log('No accounts returned');
      }
    } catch (error) {
      updateStatus('Error');
      log(`Error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  signMsgButton?.addEventListener('click', async () => {
    try {
      log('Signing message...');
      const message = 'Hello from EVMWallet Test Client';
      const signature = await wallet.signMessage(message);
      
      if (signatureDiv) signatureDiv.textContent = signature;
      log(`Signature: ${signature}`);
    } catch (error) {
      log(`Signing error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  signTxButton?.addEventListener('click', async () => {
    try {
      log('Signing transaction...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0001',
        data: '0x'
      };
      const signedTx = await wallet.signTransaction(tx);
      
      if (transactionDiv) transactionDiv.textContent = signedTx;
      log(`Signed Transaction: ${signedTx}`);
    } catch (error) {
      log(`Transaction signing error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  estimateGasButton?.addEventListener('click', async () => {
    try {
      log('Estimating gas...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0001',
        data: '0x'
      };
      const gasEstimate = await wallet.estimateGas(tx);
      
      if (gasEstimateDiv) gasEstimateDiv.textContent = gasEstimate;
      log(`Gas Estimate: ${gasEstimate}`);
    } catch (error) {
      log(`Gas estimation error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  getGasPriceButton?.addEventListener('click', async () => {
    try {
      log('Getting gas price...');
      const gasPrice = await wallet.getGasPrice();
      
      if (gasPriceDiv) gasPriceDiv.textContent = gasPrice;
      log(`Gas Price: ${gasPrice}`);
    } catch (error) {
      log(`Gas price error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  signTypedDataButton?.addEventListener('click', async () => {
    try {
      log('Signing typed data...');
      const typedData = {
        domain: {
          name: 'Test App',
          version: '1',
          chainId: 11155111, // Sepolia
          verifyingContract: '0x0000000000000000000000000000000000000000'
        },
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' }
          ]
        },
        value: {
          name: 'Test User',
          wallet: '0x0000000000000000000000000000000000000000'
        }
      };
      
      const signature = await wallet.signTypedData(typedData);
      
      if (typedDataSignatureDiv) typedDataSignatureDiv.textContent = signature;
      log(`Typed Data Signature: ${signature}`);
    } catch (error) {
      log(`Typed data signing error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  log('EVM wallet test page loaded');
});