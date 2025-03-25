import { ICoreWallet, WalletEvent, IWalletOptions, createWallet, IEVMWallet } from '@m3s/wallet';
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
  const getWalletInfoButton = document.getElementById('getWalletInfoButton') as HTMLButtonElement;
  const getPrivateKeyButton = document.getElementById('getPrivateKeyButton') as HTMLButtonElement;
  const verifySignatureButton = document.getElementById('verifySignatureButton') as HTMLButtonElement;
  const testEventsButton = document.getElementById('testEventsButton') as HTMLButtonElement;
  const sendTxButton = document.getElementById('sendTxButton') as HTMLButtonElement;

  // Wallet instance
  let wallet!: ICoreWallet;

  // Helper functions
  function setupEventDebugLogging(walletInstance: ICoreWallet) {
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
    getWalletInfoButton.disabled = !enabled;
    getPrivateKeyButton.disabled = !enabled;
    verifySignatureButton.disabled = !enabled;
    testEventsButton.disabled = !enabled;
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
      wallet.disconnect();

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
  
      log('Registering event listeners...');
      wallet.on(WalletEvent.accountsChanged, accountChangedHandler);
      wallet.on(WalletEvent.chainChanged, chainChangedHandler);
  
      // Test accounts changed
      log('1. Testing accountsChanged event...');
      await wallet.requestAccounts();
  
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
  
    } catch (error: any) {
      log(`Error testing events: ${error.message}`);
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
      const tx = {
        to: '0x0000000000000000000000000000000000000000',
        value: '0.000000001',
        data: '0x'
      };

      try {
        const txHash = await wallet.sendTransaction(tx);
        log(`Transaction sent with hash: ${txHash}`);
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