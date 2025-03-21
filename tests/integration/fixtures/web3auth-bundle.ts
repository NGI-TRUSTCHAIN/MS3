import { createWallet, IWalletOptions, IEVMWallet, WalletEvent } from '@m3s/wallet';
import { ethers } from 'ethers';
import { NETWORK_CONFIGS } from '../config.js';

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
  const networkDiv = document.getElementById('network');

  // Add these button declarations at the top
  const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
  const signButton = document.getElementById('signMsgButton') as HTMLButtonElement;
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

  function setupEventDebugLogging(walletInstance: IEVMWallet) {
    const originalOn = walletInstance.on;
    const originalOff = walletInstance.off;

    // Override 'on' method to log registrations
    walletInstance.on = function (event: any, callback: () => void) {
      console.log(`[DEBUG] Registering listener for event: ${event}`);
      return originalOn.call(walletInstance, event, callback);
    };

    // Override 'off' method to log removals
    walletInstance.off = function (event: any, callback: () => void) {
      console.log(`[DEBUG] Removing listener for event: ${event}`);
      return originalOff.call(walletInstance, event, callback);
    };
  }

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
          rpcTarget: "https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8",
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
      setupEventDebugLogging(wallet);

      log('Web3Auth initialized. Requesting accounts...');

      // This will trigger the Web3Auth login popup
      const accounts = await wallet.requestAccounts();

      if (accounts && accounts.length > 0) {
        updateStatus('Connected', true);
        if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
        log(`Connected account: ${accounts[0]}`);

        // Get network info
        const network = await wallet.getNetwork();
        if (networkDiv) networkDiv.textContent = `Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`;

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
  
      // Get current network and account info
      const network = await wallet.getNetwork();
      const accounts = await wallet.getAccounts();
      const address = accounts[0];
      
      // Get and log the balance
      const balance = await wallet.getBalance(address);
      log(`Current balance: ${balance} ETH on ${network.name || network.chainId}`);
      
      // Create a minimal transaction based on available funds
      let tx;
      if (parseFloat(balance) < 0.0001) { // Very small balance
        tx = {
          to: address, // Send to self
          value: '0.0000000001', // Extremely small amount
          data: '0x',
          gasPrice: ethers.parseUnits('0.5', 'gwei').toString(), // Use minimal gas price
          gasLimit: '21000'
        };
        log('Using minimal transaction due to low balance');
      } else {
        tx = {
          to: address, // Send to self
          value: '0.0000001', // Small amount
          data: '0x'
        };
      }
  
      const txHash = await wallet.sendTransaction(tx as any);
      localStorage.setItem('lastTxHash', txHash);
      log(`Transaction sent with hash: ${txHash}`);
      
      // Enable transaction receipt button
      if (getTransactionReceiptButton) getTransactionReceiptButton.disabled = false;
    } catch (error: any) {
      log(`Transaction error: ${error.message}`);
      console.error(error);
    }
  });

  getTokenBalanceButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      // Get current network to determine appropriate token address
      const network = await wallet.getNetwork();

      // Use network-specific tokens that are known to exist
      let tokenAddress;
      if (network.chainId === '11155111') { // Sepolia
        // USDC on Sepolia
        tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
      } else if (network.chainId === '17000') { // Holesky 
        // WETH on Holesky
        tokenAddress = '0x94373a4919B3240D86eA41593D5eBa789FEF3848';
      } else {
        // Default to a test token
        tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
      }

      log(`Using token address for ${network.name}: ${tokenAddress}`);
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
          // Handle BigInt serialization
          return typeof value === 'bigint' ? value.toString() : value;
        }, 2);
      }

      if (receipt) {
        log(`Transaction receipt received. Status: ${receipt.status === 1 ? 'Success ✅' : 'Failed ❌'}`);
      } else {
        log('Transaction still pending - no receipt available yet');
      }
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
      if (privateKeyDiv) privateKeyDiv.textContent = privateKey;
      log(`Private key : ${privateKey}`);
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
      log('Testing event listeners...');
  
      // Clear event log
      if (eventLogDiv) {
        eventLogDiv.textContent = 'Waiting for events (should appear below)...\n';
        eventLogDiv.style.color = 'orange';
      }
  
      let eventsReceived = 0;
  
      const accountChangedHandler = (accounts: string[]) => {
        eventsReceived++;
        const message = `✓ accountsChanged event received with: ${accounts.join(', ')}`;
        log(message);
        if (eventLogDiv) {
          eventLogDiv.textContent += message + '\n';
          eventLogDiv.style.color = 'green';
        }
      };
  
      const chainChangedHandler = (chainId: string) => {
        eventsReceived++;
        const message = `✓ chainChanged event received with: ${chainId}`;
        log(message);
        if (eventLogDiv) {
          eventLogDiv.textContent += message + '\n';
          eventLogDiv.style.color = 'green';
        }
      };
  
      log('Registering event listeners...');
      wallet.on(WalletEvent.accountsChanged, accountChangedHandler);
      wallet.on(WalletEvent.chainChanged, chainChangedHandler);
  
      // Skip requestAccounts if already connected
      log('1. Testing accountsChanged event...');
      const accounts = await wallet.getAccounts();
      if (accounts && accounts.length > 0) {
        log('Already connected, emitting event manually for testing');
      }
  
      // Test chain changed with proper chainConfig format
      setTimeout(async () => {
        try {
          log('2. Testing chainChanged event...');
          const currentNetwork = await wallet.getNetwork();
  
          // Use centralized network config for the opposite network
          const newConfig = currentNetwork.chainId === '17000' 
            ? NETWORK_CONFIGS.sepolia.chainConfig 
            : NETWORK_CONFIGS.holesky.chainConfig;
  
          log(`Switching to ${newConfig.displayName}...`);
          await wallet.setProvider({ chainConfig: newConfig });
        } catch (err: any) {
          log(`Error in chain change test: ${err.message}`);
        }
  
        // Check event status after 3 seconds
        setTimeout(() => {
          if (eventsReceived === 0) {
            log('⚠️ No events detected!');
            if (eventLogDiv) {
              eventLogDiv.textContent += '⚠️ No events were received!\n';
              eventLogDiv.style.color = 'red';
            }
          } else {
            log(`✓ Received ${eventsReceived} events`);
          }
  
          // Clean up
          wallet.off(WalletEvent.accountsChanged, accountChangedHandler);
          wallet.off(WalletEvent.chainChanged, chainChangedHandler);
          log('Event listeners removed');
        }, 3000);
      }, 1000);
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


      // Get current network to use correct chainId
      const network = await wallet.getNetwork();

      const typedData = {
        domain: {
          name: 'Test App',
          version: '1',
          chainId: parseInt(network.chainId), // Use current chainId instead of hardcoding
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
  
      const currentNetwork = await wallet.getNetwork();
      log(`Current network before change: ChainID ${currentNetwork.chainId}, Name: ${currentNetwork.name}`);
  
      // Use the configurations from the central config file
      const targetConfig = currentNetwork.chainId === '17000' 
        ? NETWORK_CONFIGS.sepolia.chainConfig 
        : NETWORK_CONFIGS.holesky.chainConfig;
  
      log(`Switching to ${targetConfig.displayName}...`);
      await wallet.setProvider({ chainConfig: targetConfig });
  
      // Get updated network info
      const afterNetwork = await wallet.getNetwork();
      log(`Network after change: ChainID ${afterNetwork.chainId}, Name: ${afterNetwork.name}`);
  
      // Update UI
      if (networkDiv) {
        networkDiv.textContent = `Chain ID: ${afterNetwork.chainId}, Name: ${afterNetwork.name || 'unknown'}`;
      }
    } catch (error: any) {
      log(`Error changing provider: ${error.message}`);
      console.error(error);
    }
  });

  log('Web3Auth test page loaded');
});