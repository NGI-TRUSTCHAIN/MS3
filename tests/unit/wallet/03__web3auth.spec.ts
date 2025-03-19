import { expect } from "chai";
import { Web3AuthWalletAdapter } from "@m3s/wallet";

describe("Web3AuthWalletAdapter", function() {
  this.timeout(5000);
  
  it("implements all required EVMWallet interface methods", function() {
    // Get the prototype of the actual implementation
    const prototype = Web3AuthWalletAdapter.prototype;
    
    // Core wallet methods
    const coreMethods = [
      'initialize',
      'isInitialized',
      'getWalletName',
      'getWalletVersion',
      'isConnected',
      'requestAccounts',
      'getAccounts',
      'on',
      'off',
      'getNetwork',
      'setProvider',
      'sendTransaction',
      'signTransaction',
      'signMessage',
      'signTypedData',
      'getGasPrice',
      'estimateGas',
      'getPrivateKey'
    ];
    
    // Verify all methods exist and are functions
    coreMethods.forEach(method => {
      expect(typeof (prototype as any)[method]).to.equal('function', 
        `Web3AuthWalletAdapter should implement ${method}()`);
    });
    
    // Web3Auth-specific methods
    expect(typeof prototype['disconnect']).to.equal('function',
      `Web3AuthWalletAdapter should implement disconnect()`);
  });
  
});