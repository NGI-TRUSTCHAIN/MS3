import { expect } from "chai";
import { Web3AuthWalletAdapter } from "../../../../packages/wallet/src/adapters/web3authWallet";
import sinon from "sinon";

describe("Web3AuthWalletAdapter", function() {
  this.timeout(5000);
  let adapter: any;
  const mockConfig: any = {
    clientId: "test-client-id",
    web3AuthNetwork: "testnet",
    chainConfig: {
      chainNamespace: "eip155",
      chainId: "0x1",
      rpcTarget: "https://test.rpc"
    },
    loginConfig: {
      loginProvider: "google"
    }
  };
  
  beforeEach(function() {
    // Creating the adapter without calling initialize()
    adapter = new Web3AuthWalletAdapter(mockConfig);
    
    // Mock any browser-specific APIs or methods that might be used
    global.window = global.window || {};
    
    // Stub initialize to prevent actual Web3Auth initialization
    sinon.stub(adapter, "initialize").resolves();
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  it("should be properly configured", function() {
    expect(adapter.getWalletName()).to.equal("Web3AuthWallet");
    expect(adapter.getWalletVersion()).to.be.a("string");
    expect(adapter.isConnected()).to.be.false;
  });
  
  it("should implement required EVMWallet interface methods", function() {
    // Verify method existence
    expect(adapter).to.have.property('signTypedData').that.is.a('function');
    expect(adapter).to.have.property('getGasPrice').that.is.a('function');
    expect(adapter).to.have.property('estimateGas').that.is.a('function');
    
    // Verify core methods
    expect(adapter).to.have.property('sendTransaction').that.is.a('function');
    expect(adapter).to.have.property('signMessage').that.is.a('function');
    expect(adapter).to.have.property('requestAccounts').that.is.a('function');
  });
});