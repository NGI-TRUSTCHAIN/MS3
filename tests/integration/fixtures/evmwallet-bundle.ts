import { createWallet, IEVMWallet, IWalletOptions, WalletEvent } from '@m3s/wallet';
import { ethers, JsonRpcProvider } from 'ethers';
import { NETWORK_CONFIGS } from '../config.js';

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
  const walletNameDiv = document.getElementById('walletName');
  const walletVersionDiv = document.getElementById('walletVersion');
  const isInitializedDiv = document.getElementById('isInitialized');
  const isConnectedDiv = document.getElementById('isConnected');

  const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
  const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
  const signMsgButton = document.getElementById('signMsgButton') as HTMLButtonElement;
  const signTxButton = document.getElementById('signTxButton') as HTMLButtonElement;
  const estimateGasButton = document.getElementById('estimateGasButton') as HTMLButtonElement;
  const getGasPriceButton = document.getElementById('getGasPriceButton') as HTMLButtonElement;
  const signTypedDataButton = document.getElementById('signTypedDataButton') as HTMLButtonElement;
  const getTokenBalanceButton = document.getElementById('getTokenBalanceButton') as HTMLButtonElement;
  const getTransactionReceiptButton = document.getElementById('getTransactionReceiptButton') as HTMLButtonElement;

  // Add new UI elements for the additional tests

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

  function setupEventDebugLogging(walletInstance: any) {
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
      if (privateKeyDiv) privateKeyDiv.textContent = privateKey;
      log(`Private key : ${privateKey}`);
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
  
      // Register listeners with explicit enum values
      log('Registering event listeners...');
      console.log('WalletEvent.accountsChanged =', WalletEvent.accountsChanged);
      console.log('WalletEvent.chainChanged =', WalletEvent.chainChanged);
  
      wallet.on(WalletEvent.accountsChanged, accountChangedHandler);
      wallet.on(WalletEvent.chainChanged, chainChangedHandler);
  
      // Test accounts changed
      log('1. Testing accountsChanged event...');
      await wallet.requestAccounts();
  
      // Test chain changed with small delay
      setTimeout(async () => {
        log('2. Testing chainChanged event...');
        // Using centralized network configuration
        const holeskyProvider = new JsonRpcProvider(NETWORK_CONFIGS.holesky.chainConfig.rpcTarget);
        await wallet.setProvider(holeskyProvider);
  
        // Check event status after 2s
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
        }, 2000);
      }, 1000);
  
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
      console.error(error);
    }
  });

  // Add handler for sending a transaction
  sendTxButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Sending transaction...');
      let tx: any;
      const myAddress = await wallet.getAccounts().then((accounts: string[]) => accounts[0]);
      const network = await wallet.getNetwork();
      
      if (network.chainId === '17000') { // Holesky
        tx = {
          to: myAddress,
          value: '0.000000001',
          data: '0x',
          gasPrice: ethers.parseUnits('1.5', 'gwei').toString(), // Explicitly set low gas price
          gasLimit: '21000'
        };
      } else {
        tx = {
          to: myAddress,
          value: '0.000000001',
          data: '0x'
        };
      }

      try {
        const txHash = await wallet.sendTransaction(tx);
        localStorage.setItem('lastTxHash', txHash);
        log(`Transaction sent with hash: ${txHash}`);

        // Enable transaction receipt button
        if (getTransactionReceiptButton) getTransactionReceiptButton.disabled = false;
      } catch (txError: any) {
        log(`Transaction error: ${txError.message}`);
      }
    } catch (error: any) {
      log(`Transaction setup error: ${error.message}`);
      console.error(error);
    }
  });

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
        ? new JsonRpcProvider(NETWORK_CONFIGS.sepolia.chainConfig.rpcTarget)
        : new JsonRpcProvider(NETWORK_CONFIGS.holesky.chainConfig.rpcTarget);
      
      log(`Changing provider to ${currentNetwork.chainId === '17000' ? 'Sepolia' : 'Holesky'} network...`);
      
      // Wait for provider to be ready
      await targetConfig.ready;
      await wallet.setProvider(targetConfig);
  
      // Wait for provider update
      await new Promise(r => setTimeout(r, 2000));
  
      const afterNetwork = await wallet.getNetwork();
      log(`New network: Chain ID: ${afterNetwork.chainId}, Name: ${afterNetwork.name || 'unknown'}`);
  
      if (networkDiv) {
        networkDiv.textContent = `Chain ID: ${afterNetwork.chainId}, Name: ${afterNetwork.name || 'unknown'}`;
      }
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
      const TEST_PRIVATE_KEY = '0x63a648a4c0efeeb4f08207f1682bed9937a4c6cb5f7f1ee39f75c135e8828b2b';

      // Use the new parameter structure with options object
      const provider = new JsonRpcProvider("https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8");
      const params: IWalletOptions = {
        adapterName: "evmWallet",
        provider,
        options: {
          privateKey: TEST_PRIVATE_KEY
        }
      };

      wallet = await createWallet<IEVMWallet>(params);
      setupEventDebugLogging(wallet);

      // Verify private key is what we expect
      const actualPrivateKey = await wallet.getPrivateKey();
      if (actualPrivateKey !== TEST_PRIVATE_KEY) {
        log(`⚠️ WARNING: Private key mismatch! Expected: ${TEST_PRIVATE_KEY.substring(0, 6)}...`);
      }

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
        if (disconnectButton) disconnectButton.disabled = false;

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

      const txHash = localStorage.getItem('lastTxHash');
      if (!txHash) {
        log('No transaction hash found. Send a transaction first.');
        return;
      }

      log(`Getting receipt for transaction: ${txHash}`);
      const receipt = await wallet.getTransactionReceipt(txHash);

      if (transactionReceiptDiv) {
        transactionReceiptDiv.textContent = JSON.stringify(receipt, (key, value) => {
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

  getPrivateKeyButton?.addEventListener('click', async () => {
    try {
      log('Getting private key...');
      const privateKey = await wallet.getPrivateKey();

      // Only show the last few characters for security
      if (privateKeyDiv) privateKeyDiv.textContent = privateKey;
      log(`Private key: ${privateKey}`);
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
  
      // Register listeners with explicit enum values
      log('Registering event listeners...');
      console.log('WalletEvent.accountsChanged =', WalletEvent.accountsChanged);
      console.log('WalletEvent.chainChanged =', WalletEvent.chainChanged);
  
      wallet.on(WalletEvent.accountsChanged, accountChangedHandler);
      wallet.on(WalletEvent.chainChanged, chainChangedHandler);
  
      // Test accounts changed
      log('1. Testing accountsChanged event...');
      await wallet.requestAccounts();
  
      // Test chain changed with small delay
      setTimeout(async () => {
        log('2. Testing chainChanged event...');
        // Using centralized network configuration
        const holeskyProvider = new JsonRpcProvider(NETWORK_CONFIGS.holesky.chainConfig.rpcTarget);
        await wallet.setProvider(holeskyProvider);
  
        // Check event status after 2s
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
        }, 2000);
      }, 1000);
  
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
      console.error(error);
    }
  });

  changeProviderButton?.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }
  
      const currentNetwork = await wallet.getNetwork();
      log(`Current network before change: ChainID ${currentNetwork.chainId}, Name: ${currentNetwork.name}`);
  
      // Use the centralized configs
      const targetConfig = currentNetwork.chainId === '17000'
        ? new JsonRpcProvider(NETWORK_CONFIGS.sepolia.chainConfig.rpcTarget)
        : new JsonRpcProvider(NETWORK_CONFIGS.holesky.chainConfig.rpcTarget);
      
      await wallet.setProvider(targetConfig);
  
      // Get updated network after change
      const afterNetwork = await wallet.getNetwork();
      log(`New network: Chain ID: ${afterNetwork.chainId}, Name: ${afterNetwork.name || 'unknown'}`);
  
      if (networkDiv) {
        networkDiv.textContent = `Chain ID: ${afterNetwork.chainId}, Name: ${afterNetwork.name || 'unknown'}`;
      }
    } catch (error: any) {
      log(`Error changing provider: ${error.message}`);
      console.error(error);
    }
  });

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
      if (networkDiv) networkDiv.textContent = '';

      // Disable all buttons except connect
      if (signMsgButton) signMsgButton.disabled = true;
      if (signTxButton) signTxButton.disabled = true;
      if (disconnectButton) disconnectButton.disabled = true;

      if (estimateGasButton) estimateGasButton.disabled = true;
      if (getGasPriceButton) getGasPriceButton.disabled = true;
      if (signTypedDataButton) signTypedDataButton.disabled = true;
      if (getWalletInfoButton) getWalletInfoButton.disabled = true;
      if (getPrivateKeyButton) getPrivateKeyButton.disabled = true;
      if (testEventsButton) testEventsButton.disabled = true;
      if (sendTxButton) sendTxButton.disabled = true;
      if (changeProviderButton) changeProviderButton.disabled = true;
      if (getTokenBalanceButton) getTokenBalanceButton.disabled = true;
      if (getTransactionReceiptButton) getTransactionReceiptButton.disabled = true;

      log('Wallet disconnected');
    } catch (error: any) {
      log(`Disconnect error: ${error.message || error}`);
      console.error(error);
    }
  });

  log('EVM wallet test page loaded');

});