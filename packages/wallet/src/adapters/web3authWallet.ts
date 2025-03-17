import { Web3AuthNoModal } from "@web3auth/no-modal";
import { CustomChainConfig, WEB3AUTH_NETWORK_TYPE, WALLET_ADAPTERS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers, BrowserProvider } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { EVMWallet } from "../types/interfaces/EVM";

export type Web3AuthConfig = {
  clientId: string;
  web3AuthNetwork: WEB3AUTH_NETWORK_TYPE;
  chainConfig: CustomChainConfig;
  loginConfig: Record<string, any>;
};

/**
 * Web3AuthWalletAdapter is an implementation of the EVMWallet interface using Web3AuthNoModal.
 * It provides methods to initialize the wallet, connect to a provider, and perform various
 * wallet operations such as sending transactions, signing messages, and retrieving account information.
 */
export class Web3AuthWalletAdapter implements EVMWallet {
  private web3auth: Web3AuthNoModal | null = null;
  private provider: any = null;
  private ethersProvider: BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private accounts: string[] = [];
  private initialized = false;
  private config: Web3AuthConfig;

  constructor(config: Web3AuthConfig) {
    this.config = config;
    console.log("Web3AuthWalletAdapter created (no-modal)", config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
  
    // Create the private key provider.
    const privateKeyProvider = new EthereumPrivateKeyProvider({
      config: { chainConfig: this.config.chainConfig }
    });
  
    console.log("Initializing Web3AuthNoModal...");
    this.web3auth = new Web3AuthNoModal({
      clientId: this.config.clientId,
      web3AuthNetwork: this.config.web3AuthNetwork, // or "network" as needed by the underlying lib
      chainConfig: this.config.chainConfig,
      privateKeyProvider
    });
  
    // Configure the openlogin adapter.
    const authAdapter = new AuthAdapter({
      adapterSettings: {
        clientId: this.config.clientId,
        loginConfig: this.config.loginConfig
      }
    });
    
    this.web3auth.configureAdapter(authAdapter);
  
    await this.web3auth.init();
    this.initialized = true;
  }

  setProvider(provider: BrowserProvider): void {
    this.ethersProvider = provider;
  }

  getProvider(): BrowserProvider | null {
    return this.ethersProvider;
  }

  getWalletName(): string {
    return "Web3AuthWallet";
  }

  getWalletVersion(): string {
    return "1.0.0";
  }

  isConnected(): boolean {
    return !!this.provider;
  }

  async requestAccounts(): Promise<string[]> {
    if (!this.provider) {
      let web3authProvider: any = null;
      if (this.web3auth && typeof this.web3auth.connectTo === "function") {
        // Use the forwarded login configuration rather than hardcoding values.
        const loginProvider = this.config.loginConfig.loginProvider; // e.g. "google"
        web3authProvider = await this.web3auth.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });
      } else {
        throw new Error("No connection method available on the Web3Auth instance.");
      }
      if (!web3authProvider || !this.web3auth?.connected) {
        throw new Error("Web3Auth did not return a provider after login.");
      }
      this.provider = web3authProvider;
      (this.ethersProvider as any)  =
        web3authProvider instanceof ethers.JsonRpcProvider
          ? web3authProvider
          : new ethers.BrowserProvider(web3authProvider);
      this.signer = await this.ethersProvider!.getSigner();
      const address = await this.signer!.getAddress();
      this.accounts = [address];
    }
    return this.accounts;
  }

  async getAccounts(): Promise<string[]> {
    if (this.accounts.length === 0) return this.requestAccounts();
    return this.accounts;
  }

  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.provider || !this.ethersProvider) {
      throw new Error("Provider not set");
    }
    const network = await this.ethersProvider.getNetwork();
    return { chainId: String(network.chainId), name: network.name };
  }

  async switchNetwork(chainId: string): Promise<boolean> {
    console.warn("Network switching is not supported in Web3Auth");
    return false;
  }

  async sendTransaction(tx: any): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not available. Please connect first");
    }
    const transaction = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x"
    };
    const response = await this.signer.sendTransaction(transaction);
    return response.hash;
  }

  async signTransaction(tx: any): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not available. Please connect first");
    }
    const transaction = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x",
      gasLimit: 21000n
    };
    return await this.signer.signTransaction(transaction);
  }

  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not available. Please connect first");
    }
    return await this.signer.signMessage(message);
  }

  async signTypedData(data: { domain: any; types: any; value: any }): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not available. Please connect first");
    }
    return await this.signer.signTypedData(data.domain, data.types, data.value);
  }

  async getGasPrice(): Promise<string> {
    if (!this.ethersProvider) throw new Error("Provider not set");
    const feeData = await this.ethersProvider.getFeeData();
    if (!feeData.gasPrice) throw new Error("gasPrice not available");
    return feeData.gasPrice.toString();
  }

  async estimateGas(tx: { to: string; value: string; data?: string }): Promise<string> {
    if (!this.ethersProvider) throw new Error("Provider not set");
    const gasEstimate = await this.ethersProvider.estimateGas({
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x"
    });
    return gasEstimate.toString();
  }

  async disconnect(): Promise<void> {
    if (this.web3auth) await this.web3auth.logout();
    this.provider = null;
    this.ethersProvider = null;
    this.signer = null;
    this.accounts = [];
  }

  // Implementing on/off as no-ops so that the adapter meets the CoreWallet interface.
  on(event: string, callback: (...args: any[]) => void): void {
    console.warn(`Web3AuthWalletAdapter.on(${event}) not implemented in no-modal mode.`);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    console.warn(`Web3AuthWalletAdapter.off(${event}) not implemented in no-modal mode.`);
  }

  // Optionally, if getPrivateKey is part of your interface, add it:
  getPrivateKey(): string {
    throw new Error("getPrivateKey is not supported in Web3AuthWalletAdapter");
  }
}