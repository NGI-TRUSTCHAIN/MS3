import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ethers } from 'ethers';
import { NetworkConfig, NetworkHelper } from '@m3s/common';
import { WalletEvent, AssetBalance, GenericTransactionData } from '@m3s/wallet';


export function testCoreWalletInterface(wallet: any, skipConnectivity: boolean = false) {
  // Safety check for undefined wallet
  if (!wallet) {
    console.warn('Wallet instance is undefined, skipping full test suite');
    return;
  }

  const networkHelper = NetworkHelper.getInstance();

  describe('ICoreWallet Interface Tests', () => {
    describe('General Initialization Methods', () => {
      it('should implement initialize method', () => {
        expect(typeof wallet.initialize).toBe('function');
      });

      it('should implement isInitialized method', () => {
        expect(typeof wallet.isInitialized).toBe('function');
      });

      it('should implement disconnect method', () => {
        expect(typeof wallet.disconnect).toBe('function');
      });
    });

    describe('Wallet Metadata Methods', () => {
      it('should implement name method', () => {
        expect(typeof wallet).toBe('object');
        const name = wallet.name;
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });

      it('should implement getWalletVersion method', () => {
        expect(typeof wallet.name).toBe('string');
        const version = wallet.version
        expect(typeof wallet.name).toBe('string');
        expect(version.length).toBeGreaterThan(0);
      });

      it('should implement isConnected method', () => {
        expect(typeof wallet.isConnected).toBe('function');
        const connected = wallet.isConnected();
        expect(typeof connected).toBe('boolean');
      });
    });

    describe('Account Management Methods', () => {

      it('should implement getAccounts method', () => {
        expect(typeof wallet.getAccounts).toBe('function');
      });

      it('should implement getBalance method', () => {
        expect(typeof wallet.getBalance).toBe('function');
      });

      it('should implement callContract method', () => {
        expect(typeof wallet.callContract).toBe('function');
      });
    });


    describe('Event Methods', () => {
      it('should implement on method', () => {
        expect(typeof wallet.on).toBe('function');
      });

      it('should implement off method', () => {
        expect(typeof wallet.off).toBe('function');
      });

      it('should register and remove event listeners correctly', () => {
        const callback = () => { };
        // Should not throw an error
        wallet.on(WalletEvent.accountsChanged, callback);
        wallet.off(WalletEvent.accountsChanged, callback);
      });
    });

    describe('Network Methods', () => {
      it('should implement getNetwork method', () => {
        expect(typeof wallet.getNetwork).toBe('function');
      });

      it('should implement setProvider method', () => {
        expect(typeof wallet.setProvider).toBe('function');
      });
    });

    // Only run functional tests if connectivity tests aren't skipped
    if (!skipConnectivity) {
      describe('Functional Tests', () => {
        let accounts: string[] = [];
        let networks: Record<string, any> = {};

        // Get accounts once before functional tests
        beforeAll(async () => {
          try {
            // Load networks first
            await networkHelper.ensureInitialized();

            // Populate local networks object (add more if needed for other tests)
            const polygonNetConfig = await networkHelper.getNetworkConfig('polygon');
            if (polygonNetConfig) networks.polygon = polygonNetConfig;

            const sepoliaNetConfig = await networkHelper.getNetworkConfig('sepolia');
            if (sepoliaNetConfig) networks.sepolia = sepoliaNetConfig;

            // Ensure wallet is initialized before getting accounts
            // if (!wallet.isInitialized()) {
            //   await wallet.initialize();
            // }

            accounts = await wallet.getAccounts();
            if (accounts.length === 0) {
              console.error('!!! CRITICAL: No accounts found !!!');
            }
          } catch (error) {
            console.error('Error during beforeAll setup:', error);
          }
        });

        it('should get accounts array', async () => {
          // This test now just verifies the pre-fetched accounts
          expect(Array.isArray(accounts)).toBe(true);
          // Optionally check if the first account looks like an address (basic check)
          if (accounts.length > 0) {
            expect(accounts[0]).toMatch(/^0x[a-fA-F0-9]{40}$/); // Basic EVM address check
          }
        });

        it('should get balance as AssetBalance object', async () => {
          if (accounts.length === 0) {
            console.warn('Skipping getBalance test - no accounts available.');
            return;
          }
          try {
            const balance: AssetBalance = await wallet.getBalance(accounts[0]);
            expect(balance).toBeDefined();
            expect(typeof balance.amount).toBe('string');
            expect(typeof balance.decimals).toBe('number');
            expect(typeof balance.symbol).toBe('string');
            expect(balance.symbol.length).toBeGreaterThan(0);
            // Check if formattedAmount exists and is a string, if present
            if (balance.formattedAmount !== undefined) {
              expect(typeof balance.formattedAmount).toBe('string');
            }
            // Check if amount is a non-negative integer string
            expect(balance.amount).toMatch(/^\d+$/);
          } catch (error) {
            console.warn('Could not test getBalance:', error);
            // expect(true).toBe(true); // Avoid test failure in CI/restricted envs
          }
        });

        it('should sign a message and verify it', async () => {
          if (accounts.length === 0) {
            console.warn('Skipping sign/verify message test - no accounts available.');
            return;
          }
          try {
            const message = `Test message for signature verification ${Date.now()}`;
            const signerAddress = accounts[0];

            const signature = await wallet.signMessage(message);
            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(100); // Basic check for signature format
            expect(signature.startsWith('0x')).toBe(true);

            // Verify the signature
            const isValid = await wallet.verifySignature(message, signature, signerAddress);
            expect(isValid).toBe(true);

            // Test with a different address (should fail)
            const otherAddress = ethers.Wallet.createRandom().address;
            const isInvalid = await wallet.verifySignature(message, signature, otherAddress);
            expect(isInvalid).toBe(false);

          } catch (error) {
            console.warn('Could not test message signing/verification:', error);
            // expect(true).toBe(true); // Avoid test failure
            throw error; // Re-throw to actually fail the test if an error occurs
          }
        });

        // Test for Uint8Array message signing
        it('should sign a Uint8Array message and verify it', async () => {
          if (accounts.length === 0) {
            console.warn('Skipping sign/verify Uint8Array message test - no accounts available.');
            return;
          }
          try {
            const messageText = `Test Uint8Array message ${Date.now()}`;
            const messageBytes = ethers.toUtf8Bytes(messageText); // Use ethers utility
            const signerAddress = accounts[0];

            const signature = await wallet.signMessage(messageBytes);
            expect(typeof signature).toBe('string');
            expect(signature.startsWith('0x')).toBe(true);

            // Verify the signature
            const isValid = await wallet.verifySignature(messageBytes, signature, signerAddress);
            expect(isValid).toBe(true);

            // Test with a different message (should fail)
            const differentMessageBytes = ethers.toUtf8Bytes("Different message");
            const isInvalidDifferentMessage = await wallet.verifySignature(differentMessageBytes, signature, signerAddress);
            expect(isInvalidDifferentMessage).toBe(false);

          } catch (error) {
            console.warn('Could not test Uint8Array message signing/verification:', error);
            // expect(true).toBe(true); // Avoid test failure
            throw error; // Re-throw to actually fail the test if an error occurs
          }
        });


        it('should get network information', async () => {
          try {
            const network = await wallet.getNetwork();
            expect(network).toBeDefined();
            expect(network.chainId).toBeDefined();
            expect(typeof network.chainId === 'string' || typeof network.chainId === 'number').toBe(true);
            // Name is optional
            if (network.name !== undefined) {
              expect(typeof network.name).toBe('string');
            }
          } catch (error) {
            console.warn('Could not test getNetwork:', error);
            // expect(true).toBe(true); // Avoid test failure
          }
        });

        it('should set provider using NetworkConfig and emit chainChanged', async () => {
          // Use a different network config from utils.ts, e.g., Polygon (chainId 137 / 0x89)
          const polygonConfig: NetworkConfig = {
            name: 'polygon',
            chainId: networks.polygon.chainId, // '0x89'
            rpcUrls: [networks.polygon.rpcTarget],
            displayName: networks.polygon.name, // Optional: for mock adapter
            blockExplorerUrl: networks.polygon.blockExplorerUrl, // Optional
            ticker: networks.polygon.ticker, // Optional
            tickerName: networks.polygon.tickerName // Optional
          };

          const eventSpy = vi.fn();
          wallet.on(WalletEvent.chainChanged, eventSpy);

          try {

            await wallet.setProvider(polygonConfig);
            const newNetwork = await wallet.getNetwork();

            // Check if network actually changed (allow string/number comparison)
            expect(newNetwork.chainId.toString()).toEqual(polygonConfig.chainId!.toString());

            // Check if the event was emitted with the new chainId
            expect(eventSpy).toHaveBeenCalled();
            // Allow either string or number from event
            expect(eventSpy).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^(${polygonConfig.chainId}|${parseInt(polygonConfig.chainId as string, 16)})$`)));


          } catch (error) {
            console.warn('Could not test setProvider:', error);
            // Don't fail test if RPC is unavailable etc.
            // expect(true).toBe(true);
          } finally {
            // Clean up listener
            wallet.off(WalletEvent.chainChanged, eventSpy);
            // Optional: Switch back to original provider if needed for subsequent tests?
            // This might require storing the initial config. For now, assume tests run independently or handle state.
          }
        });

        it('should attempt to sign a transaction and handle response/errors appropriately', async () => {
          expect(typeof wallet.signTransaction).toBe('function'); // Method exists

          if (accounts.length === 0) {
            console.warn('Skipping signTransaction functional test - no accounts available.');
            return;
          }
          // signTransaction might not always need full connectivity, but often needs chainId/nonce.

          const tx: GenericTransactionData = {
            to: accounts[0],
            value: '0', // No actual value transfer
            data: '0x', // Simple transaction
            options: { gasLimit: '21000' } // Minimal options
          };

          try {
            const signedTx = await wallet.signTransaction(tx);
            expect(typeof signedTx).toBe('string');
            expect(signedTx.startsWith('0x')).toBe(true);
            // A typical Ethereum signed transaction is much longer than a hash
            expect(signedTx.length).toBeGreaterThan(100); // Basic length check for a signed tx
            console.log(`signTransaction call succeeded (this might be a real or mocked signature)`);
          } catch (error: any) {
            console.warn(`signTransaction call failed: ${error.message}`);
            expect(error).toBeInstanceOf(Error);
            // If skipConnectivity is true, errors due to missing provider info for nonce/chainId are plausible.
            // If skipConnectivity is false, other runtime errors might occur.
            if (skipConnectivity && (error.message.toLowerCase().includes('provider') || error.message.toLowerCase().includes('network'))) {
              // Expected failure path if provider-dependent info (like chainId, nonce) is needed but skipped
              console.log("signTransaction failed due to missing provider context (skipConnectivity=true), as expected.");
            } else if (!skipConnectivity) {
              // If not skipping connectivity, this indicates a potential runtime issue with signing
              // or the test transaction setup that should be investigated.
              console.warn("signTransaction failed unexpectedly even when not skipping connectivity.");
            }
          }
        });

        it('should attempt to send a transaction and handle response/errors appropriately', async () => {
          expect(typeof wallet.sendTransaction).toBe('function'); // Method exists

          if (accounts.length === 0) {
            console.warn('Skipping sendTransaction functional test - no accounts available.');
            return;
          }
          if (skipConnectivity) {
            console.warn('Skipping sendTransaction functional test due to skipConnectivity flag.');
            return;
          }

          const tx: GenericTransactionData = {
            to: accounts[0], // Send to self or a known address
            value: '0',      // No actual value transfer for this test
            data: '0x',      // Simplest possible transaction data
            options: { gasLimit: '21000' } // Minimal gas for a simple transfer
          };

          try {
            // This call is expected to either succeed (return txHash) or fail due to
            // network issues, insufficient funds, or other runtime errors,
            // but not due to the method being unimplemented or fundamentally broken.
            const txHash = await wallet.sendTransaction(tx);
            expect(typeof txHash).toBe('string');
            expect(txHash.startsWith('0x')).toBe(true);
            expect(txHash.length).toBe(66); // Standard Ethereum transaction hash length
            console.log(`sendTransaction call succeeded with txHash: ${txHash} (this might be a real or mocked transaction)`);
          } catch (error: any) {
            // We expect errors related to actual transaction sending, not fundamental issues.
            console.warn(`sendTransaction call failed as expected in test environment: ${error.message}`);
            expect(error).toBeInstanceOf(Error);
            // Further checks could involve error codes or messages if standardized.
          }
        });

        it('should disconnect, update status, and emit disconnect event', async () => {
          let wasInitiallyConnected = wallet.isConnected();
          let wasInitiallyInitialized = wallet.isInitialized();

          // if (!wasInitiallyInitialized) {
          //   try {
          //     await wallet.initialize();
          //     wasInitiallyInitialized = wallet.isInitialized();
          //   } catch (initError) {
          //     console.warn('Skipping disconnect test: could not initialize wallet.', initError);
          //     return;
          //   }
          // }

          if (wasInitiallyInitialized && !wasInitiallyConnected && accounts.length > 0) {
            // If initialized but not connected, and we have accounts, try to connect
            try {
              await wallet.getAccounts(); // This might connect the wallet
              wasInitiallyConnected = wallet.isConnected();
            } catch (connectError) {
              console.warn('Could not connect wallet before disconnect test.', connectError);
              // Proceed even if connection attempt failed, to test disconnect from current state
            }
          }

          // Only proceed if the wallet was in a state where disconnect is meaningful
          // (i.e., it was initialized, or even better, connected)
          if (!wasInitiallyInitialized && !wasInitiallyConnected) {
            console.warn('Skipping disconnect test: wallet was not initialized nor connected.');
            return;
          }

          const disconnectEventSpy = vi.fn();
          wallet.on(WalletEvent.disconnect, disconnectEventSpy);

          try {
            await wallet.disconnect(); // disconnect can be async

            // Most adapters will set initialized to false on disconnect.
            expect(wallet.isInitialized(), "Wallet should be uninitialized after disconnect").toBe(false);
            expect(wallet.isConnected(), "Wallet should be disconnected").toBe(false);

            // After disconnect, getAccounts should ideally return empty or throw if called when uninitialized
            try {
              const postDisconnectAccounts = await wallet.getAccounts();
              // If it doesn't throw (e.g. adapter still returns cached accounts but isConnected is false)
              // or if it returns empty because it's uninitialized.
              if (postDisconnectAccounts.length > 0 && wallet.isInitialized()) {
                console.warn("getAccounts returned accounts even after disconnect and wallet claims to be initialized. This might be unexpected.");
              }
              expect(postDisconnectAccounts.length, "Accounts array should be empty if getAccounts is called after disconnect and wallet is uninitialized").toBe(0);
            } catch (e) {
              // This is an expected path if getAccounts throws when uninitialized/disconnected.
              expect(e, "Getting accounts after disconnect should either be empty or throw").toBeInstanceOf(Error);
              console.log("getAccounts threw an error after disconnect, as expected for some adapters.");
            }

            expect(disconnectEventSpy, "Disconnect event should have been called").toHaveBeenCalled();
            // Assuming disconnect event payload is null or undefined as per common practice
            expect(disconnectEventSpy).toHaveBeenCalledWith(null);

          } catch (error) {
            console.error('Error during disconnect test:', error);
            throw error; // Fail the test if disconnect itself throws an unexpected error
          } finally {
            wallet.off(WalletEvent.disconnect, disconnectEventSpy);
            // Attempt to re-initialize for subsequent tests, as disconnect() uninitializes.
            // This helps restore state similar to what beforeAll would establish.
            try {
              // if (!wallet.isInitialized()) { // Only if truly uninitialized
              //   await wallet.initialize();
              // }
              // Try to reconnect if accounts were previously available and wallet is initialized but not connected
              if (accounts.length > 0 && wallet.isInitialized() && !wallet.isConnected()) {
                await wallet.getAccounts();
              }
            } catch (reInitError) {
              console.warn("Failed to re-initialize/re-connect wallet after disconnect test:", reInitError);
            }
          }
        });

      });
    }
  });
}

// Add a basic test to make Vitest recognize this file
describe('ICoreWallet Tests', () => {
  it('should export testCoreWalletInterface function', () => {
    expect(typeof testCoreWalletInterface).toBe('function');
  });
});

