// import { expect } from "chai";
// import { ICoreWallet } from "@m3s/wallet";
// import { IEVMWallet } from "@m3s/wallet";
// import { WalletEvent } from "@m3s/wallet";
// import sinon from "sinon";

// /**
//  * Complete test suite for wallet adapters
//  */
// export class WalletValidator {
//   /**
//    * Test ICoreWallet interface compliance
//    */
//   static testCoreInterface(wallet: ICoreWallet) {
//     describe("ICoreWallet interface compliance", () => {
//       // Define all methods that must exist in the ICoreWallet interface
//       const coreMethods = [
//         'initialize', 'isInitialized', 'getWalletName', 'getWalletVersion',
//         'isConnected', 'requestAccounts', 'getAccounts', 'on', 'off',
//         'getNetwork', 'sendTransaction',
//         'signTransaction', 'signMessage'
//       ];

//       coreMethods.forEach(method => {
//         it(`implements ${method}()`, () => {
//           expect(wallet).to.have.property(method);
//           expect((wallet as any)[method]).to.be.a('function');
//         });
//       });
//     });
//   }

//   /**
//    * Test IEVMWallet interface compliance (includes core methods plus EVM-specific ones)
//    */
//   static testEVMInterface(wallet: IEVMWallet) {
//     // First test the core interface
//     this.testCoreInterface(wallet);

//     // Then test EVM-specific methods
//     describe("IEVMWallet interface compliance", () => {
//       const evmMethods = [
//         'signTypedData', 'getGasPrice', 'estimateGas'
//       ];

//       evmMethods.forEach(method => {
//         it(`implements ${method}()`, () => {
//           expect(wallet).to.have.property(method);
//           expect((wallet as any)[method]).to.be.a('function');
//         });
//       });
//     });
//   }

//   /**
//    * Test core behavior functionality
//    */
//   static testCoreBehavior(wallet: ICoreWallet) {
//     describe("CoreWallet behavior", () => {
//       it("returns correct initialization state", () => {
//         const initialized = wallet.isInitialized();
//         expect(initialized).to.be.a('boolean');
//       });

//       it("returns a wallet name", () => {
//         const name = wallet.getWalletName();
//         expect(name).to.be.a('string');
//         expect(name.length).to.be.greaterThan(0);
//       });

//       it("returns a wallet version", () => {
//         const version = wallet.getWalletVersion();
//         expect(version).to.be.a('string');
//         expect(version.length).to.be.greaterThan(0);
//       });

//       it("returns connection status", () => {
//         const connected = wallet.isConnected();
//         expect(connected).to.be.a('boolean');
//       });

//       it("can get accounts", async function () {
//         const accounts = await wallet.getAccounts();
//         expect(accounts).to.be.an('array');
//         if (wallet.isConnected()) {
//           expect(accounts.length).to.be.at.least(1);
//           expect(accounts[0]).to.match(/^0x[0-9a-fA-F]{40}$/);
//         }
//       });

//       it("can request accounts", async () => {
//         const accounts = await wallet.requestAccounts();
//         expect(accounts).to.be.an('array');
//         if (wallet.isConnected()) {
//           expect(accounts.length).to.be.at.least(1);
//           expect(accounts[0]).to.match(/^0x[0-9a-fA-F]{40}$/);
//         }
//       });

//       it("supports event registration", () => {
//         const callback = sinon.spy();
//         wallet.on(WalletEvent.accountsChanged, callback);
//         wallet.off(WalletEvent.accountsChanged, callback);
//         // Just verifying it doesn't throw
//         expect(true).to.be.true;
//       });

//       it("can get network information if connected", async function () {
//         try {
//           const network = await wallet.getNetwork();
//           expect(network).to.have.property('chainId');
//           expect(network.chainId).to.be.a('string');
//         } catch (error: any) {
//           // Check if it's an RPC error and skip if so
//           if (error.message.includes('403 Forbidden') ||
//               error.message.includes('503 Service') ||
//               error.message.includes('failed to detect network') ||
//               error.message.includes('Provider not set') ||
//               error.message.includes('AdapterError in getNetwork: Provider not set')) {
//             console.warn('Network test skipped due to RPC endpoint issues');
//             this.skip();
//           } else {
//             throw error; // Re-throw if it's another kind of error
//           }
//         }
//       });

