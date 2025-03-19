import { expect } from "chai";
import { createWallet } from "@m3s/wallet";
import { JsonRpcProvider } from "ethers";
import { WalletValidator } from "../../scripts/wallet-tester.js";

describe("MockedWalletAdapter", function () {
  this.timeout(5000);
  let walletInstance: any;

  before(async function () {
    walletInstance = await createWallet({
      adapterName: "mockedWallet",
      provider: new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com")
    });
  });

  // Interface and behavior tests
  describe("interface compliance", function () {
    it("implements the ICoreWallet interface", function () {
      WalletValidator.testCoreInterface(walletInstance);
    });
  });

  describe("behavior verification", function () {
    it("behaves according to the ICoreWallet specification", function () {
      WalletValidator.testCoreBehavior(walletInstance);
    });
  });

  // MockedWallet-specific tests
  describe("mocked wallet features", function () {
    it("generates random addresses on creation", async function () {
      const wallet1 = await createWallet({ adapterName: "mockedWallet" });
      const wallet2 = await createWallet({ adapterName: "mockedWallet" });

      const accounts1 = await wallet1.getAccounts();
      const accounts2 = await wallet2.getAccounts();

      expect(accounts1[0]).to.not.equal(accounts2[0]);
    });
  });
});