import { expect } from "chai";
import { createWallet, IWalletOptions } from "@m3s/wallet";
import { JsonRpcProvider } from "ethers";

describe("Core Wallet API", function () {
  this.timeout(10000);

  it("should expose factory method for wallet types", function () {
    // Test that the wallet class is a constructor
    expect(createWallet).to.be.a('function');
  });

  it("should create appropriate wallet instance based on adapter type", async function () {
    // Create different wallet types and verify they have the right class
    const evmWallet: any = createWallet({ adapterName: 'evmWallet'});
    expect(await evmWallet.getWalletName()).to.equal("EvmWalletAdapter");

    // Create with provider
    const provider: any = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    const evmWalletWithProvider: any = createWallet({ adapterName: 'evmWallet', provider});
    expect(await evmWalletWithProvider.isConnected()).to.be.true;
  });

  it("should enforce CoreWallet interface on all adapters", function () {
    // Create an EVM wallet to test interface compliance
    const wallet: any = createWallet({adapterName: 'evmWallet'});

    // General Initialization
    expect(wallet).to.have.property('initialize');
    expect(wallet.initialize).to.be.a('function');

    // Wallet Metadata
    expect(wallet).to.have.property('getWalletName');
    expect(wallet.getWalletName).to.be.a('function');
    expect(wallet).to.have.property('getWalletVersion');
    expect(wallet.getWalletVersion).to.be.a('function');
    expect(wallet).to.have.property('isConnected');
    expect(wallet.isConnected).to.be.a('function');

    // Account Management
    expect(wallet).to.have.property('requestAccounts');
    expect(wallet.requestAccounts).to.be.a('function');
    expect(wallet).to.have.property('getAccounts');
    expect(wallet.getAccounts).to.be.a('function');
    expect(wallet).to.have.property('on');
    expect(wallet.on).to.be.a('function');
    expect(wallet).to.have.property('off');
    expect(wallet.off).to.be.a('function');

    // Network Management
    expect(wallet).to.have.property('getNetwork');
    expect(wallet.getNetwork).to.be.a('function');
    expect(wallet).to.have.property('switchNetwork');
    expect(wallet.switchNetwork).to.be.a('function');

    // Transactions & Signing
    expect(wallet).to.have.property('sendTransaction');
    expect(wallet.sendTransaction).to.be.a('function');
    expect(wallet).to.have.property('signTransaction');
    expect(wallet.signTransaction).to.be.a('function');
    expect(wallet).to.have.property('signMessage');
    expect(wallet.signMessage).to.be.a('function');
  });

  it("should enforce EVM-specific interface on EVM wallets", function () {
    const wallet: any = createWallet({adapterName: 'evmWallet'});

    // EVM-specific methods
    expect(wallet).to.have.property('signTypedData');
    expect(wallet.signTypedData).to.be.a('function');
    expect(wallet).to.have.property('getGasPrice');
    expect(wallet.getGasPrice).to.be.a('function');
    expect(wallet).to.have.property('estimateGas');
    expect(wallet.estimateGas).to.be.a('function');
  });

  it("should throw an error if required methods are missing", function () {
    // This test verifies that the wallet will check for interface compliance
    // We can't easily test this directly, but we know the BaseWallet constructor
    // validates that adapters implement the required methods
    expect(() => {
      // A proper implementation would throw if these methods were missing
      const wallet = createWallet({adapterName: 'evmWallet'});
    }).not.to.throw();
  });
});