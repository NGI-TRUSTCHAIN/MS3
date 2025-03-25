import { IEVMWallet, WalletEvent, IWalletOptions, createWallet } from '@m3s/wallet';
import { JsonRpcProvider } from 'ethers';
import { NETWORK_CONFIGS } from "{{NETWORK_IMPORT_PATH}}";

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
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
  const privateKeyDiv = document.getElementById('privateKey');
  const verifySignatureDiv = document.getElementById('verifySignature');
  const walletNameDiv = document.getElementById('walletName');
  const walletVersionDiv = document.getElementById('walletVersion');
  const isInitializedDiv = document.getElementById('isInitialized');
  const isConnectedDiv = document.getElementById('isConnected');
  const eventLogDiv = document.getElementById('eventLog');

  // Buttons
  const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
  const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
  const signMsgButton = document.getElementById('signMsgButton') as HTMLButtonElement;
  const signTxButton = document.getElementById('signTxButton') as HTMLButtonElement;
  const estimateGasButton = document.getElementById('estimateGasButton') as HTMLButtonElement;
  const getGasPriceButton = document.getElementById('getGasPriceButton') as HTMLButtonElement;
  const signTypedDataButton = document.getElementById('signTypedDataButton') as HTMLButtonElement;
  const getWalletInfoButton = document.getElementById('getWalletInfoButton') as HTMLButtonElement;
  const getTokenBalanceButton = document.getElementById('getTokenBalanceButton') as HTMLButtonElement;
  const getTransactionReceiptButton = document.getElementById('getTransactionReceiptButton') as HTMLButtonElement;
  const getPrivateKeyButton = document.getElementById('getPrivateKeyButton') as HTMLButtonElement;
  const verifySignatureButton = document.getElementById('verifySignatureButton') as HTMLButtonElement;
  const testEventsButton = document.getElementById('testEventsButton') as HTMLButtonElement;
  const changeProviderButton = document.getElementById('changeProviderButton') as HTMLButtonElement;
  const sendTxButton = document.getElementById('sendTxButton') as HTMLButtonElement;

  // Wallet instance
  let wallet!: IEVMWallet;

  // Helper functions
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
      outputDiv.scrollTop = outputDiv.scrollHeight;
      console.log(message);
    }
  }

  function updateStatus(status: string, isSuccess = false) {
    if (walletStatusDiv) {
      walletStatusDiv.textContent = status;
      walletStatusDiv.className = isSuccess ? 'test-status pass' : 'test-status';
    }
  }

  function enableButtons(enabled: boolean) {
    disconnectButton.disabled = !enabled;
    signMsgButton.disabled = !enabled;
    signTxButton.disabled = !enabled;
    estimateGasButton.disabled = !enabled;
    getGasPriceButton.disabled = !enabled;
    signTypedDataButton.disabled = !enabled;
    getWalletInfoButton.disabled = !enabled;
    getTokenBalanceButton.disabled = !enabled;
    getPrivateKeyButton.disabled = !enabled;
    verifySignatureButton.disabled = !enabled;
    testEventsButton.disabled = !enabled;
    changeProviderButton.disabled = !enabled;
    sendTxButton.disabled = !enabled;
  }

  // Connect button handler
  connectButton.addEventListener('click', async () => {
    try {
      log('Initializing {{ADAPTER_NAME}} wallet...');

      /* ADAPTER_INIT_CODE */

      log('{{ADAPTER_NAME}} initialized. Requesting accounts...');
      const accounts = await wallet.requestAccounts();

      if (accounts && accounts.length > 0) {
        updateStatus('Connected', true);
        if (walletAddressDiv) walletAddressDiv.textContent = accounts[0];
        log(`Connected account: ${accounts[0]}`);

        // Get network info
        const network = await wallet.getNetwork();
        if (networkDiv) networkDiv.textContent = `Chain ID: ${network.chainId}, Name: ${network.name || 'unknown'}`;

        // Enable all buttons
        enableButtons(true);

        // Show wallet info immediately
        if (walletNameDiv) walletNameDiv.textContent = wallet.getWalletName();
        if (walletVersionDiv) walletVersionDiv.textContent = wallet.getWalletVersion();
        if (isInitializedDiv) isInitializedDiv.textContent = String(wallet.isInitialized());
        if (isConnectedDiv) isConnectedDiv.textContent = String(wallet.isConnected());

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

  // Disconnect button handler
  disconnectButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Disconnecting...');
      await wallet.disconnect();

      updateStatus('Disconnected');
      if (walletAddressDiv) walletAddressDiv.textContent = '';
      if (networkDiv) networkDiv.textContent = '';
      if (signatureDiv) signatureDiv.textContent = '';
      if (transactionDiv) transactionDiv.textContent = '';

      // Disable all buttons except connect
      enableButtons(false);

      log('Wallet disconnected');
    } catch (error: any) {
      log(`Disconnect error: ${error.message || error}`);
      console.error(error);
    }
  });

  // Sign message handler
  signMsgButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Signing message...');
      const message = 'Hello from {{ADAPTER_NAME}} Integration Test';
      const signature = await wallet.signMessage(message);

      if (signatureDiv) signatureDiv.textContent = signature;
      log(`Signature: ${signature}`);
    } catch (error: any) {
      log(`Signing error: ${error.message || error}`);
      console.error(error);
    }
  });

  // Sign transaction handler
  signTxButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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

  // Estimate gas handler
  estimateGasButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

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

  // Get gas price handler
  getGasPriceButton.addEventListener('click', async () => {
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

  // Sign typed data handler
  signTypedDataButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Signing typed data...');
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

  // Get wallet info handler
  getWalletInfoButton.addEventListener('click', async () => {
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

  // Get token balance handler
  getTokenBalanceButton.addEventListener('click', async () => {
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

  // Get private key handler
  getPrivateKeyButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Getting private key...');
      const privateKey = await wallet.getPrivateKey();

      if (privateKeyDiv) privateKeyDiv.textContent = privateKey;
      log(`Private key: ${privateKey}`);
    } catch (error: any) {
      log(`Error getting private key: ${error.message}`);
      console.error(error);
    }
  });

  // Get transaction receipt handler
  getTransactionReceiptButton.addEventListener('click', async () => {
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

  // Verify signature handler
  verifySignatureButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Verifying signature...');
      const message = 'Hello from {{ADAPTER_NAME}} Integration Test';
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

  // Test events handler
  testEventsButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Testing event listeners...');

      // Clear event log
      if (eventLogDiv) {
        eventLogDiv.textContent = 'Waiting for events (should appear below)...\n';
      }

      let eventsReceived = 0;

      const accountChangedHandler = (accounts: string[]) => {
        eventsReceived++;
        const message = `✓ accountsChanged event received with: ${accounts.join(', ')}`;
        log(message);
        if (eventLogDiv) {
          eventLogDiv.textContent += message + '\n';
        }
      };

      const chainChangedHandler = (chainId: string) => {
        eventsReceived++;
        const message = `✓ chainChanged event received with: ${chainId}`;
        log(message);
        if (eventLogDiv) {
          eventLogDiv.textContent += message + '\n';
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
        const holeskyProvider = new JsonRpcProvider(NETWORK_CONFIGS.holesky.rpcTarget);
        await wallet.setProvider(holeskyProvider);

        // Check event status after 2s
        setTimeout(() => {
          if (eventsReceived === 0) {
            log('⚠️ No events detected!');
            if (eventLogDiv) {
              eventLogDiv.textContent += '⚠️ No events were received!\n';
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

  // Change provider handler
  changeProviderButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }
      const currentNetwork = await wallet.getNetwork();
      log(`Current network before change: ChainID ${currentNetwork.chainId}, Name: ${currentNetwork.name}`);
  
      // Use the configurations from the central config file
      const targetConfig = currentNetwork.chainId === '17000' 
        ? NETWORK_CONFIGS.sepolia
        : NETWORK_CONFIGS.holesky;

      if (!targetConfig) {
        throw new Error("No alternate network configuration found");
      }

      log(`Changing provider to ${targetConfig.displayName} network...`);

      // Delegate to the adapter's setProvider
      await wallet.setProvider(targetConfig);

      // Wait a moment for the network switch
      await new Promise(r => setTimeout(r, 1000));

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

  // Send transaction handler
  sendTxButton.addEventListener('click', async () => {
    try {
      if (!wallet) {
        log('Wallet not connected');
        return;
      }

      log('Sending transaction...');
      let tx: any;
      const myAddress = await wallet.getAccounts().then((accounts: string[]) => accounts[0]);
      const network = await wallet.getNetwork();

      // Create a minimal transaction to self with minimal value
      tx = {
        to: myAddress,
        value: '0.000000001',
        data: '0x'
      };

      try {
        const txHash = await wallet.sendTransaction(tx);
        localStorage.setItem('lastTxHash', txHash);
        log(`Transaction sent with hash: ${txHash}`);

        // Enable transaction receipt button
        getTransactionReceiptButton.disabled = false;
      } catch (txError: any) {
        log(`Transaction error: ${txError.message}`);
      }
    } catch (error: any) {
      log(`Transaction setup error: ${error.message}`);
      console.error(error);
    }
  });

  log('{{ADAPTER_NAME}} integration test loaded');
});