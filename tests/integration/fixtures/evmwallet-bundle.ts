import { createWallet, IEVMWallet, IWalletOptions } from '@m3s/wallet';

import { JsonRpcProvider } from 'ethers';

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
  const tokenBalanceDiv = document.getElementById('tokenBalance');
  const transactionReceiptDiv = document.getElementById('transactionReceipt');
  const verifySignatureDiv = document.getElementById('verifySignature');

  const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
  const signMsgButton = document.getElementById('signMsgButton') as HTMLButtonElement;
  const signTxButton = document.getElementById('signTxButton') as HTMLButtonElement;
  const estimateGasButton = document.getElementById('estimateGasButton') as HTMLButtonElement;
  const getGasPriceButton = document.getElementById('getGasPriceButton') as HTMLButtonElement;
  const signTypedDataButton = document.getElementById('signTypedDataButton') as HTMLButtonElement;
  const getTokenBalanceButton = document.getElementById('getTokenBalanceButton') as HTMLButtonElement;
  const getTransactionReceiptButton = document.getElementById('getTransactionReceiptButton') as HTMLButtonElement;

  // Add new UI elements for the additional tests
  const walletNameDiv = document.getElementById('walletName');
  const walletVersionDiv = document.getElementById('walletVersion');
  const isInitializedDiv = document.getElementById('isInitialized');
  const isConnectedDiv = document.getElementById('isConnected');
  const privateKeyDiv = document.getElementById('privateKey');
  const eventLogDiv = document.getElementById('eventLog');
  const txHashDiv = document.getElementById('txHash');

  // Add new buttons
  const getWalletInfoButton = document.getElementById('getWalletInfoButton') as HTMLButtonElement;
  const getPrivateKeyButton = document.getElementById('getPrivateKeyButton') as HTMLButtonElement;
  const testEventsButton = document.getElementById('testEventsButton') as HTMLButtonElement;
  const sendTxButton = document.getElementById('sendTxButton') as HTMLButtonElement;
  const changeProviderButton = document.getElementById('changeProviderButton') as HTMLButtonElement;
  const verifySignatureButton = document.getElementById('verifySignatureButton') as HTMLButtonElement;
  
  let wallet: any;

  // Add handler for getting wallet info
  getWalletInfoButton?.addEventListener('click', async () => {
    try {
      log('Getting wallet info...');

      // Test isInitialized()
      const initialized = wallet.isInitialized();
      if (isInitializedDiv) isInitializedDiv.textContent = String(initialized);
      log(`Wallet initialized: ${initialized}`);

      // Test isConnected()
      const connected = wallet.isConnected();
      if (isConnectedDiv) isConnectedDiv.textContent = String(connected);
      log(`Wallet connected: ${connected}`);

      // Test getWalletName()
      const name = wallet.getWalletName();
      if (walletNameDiv) walletNameDiv.textContent = name;
      log(`Wallet name: ${name}`);

      // Test getWalletVersion()
      const version = wallet.getWalletVersion();
      if (walletVersionDiv) walletVersionDiv.textContent = version;
      log(`Wallet version: ${version}`);
    } catch (error: any) {
      log(`Error getting wallet info: ${error.message}`);
      console.error(error);
    }
  });

  // Add handler for getting private key
  getPrivateKeyButton?.addEventListener('click', async () => {
    try {
      log('Getting private key...');
      const privateKey = await wallet.getPrivateKey();

      // Only show the last few characters for security
      const redactedKey = privateKey.substring(0, 6) + '...' + privateKey.substring(privateKey.length - 4);
      if (privateKeyDiv) privateKeyDiv.textContent = redactedKey;
      log(`Private key retrieved (redacted): ${redactedKey}`);
    } catch (error: any) {
      log(`Error getting private key: ${error.message}`);
      console.error(error);
    }
  });

  // Add handler for testing events
  testEventsButton?.addEventListener('click', async () => {
    try {
      log('Testing event listeners...');

      // Clear event log
      if (eventLogDiv) eventLogDiv.textContent = '';

      // Set up event listeners
      const accountChangedHandler = (accounts: string[]) => {
        log(`Event: accountsChanged - ${accounts.join(', ')}`);
        if (eventLogDiv) eventLogDiv.textContent += `accountsChanged: ${accounts.join(', ')}\n`;
      };

      const chainChangedHandler = (chainId: string) => {
        log(`Event: chainChanged - ${chainId}`);
        if (eventLogDiv) eventLogDiv.textContent += `chainChanged: ${chainId}\n`;
      };

      // Register listeners
      wallet.on('accountsChanged', accountChangedHandler);
      wallet.on('chainChanged', chainChangedHandler);
      log('Event listeners registered');

      // Trigger accountsChanged by calling requestAccounts
      await wallet.requestAccounts();

      // Wait a bit then remove listeners
      setTimeout(() => {
        wallet.off('accountsChanged', accountChangedHandler);
        wallet.off('chainChanged', chainChangedHandler);
        log('Event listeners removed');
      }, 2000);
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
      console.error(error);
    }
  });

  // Add handler for sending a transaction
  sendTxButton?.addEventListener('click', async () => {
    try {
      log('Sending transaction...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0000001', // Very small amount
        data: '0x'
      };

      const txHash = await wallet.sendTransaction(tx);
      if (txHashDiv) txHashDiv.textContent = txHash;
      log(`Transaction sent with hash: ${txHash}`);
    } catch (error: any) {
      log(`Transaction error: ${error.message}`);
      console.error(error);
    }
  });

  changeProviderButton?.addEventListener('click', async () => {
    try {
      log('Changing provider to Holesky network...');
      const newProvider = new JsonRpcProvider("https://ethereum-holesky-rpc.publicnode.com");

      wallet.setProvider(newProvider);
      log('Provider changed. Getting new network info...');

      // Get and display new network info
      const network = await wallet.getNetwork();
      if (networkDiv) networkDiv.textContent = `Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`;
      log(`New network: Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`);
    } catch (error: any) {
      log(`Error changing provider: ${error.message}`);
      console.error(error);
    }
  });

  function log(message: string) {
    if (outputDiv) {
      outputDiv.innerHTML += `<div>${message}</div>`;
      console.log(message);
    }
  }

  function updateStatus(status: string, isSuccess = false) {
    if (walletStatusDiv) {
      walletStatusDiv.textContent = status;
      walletStatusDiv.className = isSuccess ? 'test-status pass' : 'test-status';
    }
  }

  connectButton?.addEventListener('click', async () => {
    try {
      log('Initializing EVM wallet...');

      // Use a deterministic private key for tests
      const TEST_PRIVATE_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123';

      // Use the new parameter structure with options object
      const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const params: IWalletOptions = {
        adapterName: "evmWallet",
        provider,
        options: {
          privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
        }
      };

      wallet = await createWallet<IEVMWallet>(params);
      log('EVM wallet initialized. Requesting accounts...');

      const accounts = await wallet.getAccounts();

      if (accounts && accounts.length > 0) {
        updateStatus('Connected', true);
        if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
        log(`Connected account: ${accounts[0]}`);

        // Get network info
        const network = await wallet.getNetwork();
        if (networkDiv) networkDiv.textContent = `Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`;

        // Enable all action buttons
        signMsgButton.disabled = false;
        signTxButton.disabled = false;
        estimateGasButton.disabled = false;
        getGasPriceButton.disabled = false;
        signTypedDataButton.disabled = false;

        // Enable new buttons
        if (getWalletInfoButton) getWalletInfoButton.disabled = false;
        if (getPrivateKeyButton) getPrivateKeyButton.disabled = false;
        if (testEventsButton) testEventsButton.disabled = false;
        if (sendTxButton) sendTxButton.disabled = false;
        if (changeProviderButton) changeProviderButton.disabled = false;
        if (getTokenBalanceButton) getTokenBalanceButton.disabled = false;
        if (getTransactionReceiptButton) getTransactionReceiptButton.disabled = false;
        if (getPrivateKeyButton) getPrivateKeyButton.disabled = false;
        if (verifySignatureButton) verifySignatureButton.disabled = false;
        if (testEventsButton) testEventsButton.disabled = false;
      } else {
        updateStatus('Connection failed');
        log('No accounts returned');
      }
    } catch (error: any) {
      updateStatus('Error');
      log(`Error: ${error.message || error}`);
      console.error(error);
    }
  });

  signMsgButton?.addEventListener('click', async () => {
    try {
      log('Signing message...');
      const message = 'Hello from IEVMWallet Integration Test';
      const signature = await wallet.signMessage(message);

      if (signatureDiv) signatureDiv.textContent = signature;
      log(`Signature: ${signature}`);
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      log(`Gas price error: ${error.message || error}`);
      console.error(error);
    }
  });

  signTypedDataButton?.addEventListener('click', async () => {
    try {
      log('Signing typed data...');

      // EIP-712 typed data example
      const typedData = {
        domain: {
          name: 'Test Domain',
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
    } catch (error: any) {
      log(`Typed data signing error: ${error.message || error}`);
      console.error(error);
    }
  });

  getTokenBalanceButton?.addEventListener('click', async () => {
    try {
      log('Getting token balance...');
      // Sample DAI token on Sepolia
      const tokenAddress = '0x68194a729C2450ad26072b3D33ADaCbcef39D574';
      
      const balance = await wallet.getTokenBalance(tokenAddress);
      
      if (tokenBalanceDiv) tokenBalanceDiv.textContent = balance;
      log(`Token Balance: ${balance}`);
    } catch (error: any) {
      log(`Token balance error: ${error.message || error}`);
      console.error(error);
    }
  });

  getTransactionReceiptButton?.addEventListener('click', async () => {
    try {
      log('Getting transaction receipt...');
      // First we need to send a transaction to get a receipt for
      if (!localStorage.getItem('lastTxHash')) {
        log('No transaction hash found. Sending a test transaction first...');
        const tx = {
          to: '0x0000000000000000000000000000000000000000',
          value: '0.0000001', // Very small amount
          data: '0x'
        };
        
        const txHash = await wallet.sendTransaction(tx);
        localStorage.setItem('lastTxHash', txHash);
        log(`Transaction sent with hash: ${txHash}`);
      }
      
      const txHash = localStorage.getItem('lastTxHash');
      log(`Getting receipt for transaction: ${txHash}`);
      
      const receipt = await wallet.getTransactionReceipt(txHash as string);
      
      if (transactionReceiptDiv) {
        transactionReceiptDiv.textContent = JSON.stringify(receipt, (key, value) => {
          // Convert BigInt to string for JSON serialization
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        }, 2);
      }
      log(`Transaction receipt received. Status: ${receipt ? receipt.status : 'pending'}`);
    } catch (error: any) {
      log(`Transaction receipt error: ${error.message || error}`);
      console.error(error);
    }
  });
  
  getPrivateKeyButton?.addEventListener('click', async () => {
    try {
      log('Getting private key...');
      const privateKey = await wallet.getPrivateKey();
      
      // Only show the last few characters for security
      const redactedKey = privateKey.substring(0, 6) + '...' + privateKey.substring(privateKey.length - 4);
      if (privateKeyDiv) privateKeyDiv.textContent = redactedKey;
      log(`Private key retrieved (redacted): ${redactedKey}`);
    } catch (error: any) {
      log(`Error getting private key: ${error.message}`);
      console.error(error);
    }
  });

  verifySignatureButton?.addEventListener('click', async () => {
    try {
      log('Verifying signature...');
      const message = 'Hello from IEVMWallet Integration Test';
      const signature = await wallet.signMessage(message);
      
      // Verify the signature
      const isValid = await wallet.verifySignature(message, signature);
      
      if (verifySignatureDiv) verifySignatureDiv.textContent = isValid ? 'Valid' : 'Invalid';
      log(`Signature verification: ${isValid ? 'Valid ✅' : 'Invalid ❌'}`);
    } catch (error: any) {
      log(`Signature verification error: ${error.message}`);
      console.error(error);
    }
  });

  testEventsButton?.addEventListener('click', async () => {
    try {
      log('Testing event listeners...');
      
      // Clear event log
      if (eventLogDiv) eventLogDiv.textContent = '';
      
      // Set up event listeners
      const accountChangedHandler = (accounts: string[]) => {
        log(`Event: accountsChanged - ${accounts.join(', ')}`);
        if (eventLogDiv) eventLogDiv.textContent += `accountsChanged: ${accounts.join(', ')}\n`;
      };
      
      const chainChangedHandler = (chainId: string) => {
        log(`Event: chainChanged - ${chainId}`);
        if (eventLogDiv) eventLogDiv.textContent += `chainChanged: ${chainId}\n`;
      };
      
      // Register listeners
      wallet.on('accountsChanged', accountChangedHandler);
      wallet.on('chainChanged', chainChangedHandler);
      log('Event listeners registered');
      
      // Trigger accountsChanged event by requesting accounts again
      await wallet.requestAccounts();
      log('Accounts requested to trigger event');
      
      // Wait a bit then remove listeners
      setTimeout(() => {
        wallet.off('accountsChanged', accountChangedHandler);
        wallet.off('chainChanged', chainChangedHandler);
        log('Event listeners removed after 2s');
      }, 2000);
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
      console.error(error);
    }
  });
  
  log('EVM wallet test page loaded');
});