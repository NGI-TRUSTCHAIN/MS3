import { expect } from "chai";
import { describe, it } from "node:test";
import { adapterRegistry } from "packages/wallet/src/adapters";

describe("Adapter Validation", () => {
  it("should register adapters correctly", () => {
    const adapters = adapterRegistry.getAllAdapters();
    expect(adapters).to.be.an('array');
    
    // You should have at least the test adapter
    expect(adapters.length).to.be.greaterThan(0);
    
    // Check adapter structure
    adapters.forEach(adapter => {
      expect(adapter).to.have.property('name').that.is.a('string');
      expect(adapter).to.have.property('adapterType').that.is.a('string');
      expect(adapter).to.have.property('adapterClass').that.is.a('function');
      expect(adapter).to.have.property('requirements').that.is.an('array');
    });
  });
  
  it("should implement required interfaces", () => {
    const adapters = adapterRegistry.getAllAdapters();
    
    adapters.forEach(adapter => {
      const AdapterClass = adapter.adapterClass;
      const instance = new AdapterClass();
      
      // Test core wallet methods
      expect(instance).to.have.property('initialize').that.is.a('function');
      expect(instance).to.have.property('getWalletName').that.is.a('function');
      expect(instance).to.have.property('getWalletVersion').that.is.a('function');
      expect(instance).to.have.property('isConnected').that.is.a('function');
      expect(instance).to.have.property('requestAccounts').that.is.a('function');
      expect(instance).to.have.property('getAccounts').that.is.a('function');
      expect(instance).to.have.property('on').that.is.a('function');
      expect(instance).to.have.property('off').that.is.a('function');
      expect(instance).to.have.property('getNetwork').that.is.a('function');
      expect(instance).to.have.property('switchNetwork').that.is.a('function');
      expect(instance).to.have.property('sendTransaction').that.is.a('function');
      expect(instance).to.have.property('signTransaction').that.is.a('function');
      expect(instance).to.have.property('signMessage').that.is.a('function');
      
      // For EVM adapters, check EVM-specific methods
      if (adapter.adapterType === 'evm') {
        expect(instance).to.have.property('signTypedData').that.is.a('function');
        expect(instance).to.have.property('getGasPrice').that.is.a('function');
        expect(instance).to.have.property('estimateGas').that.is.a('function');
      }
    });
  });
});