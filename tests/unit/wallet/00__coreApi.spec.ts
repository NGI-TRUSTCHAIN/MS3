import { expect } from "chai";
import { createWallet } from "@m3s/wallet";
import { JsonRpcProvider } from "ethers";

// Silence logs for cleaner test output
const originalConsoleLog = console.log;
before(() => {
  console.log = function(...args) {
    if (process.env.DEBUG) {
      originalConsoleLog(...args);
    }
  };
});

after(() => {
  console.log = originalConsoleLog;
});

describe("Core Wallet API", function () {
  this.timeout(10000);

  it("should expose factory method for wallet types", function () {
    expect(createWallet).to.be.a('function');
  });

  it("should create appropriate wallet instance based on adapter type", async function () {
    // Create EVM wallet
    const evmWallet = await createWallet({ adapterName: 'evmWallet'});
    expect(await evmWallet.getWalletName()).to.equal("EvmWalletAdapter");

    // Create with provider
    const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    
    const evmWalletWithProvider = await createWallet({ 
      adapterName: 'evmWallet', 
      provider
    });

    expect(await evmWalletWithProvider.isConnected()).to.be.true;
  });

  it("should throw appropriate errors for invalid adapter names", async function () {
    try {
      await createWallet({ adapterName: 'nonExistentAdapter' });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).to.include("Unknown adapter");
    }
  });

  // Tests that verify interfaces match implementations
  describe("Interface definition validation", function() {
    it("verifies ICoreWallet interface has all required methods", function () {
      const requiredMethods = [
        'initialize', 'isInitialized', 'getWalletName', 'getWalletVersion',
        'isConnected', 'requestAccounts', 'getAccounts', 'on', 'off',
        'getNetwork', 'switchNetwork', 'sendTransaction', 'signTransaction', 
        'signMessage'
      ];
      
      // Create a core wallet to test interface
      createWallet({ adapterName: 'mockedWallet' }).then(wallet => {
        requiredMethods.forEach(method => {
          expect(wallet).to.have.property(method);
          expect((wallet as any)[method]).to.be.a('function');
        });
      });
    });
    
    it("verifies EVMWallet interface extends ICoreWallet correctly", function () {
      const evmSpecificMethods = [
        'signTypedData', 'getGasPrice', 'estimateGas'
      ];
      
      // Create an EVM wallet to test interface
      createWallet({ adapterName: 'evmWallet' }).then(wallet => {
        evmSpecificMethods.forEach(method => {
          expect(wallet).to.have.property(method);
          expect((wallet as any)[method]).to.be.a('function');
        });
      });
    });
  });
});