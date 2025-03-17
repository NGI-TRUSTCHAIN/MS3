import { expect } from "chai";
import { adapterRegistry } from "../../../../packages/wallet/src/adapters";

describe("Adapter Validation", function() {
  this.timeout(5000); // Set timeout to 5s to match other tests

  it("should register adapters correctly", function() {
    const adapters = adapterRegistry.getAllAdapters();
    expect(adapters).to.be.an('array');
    
    // You should have at least one adapter
    expect(adapters.length).to.be.greaterThan(0);
    
    // Check adapter structure
    adapters.forEach((adapter: any) => {
      expect(adapter).to.have.property('name').that.is.a('string');
      expect(adapter).to.have.property('adapterType').that.is.a('string');
      expect(adapter).to.have.property('adapterClass').that.is.a('function');
      expect(adapter).to.have.property('requirements').that.is.an('array');
    });
  });
  
  it("should verify adapter class structure", function() {
    const adapters = adapterRegistry.getAllAdapters();
    
    adapters.forEach((adapter: any) => {
      const AdapterClass = adapter.adapterClass;
      
      // Skip actual instantiation but verify the class structure
      const prototype = AdapterClass.prototype;
      
      // Core wallet methods
      expect(prototype).to.have.property('initialize').that.is.a('function');
      expect(prototype).to.have.property('getWalletName').that.is.a('function');
      expect(prototype).to.have.property('getWalletVersion').that.is.a('function');
      expect(prototype).to.have.property('isConnected').that.is.a('function');
      expect(prototype).to.have.property('requestAccounts').that.is.a('function');
      expect(prototype).to.have.property('getAccounts').that.is.a('function');
      expect(prototype).to.have.property('on').that.is.a('function');
      expect(prototype).to.have.property('off').that.is.a('function');
      expect(prototype).to.have.property('getNetwork').that.is.a('function');
      expect(prototype).to.have.property('switchNetwork').that.is.a('function');
      expect(prototype).to.have.property('sendTransaction').that.is.a('function');
      expect(prototype).to.have.property('signTransaction').that.is.a('function');
      expect(prototype).to.have.property('signMessage').that.is.a('function');
      
      // For EVM adapters, check EVM-specific methods
      if (adapter.adapterType === 'evm') {
        expect(prototype).to.have.property('signTypedData').that.is.a('function');
        expect(prototype).to.have.property('getGasPrice').that.is.a('function');
        expect(prototype).to.have.property('estimateGas').that.is.a('function');
      }
    });
  });
  
  it("should verify adapter requirements match registration", function() {
    const adapters = adapterRegistry.getAllAdapters();
    
    adapters.forEach((adapter: any) => {
      const AdapterClass = adapter.adapterClass;
      const requirements = adapter.requirements || [];
      
      // Check if we have the web3auth adapter
      if (adapter.name === "web3auth") {
        expect(requirements).to.include("web3authConfig");
        expect(adapter.adapterType).to.equal("evm");
      }
    });
  });
});