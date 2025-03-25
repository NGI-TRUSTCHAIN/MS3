import { ethers, Wallet as EthersWallet, Provider } from "ethers";
import { ICoreWallet } from "../types/index.js";

interface args {
  privateKey?: string,
  provider?: Provider
}

/**
 * The `MockedWalletAdapter` class implements the `ICoreWallet` interface and provides a mock wallet adapter for testing purposes.
 * It uses the `ethers` library to manage wallet operations and can be initialized with a private key and provider.
 * 
 * @remarks
 * This class is designed to handle both old and new parameter styles for initialization. If the `privateKey` is not provided,
 * a new wallet will be generated using `ethers.Wallet.createRandom()`.
 * 
 * @example
 * ```typescript
 * const walletAdapter = await MockedWalletAdapter.create({ privateKey: 'your-private-key', provider: yourProvider });
 * ```
 * 
 * @public
 */
export class MockedWalletAdapter implements ICoreWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  /** General Initialization */

  /**
  * Creates an instance of EvmWalletAdapter.
  * 
  * @param args - The arguments to create the wallet adapter.
  * @param args.privateKey - The private key for the wallet. If not provided, a new wallet will be generated.
  * @param args.provider - The provider to be used with the wallet.
  * 
  * @remarks
  * This constructor handles both old and new parameter styles. If the `privateKey` is not provided,
  * a new wallet will be generated using `ethers.Wallet.createRandom()`.
  * 
  * @example
  * ```typescript
  * const walletAdapter = new EvmWalletAdapter({ privateKey: 'your-private-key', provider: yourProvider });
  * ```
  */
  private constructor(args: args) {
    const { privateKey, provider } = args;
    // Handle both old and new parameter styles

    if (!privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
    } else {
      this.privateKey = privateKey;
    }

    if (provider) {
      this.provider = provider;
    }

    console.log("EvmWalletAdapter created. PrivateKey:", this.privateKey);
  }

  /**
 * Static factory method for creating and initializing an adapter in one step
 * @param args Configuration parameters
 * @returns A fully initialized EvmWalletAdapter instance
 */
  static async create(args: args): Promise<MockedWalletAdapter> {
    const adapter = new MockedWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  /**
    * Initialize the wallet adapter
    * @returns The adapter instance for chaining
    */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.wallet = new ethers.Wallet(this.privateKey);

    if (this.provider) {
      this.wallet = this.wallet.connect(this.provider);
    }
    this.initialized = true;
  }

  /**
   * Checks if the wallet has been initialized.
   *
   * @returns {boolean} - Returns `true` if the wallet is initialized, otherwise `false`.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Disconnects the wallet by setting the provider to null.
   */
  disconnect(): void {
    this.provider = undefined;
    this.wallet = undefined as any;
    this.initialized = false;
  }

  /** Wallet Metadata */

  /**
   * Retrieves the name of the wallet adapter.
   *
   * @returns {string} The name of the wallet adapter.
   */
  getWalletName(): string {
    return "MockedWalletAdapter";
  }

  /**
   * Retrieves the version of the wallet.
   *
   * @returns {string} The version of the wallet as a string.
   */
  getWalletVersion(): string {
    return "1.0.0";
  }

  /**
   * Checks if the wallet is connected.
   *
   * @returns {boolean} - Returns `true` if both the provider and wallet's provider are available, otherwise `false`.
   */
  isConnected(): boolean {
    return !!this.provider && !!this.wallet?.provider;
  }

  /** Account Management */

  /**
   * Requests the list of accounts from the wallet.
   * 
   * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
   * 
   * @emits WalletEvent#accountsChanged - Emits an event when the accounts have changed.
   */
  async requestAccounts(): Promise<string[]> {
    const accounts = [this.wallet.address];
    return accounts;
  }

  /**
   * Retrieves the private key.
   *
   * @returns {Promise<string>} A promise that resolves to the private key as a string.
   */
  async getPrivateKey(): Promise<string> {
    return this.privateKey;
  }

  /**
   * Retrieves the list of account addresses associated with the wallet.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of account addresses.
   */
  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  /**
   * Retrieves the balance of the specified account.
   *
   * @param account - The account address to check the balance for. If not provided, uses the first account.
   * @returns {Promise<string>} A promise that resolves to the balance as a string.
   */
  async getBalance(account?: string): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set. Call setProvider() first.");
    }
    const address = account || this.wallet.address;
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Verifies the correctness of a signature for a given message.
   *
   * @param message - The message to verify the signature against.
   * @param signature - The signature to verify.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the signature is valid, otherwise `false`.
   */
  async verifySignature(message: string, signature: string): Promise<boolean> {
    const address = ethers.verifyMessage(message, signature);
    return address === this.wallet.address;
  }

  /**
   * Registers an event listener for the specified event.
   *
   * @param event - The event to listen for.
   * @param callback - The callback function to be invoked when the event is triggered.
   */
  on(event: any, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Removes a previously registered event listener for the specified event.
   *
   * @param event - The event for which the listener should be removed.
   * @param callback - The callback function that was registered as the listener.
   */
  off(event: any, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }


  /** Network Management */
  /**
   * Retrieves the network information from the provider.
   * 
   * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
   * @throws If the provider is not set.
   */
  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }
    const network = await this.provider.getNetwork();
    return { chainId: String(network.chainId), name: network.name };
  }

  /**
  * Sets the provider for the wallet and connects the wallet to the new provider if it exists.
  *
  * @param provider - The provider to set for the wallet.
  */
  async setProvider(provider: Provider): Promise<void> {
    this.provider = provider;
    // Add defensive check
    if (this.wallet) {
      this.wallet = await this.wallet.connect(provider);
    }
  }

  /** Transactions & Signing */
  async sendTransaction(tx: any): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set. Call setProvider() first.");
    }
    if (!tx.to) {
      throw new Error("Transaction object missing 'to' address");
    }
    // Convert value if fractional string provided.
    const txValue =
      typeof tx.value === "string" && tx.value.includes(".")
        ? ethers.parseEther(tx.value).toString()
        : tx.value;
    const response = await this.wallet.sendTransaction({
      to: tx.to,
      value: txValue,
      data: tx.data || "0x",
    });
    return response.hash;
  }

  async signTransaction(tx: any): Promise<string> {
    const populatedTx = {
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value) : 0n,
      data: tx.data || "0x",
      gasLimit: 21000n
    };
    return await this.wallet.signTransaction(populatedTx);
  }

  async signMessage(message: string): Promise<string> {
    return await this.wallet.signMessage(message);
  }

}