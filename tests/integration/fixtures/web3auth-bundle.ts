import { createWallet, IWalletOptions, IEVMWallet, WalletEvent } from '@m3s/wallet';

// When the page loads, set up the test fixtures
document.addEventListener('DOMContentLoaded', () => {
  const outputDiv = document.getElementById('output');
  const walletStatusDiv = document.getElementById('wallet-status');
  const walletAddressDiv = document.getElementById('walletAddress');
  const signatureDiv = document.getElementById('signature');
  const tokenBalanceDiv = document.getElementById('tokenBalance');
  const transactionReceiptDiv = document.getElementById('transactionReceipt');
  const privateKeyDiv = document.getElementById('privateKey');
  const verifySignatureDiv = document.getElementById('verifySignature');
  const eventLogDiv = document.getElementById('eventLog');
  const walletNameDiv = document.getElementById('walletName');
  const walletVersionDiv = document.getElementById('walletVersion');
  const isInitializedDiv = document.getElementById('isInitialized');
  const isConnectedDiv = document.getElementById('isConnected');
  const transactionDiv = document.getElementById('transaction');
  const gasEstimateDiv = document.getElementById('gasEstimate');
  const gasPriceDiv = document.getElementById('gasPrice');
  const typedDataSignatureDiv = document.getElementById('typedDataSignature');
  
  // Add these button declarations at the top
  const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
  const signButton = document.getElementById('signButton') as HTMLButtonElement;
  const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
  const signTxButton = document.getElementById('signTxButton') as HTMLButtonElement;
  const estimateGasButton = document.getElementById('estimateGasButton') as HTMLButtonElement;
  const getGasPriceButton = document.getElementById('getGasPriceButton') as HTMLButtonElement;
  const signTypedDataButton = document.getElementById('signTypedDataButton') as HTMLButtonElement;
  const getWalletInfoButton = document.getElementById('getWalletInfoButton') as HTMLButtonElement;
  const getPrivateKeyButton = document.getElementById('getPrivateKeyButton') as HTMLButtonElement;
  const verifySignatureButton = document.getElementById('verifySignatureButton') as HTMLButtonElement;
  const testEventsButton = document.getElementById('testEventsButton') as HTMLButtonElement;
  const sendTxButton = document.getElementById('sendTxButton') as HTMLButtonElement;
  const changeProviderButton = document.getElementById('changeProviderButton') as HTMLButtonElement;
  const getTokenBalanceButton = document.getElementById('getTokenBalanceButton') as HTMLButtonElement;
  const getTransactionReceiptButton = document.getElementById('getTransactionReceiptButton') as HTMLButtonElement;

  let wallet: IEVMWallet;

  function log(message: string) {
    if (outputDiv) {
      outputDiv.innerHTML += `<div>${message}</div>`;
      console.log(message);
    }
  }

  function updateStatus(status: string, isSuccess = false) {
    if (walletStatusDiv) {
      walletStatusDiv.textContent = status;
      walletStatusDiv.className = `test-status ${isSuccess ? 'pass' : ''}`;
    }
  }

  // Initialize Web3Auth wallet when login button is clicked
  loginButton?.addEventListener('click', async () => {
    try {
      log('Initializing Web3Auth wallet...');

      // Configure Web3Auth with the correct format
      const web3authConfig = {
        clientId: "BCUGgXUJQX2T90W4YBqJQpvLsjKzNv-fmFzbqdMq5zW7EOsCikCvOrrIIUmbHwFGw8rNp5Cgmc5KQ2cafWVT2tk",
        web3AuthNetwork: "sapphire_devnet",
        chainConfig: {
          chainNamespace: "eip155",
          chainId: "0xaa36a7", // Sepolia
          rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
          displayName: "Sepolia Testnet",
          blockExplorer: "https://sepolia.etherscan.io/",
          ticker: "ETH",
          tickerName: "Ethereum"
        },
        loginConfig: {
          loginProvider: "google"
        }
      };

      // Create the wallet with the standard structure
      const params: IWalletOptions = {
        adapterName: 'web3auth',
        options: { web3authConfig }
      }

      // Create and initialize the wallet
      wallet = await createWallet<IEVMWallet>(params);
      log('Web3Auth initialized. Requesting accounts...');

      // This will trigger the Web3Auth login popup
      const accounts = await wallet.requestAccounts();

      if (accounts && accounts.length > 0) {
        updateStatus('Connected', true);
        if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
        log(`Connected account: ${accounts[0]}`);

        // Get wallet information
        log(`Wallet name: ${wallet.getWalletName()}`);
        log(`Wallet version: ${wallet.getWalletVersion()}`);
        log(`Is connected: ${wallet.isConnected()}`);

        // Enable buttons
        if (signButton) signButton.disabled = false;
        if (disconnectButton) disconnectButton.disabled = false;
        if (signTxButton) signTxButton.disabled = false;
        if (estimateGasButton) estimateGasButton.disabled = false;
        if (getGasPriceButton) getGasPriceButton.disabled = false;
        if (signTypedDataButton) signTypedDataButton.disabled = false;
        if (getTokenBalanceButton) getTokenBalanceButton.disabled = false;
        if (getTransactionReceiptButton) getTransactionReceiptButton.disabled = false;
        if (getPrivateKeyButton) getPrivateKeyButton.disabled = false;
        if (verifySignatureButton) verifySignatureButton.disabled = false;
        if (testEventsButton) testEventsButton.disabled = false;
        if (getWalletInfoButton) getWalletInfoButton.disabled = false;
        if (changeProviderButton) changeProviderButton.disabled = false;
        if (sendTxButton) sendTxButton.disabled = false;

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

  // Sign a message when sign button is clicked
  signButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Signing message...');
      const message = 'Hello from Web3Auth Integration Test';
      const signature = await wallet.signMessage(message);

      if (signatureDiv) signatureDiv.textContent = signature;
      log(`Signature: ${signature}`);
    } catch (error: any) {
      log(`Signing error: ${error.message || error}`);
      console.error(error);
    }
  });

  // Disconnect when disconnect button is clicked
  disconnectButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Disconnecting...');
      await wallet.disconnect();

      updateStatus('Disconnected');
      if (walletAddressDiv) walletAddressDiv.textContent = '';
      if (signatureDiv) signatureDiv.textContent = '';

      // Disable buttons
      if (signButton) signButton.disabled = true;
      if (disconnectButton) disconnectButton.disabled = true;

      log('Wallet disconnected');
    } catch (error: any) {
      log(`Disconnect error: ${error.message || error}`);
      console.error(error);
    }
  });

  signTxButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Signing transaction...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0000001',
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

  sendTxButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Sending transaction...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0000001', // Very small amount
        data: '0x'
      };

      const txHash = await wallet.sendTransaction(tx);
      localStorage.setItem('lastTxHash', txHash);
      log(`Transaction sent with hash: ${txHash}`);
    } catch (error: any) {
      log(`Transaction error: ${error.message || error}`);
      console.error(error);
    }
  });

  getTokenBalanceButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      const txHash = localStorage.getItem('lastTxHash');
      if (!txHash) {
        log('No transaction hash found. Send a transaction first.');
        return;
      }

      log(`Getting receipt for transaction: ${txHash}`);

      const receipt = await wallet.getTransactionReceipt(txHash);

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

  getWalletInfoButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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

  getPrivateKeyButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Verifying signature...');
      const message = 'Hello from Web3Auth Integration Test';
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
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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
      wallet.on(WalletEvent.accountsChanged, accountChangedHandler);
      wallet.on(WalletEvent.chainChanged, chainChangedHandler);
      log('Event listeners registered');

      // Request accounts again to potentially trigger events
      await wallet.requestAccounts();
      log('Accounts requested to trigger event');

      // Wait a bit then remove listeners
      setTimeout(() => {
        wallet.off(WalletEvent.accountsChanged, accountChangedHandler);
        wallet.off(WalletEvent.chainChanged, chainChangedHandler);
        log('Event listeners removed after 2s');
      }, 2000);
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
      console.error(error);
    }
  });

  // Estimate Gas handler
  estimateGasButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Estimating gas...');
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.0000001',
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

  // Get Gas Price handler
  getGasPriceButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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
    } catch (error: any) {
      log(`Typed data signing error: ${error.message || error}`);
      console.error(error);
    }
  });

  // Change Provider handler
  changeProviderButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Changing provider not implemented in Web3Auth test');
      // In a real implementation, you would create a new provider and set it
      // wallet.setProvider(newProvider);
    } catch (error: any) {
      log(`Provider change error: ${error.message || error}`);
      console.error(error);
    }
  });

  log('Web3Auth test page loaded');
});