//       it("can sign messages if connected", async function () {
//         if (!wallet.isConnected()) {
//           this.skip();
//           return;
//         }

//         const message = "Test message for signing";
//         const signature = await wallet.signMessage(message);
//         expect(signature).to.be.a('string');
//         expect(signature).to.match(/^0x[0-9a-fA-F]+$/);
//       });

//       it("can sign transactions if connected", async function () {
//         if (!wallet.isConnected()) {
//           this.skip();
//           return;
//         }

//         const tx = {
//           to: "0x0000000000000000000000000000000000000000",
//           value: "0.0001"
//         };

//         const signedTx = await wallet.signTransaction(tx);
//         expect(signedTx).to.be.a('string');
//         expect(signedTx).to.match(/^0x[0-9a-fA-F]+$/);
//       });
//     });
//   }

//   /**
//    * Test EVM-specific behavior
//    */
//   static testEVMBehavior(wallet: IEVMWallet) {
//     // First test core behavior
//     this.testCoreBehavior(wallet);

//     // Then test EVM-specific behavior
//     describe("EVM-specific behavior", () => {
//       it("can get gas price if connected", async function () {
//         const gasPrice = await wallet.getGasPrice();
//         expect(gasPrice).to.be.a('string');
//         expect(parseInt(gasPrice)).to.be.a('number');
//       });

//       it("can estimate gas if connected", async function () {
//         const tx = {
//           to: "0x0000000000000000000000000000000000000000",
//           value: "0.0001"
//         };

//         const gasEstimate = await wallet.estimateGas(tx);
//         expect(gasEstimate).to.be.a('string');
//         expect(parseInt(gasEstimate)).to.be.a('number');
//       });

//       it("can sign typed data if connected", async function () {
//         if (!wallet.isConnected()) {
//           this.skip();
//           return;
//         }

//         const typedData = {
//           domain: {
//             name: 'Test Domain',
//             version: '1',
//             chainId: 1,
//             verifyingContract: '0x0000000000000000000000000000000000000000'
//           },
//           types: {
//             Person: [
//               { name: 'name', type: 'string' },
//               { name: 'wallet', type: 'address' }
//             ]
//           },
//           value: {
//             name: 'Test User',
//             wallet: '0x0000000000000000000000000000000000000000'
//           }
//         };

//         const signature = await wallet.signTypedData(typedData);
//         expect(signature).to.be.a('string');
//         expect(signature).to.match(/^0x[0-9a-fA-F]+$/);
//       });
//     });
//   }

//   /**
//    * Test error handling for core wallet functionality
//    */
//   static testCoreErrorHandling(wallet: ICoreWallet) {
//     describe("Core error handling", () => {
//       it("handles invalid transactions", async () => {
//         try {
//           await wallet.signTransaction({} as any);
//           expect.fail("Should have thrown error");
//         } catch (error) {
//           expect(error).to.exist;
//         }
//       });
//     });
//   }

//   /**
//    * Test error handling for EVM wallet functionality
//    */
//   static testEVMErrorHandling(wallet: IEVMWallet) {
//     // First test core error handling
//     this.testCoreErrorHandling(wallet);

//     // Then test EVM-specific error handling
//     describe("EVM error handling", () => {
//       it("handles invalid typed data", async () => {
//         try {
//           await wallet.signTypedData({} as any);
//           expect.fail("Should have thrown error");
//         } catch (error) {
//           expect(error).to.exist;
//         }
//       });
//     });
//   }

//   /**
//    * Run all tests for a core wallet
//    */
//   static testCoreWallet(wallet: ICoreWallet) {
//     this.testCoreInterface(wallet);
//     this.testCoreBehavior(wallet);
//     this.testCoreErrorHandling(wallet);
//   }

//   /**
//    * Run all tests for an EVM wallet
//    */
//   static testEVMWallet(wallet: IEVMWallet) {
//     this.testEVMInterface(wallet);
//     this.testEVMBehavior(wallet);
//     this.testEVMErrorHandling(wallet);
//   }
// }