import { expect } from "chai";
import { createWallet } from "@m3s/wallet";
import { JsonRpcProvider } from "ethers";

describe("EVMWalletAdapter", function() {
  this.timeout(10000);
  let walletInstance: any;
  let provider;
  
  before(async function() {
    // Use a deterministic private key for tests
    const privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
    provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    walletInstance = createWallet("evmWallet", undefined, provider, privateKey);
    
    await walletInstance.initialize();
  });

  it("implements CoreWallet interface", function() {
    // Base wallet methods
    expect(walletInstance).to.have.property('initialize');
    expect(walletInstance).to.have.property('getWalletName');
    expect(walletInstance).to.have.property('getWalletVersion');
    expect(walletInstance).to.have.property('isConnected');
    expect(walletInstance).to.have.property('requestAccounts');
    expect(walletInstance).to.have.property('getAccounts');
    expect(walletInstance).to.have.property('on');
    expect(walletInstance).to.have.property('off');
    expect(walletInstance).to.have.property('getNetwork');
    expect(walletInstance).to.have.property('switchNetwork');
    expect(walletInstance).to.have.property('sendTransaction');
    expect(walletInstance).to.have.property('signTransaction');
    expect(walletInstance).to.have.property('signMessage');
  });

  it("implements EVMWallet interface", function() {
    // EVM-specific methods
    expect(walletInstance).to.have.property('signTypedData');
    expect(walletInstance).to.have.property('getGasPrice');
    expect(walletInstance).to.have.property('estimateGas');
  });

  it("can retrieve private key", function() {
    // Access the adapter directly for testing adapter-specific methods
    const adapter = walletInstance.adapter;
    expect(adapter).to.have.property('getPrivateKey');
    
    // This should return a valid hex private key
    const privateKey = adapter.getPrivateKey();
    expect(privateKey).to.match(/^0x[0-9a-fA-F]{64}$/);
  });
  
  it("can get accounts", async function() {
    // Skip accessing wallet.address directly and just test getAccounts()
    const accounts = await walletInstance.getAccounts();
    expect(accounts).to.be.an('array');
    expect(accounts).to.have.length(1);
    expect(accounts[0]).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});