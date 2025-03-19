import { Web3AuthNoModal } from "@web3auth/no-modal";
import { CustomChainConfig, WEB3AUTH_NETWORK_TYPE, WALLET_ADAPTERS } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers, BrowserProvider } from "ethers";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { EVMWallet } from "../types";


interface args  {
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
  private config: args;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Static factory method for creating and initializing an adapter in one step
   * @param args Configuration parameters
   * @returns A fully initialized Web3AuthWalletAdapter instance
   */
  static async create(args: args): Promise<Web3AuthWalletAdapter> {
    const adapter = new Web3AuthWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  constructor(args: args) {
    this.config = args;
    console.log("Web3AuthWalletAdapter created (no-modal)", args);
  }

  /**
   * Initialize the Web3AuthNoModal instance with the provided configuration.
   */
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
      (this.ethersProvider as any) =
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

  // Implement proper event handling
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  // Optionally, if getPrivateKey is part of your interface, add it:
  async getPrivateKey(): Promise<string> {
    console.log("getPrivateKey is not supported in Web3AuthWalletAdapter", this.web3auth!.getUserInfo())
    const privateKey = <string> await this.web3auth!.provider!.request({
      method: "eth_private_key"
    });
    console.log("privateKey", privateKey)

    return privateKey;
  }
}

// Export with the same name the Implemented API.
export interface API extends EVMWallet {};
