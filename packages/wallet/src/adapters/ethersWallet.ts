import { ethers, Provider, Wallet as EthersWallet, JsonRpcProvider } from "ethers";
import { IEVMWallet } from "../types/interfaces/EVM/index.js";
import { TransactionData, WalletEvent } from "../types/index.js";

// Define always the constructor arguments in a type.
interface args {
  provider?: Provider,
  options?: {
    privateKey?: string,
  }
}

export class EvmWalletAdapter implements IEVMWallet {
  private wallet!: EthersWallet;
  private provider?: Provider;
  private privateKey: string;
  public initialized: boolean = false;
  private eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

  /** General Initialization */

  /**
   * Creates an instance of the EvmWalletAdapter.
   * 
   * @param args - The arguments required to create the wallet adapter.
   * @param args.privateKey - The private key for the wallet. If not provided, a new wallet will be generated.
   * @param args.provider - The provider to be used with the wallet. Optional.
   * 
   * @remarks
   * - If `privateKey` is not provided, a new wallet will be generated using `ethers.Wallet.createRandom()`.
   * - If `provider` is provided, it will be assigned to the instance.
   * 
   * @example
   * ```typescript
   * const adapter = new EvmWalletAdapter({ privateKey: 'your-private-key', provider: yourProvider });
   * ```
   */
  private constructor(args: args) {
    const { options, provider: optionsProvider } = args;
    // Handle both old and new parameter styles

    if (!options?.privateKey) {
      const generatedWallet = ethers.Wallet.createRandom();
      this.privateKey = generatedWallet.privateKey;
    } else {
      this.privateKey = options?.privateKey;
    }

    if (optionsProvider) {
      this.provider = optionsProvider;
    }

    console.log("EvmWalletAdapter created. PrivateKey:", this.privateKey);
  }

  /**
   * Creates a new instance of EvmWalletAdapter.
   *
   * @param {args} args - The arguments required to create the EvmWalletAdapter instance.
   * @returns {Promise<EvmWalletAdapter>} A promise that resolves to the newly created EvmWalletAdapter instance.
   */
  static async create(args: args): Promise<EvmWalletAdapter> {
    const adapter = new EvmWalletAdapter(args);
    await adapter.initialize();
    return adapter;
  }

  /**
   * Initializes the wallet instance if it has not been initialized yet.
   * 
   * This method sets up the wallet using the provided private key and connects it to the provider if available.
   * It ensures that the wallet is only initialized once.
   * 
   * @returns {Promise<void>} A promise that resolves when the initialization is complete.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.wallet = new EthersWallet(this.privateKey);

    if (this.provider) {
      this.wallet = this.wallet.connect(this.provider);
    }
    this.initialized = true;
  }

  /**
   * Checks if the wallet has been initialized.
   *
   * @returns {boolean} True if the wallet is initialized, otherwise false.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Disconnects the wallet by clearing the provider and wallet instance.
   * This method does not clean up event listeners or other resources.
   */
  disconnect(): void {
    // Preserve the private key! Don't reset it
    const preservedPrivateKey = this.privateKey;

    this.provider = undefined;
    this.wallet = undefined as any; // Type assertion to avoid TypeScript error
    this.initialized = false;
    this.eventListeners.clear(); // Clear event listeners

    // Restore the private key
    this.privateKey = preservedPrivateKey;
  }

  /** Wallet Metadata */

  /**
   * Retrieves the name of the wallet adapter.
   *
   * @returns {string} The name of the wallet adapter.
   */
  getWalletName(): string {
    return "EvmWalletAdapter";
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
   * Checks if the wallet is connected to a provider.
   *
   * @returns {boolean} `true` if the wallet is connected to a provider, otherwise `false`.
   */
  isConnected(): boolean {
    return !!this.provider && !!this.wallet?.provider;
  }

  /** Account Management */

  /**
   * Requests the list of accounts associated with the wallet.
   * 
   * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
   * 
   * @emits WalletEvent.accountsChanged - Emitted when accounts are requested.
   */
  async requestAccounts(): Promise<string[]> {
    const accounts = [this.wallet.address];

    // Emit the accountsChanged event explicitly
    this.emitEvent(WalletEvent.accountsChanged, accounts);

    return accounts;
  }

  /**
   * Retrieves the private key associated with the wallet.
   *
   * @returns {Promise<string>} A promise that resolves to the private key as a string.
   */
  async getPrivateKey(): Promise<string> {
    return this.privateKey;
  }

  /**
   * Retrieves the list of accounts associated with the wallet.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array containing the wallet's address.
   */
  async getAccounts(): Promise<string[]> {
    return [this.wallet.address];
  }

  /**
   * Retrieves the balance of the specified account.
   *
   * @param {string} [account] - The account address to retrieve the balance for. Defaults to the wallet's address.
   * @returns {Promise<string>} A promise that resolves to the balance as a string.
   */
  async getBalance(account?: string): Promise<string> {
    if (!account) {
      account = this.wallet.address;
    }
    const balance = await this.provider!.getBalance(account);
    return ethers.formatEther(balance);
  }

  /**
   * Verifies the correctness of a signature for a given message.
   *
   * @param {string} message - The message to verify the signature against.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the signature is valid, otherwise `false`.
   */
  async verifySignature(message: string, signature: string): Promise<boolean> {
    const address = ethers.verifyMessage(message, signature);
    return address === this.wallet.address;
  }

  /**
   * Emits an event with the specified name and payload
   * @param eventName The name of the event to emit
   * @param payload The payload to pass to the event listeners
   */
  private emitEvent(eventName: string, payload: any): void {
    console.log(`Emitting ${eventName} event with:`, payload);
    const listeners = this.eventListeners.get(eventName);
    if (listeners && listeners.size > 0) {
      for (const callback of listeners) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in ${eventName} event handler:`, error);
        }
      }
    }
  }

  /**
   * Registers an event listener for the specified event.
   * 
   * @param event - The name of the event to listen for.
   * @param callback - The callback function to be invoked when the event is emitted.
   * 
   * @remarks
   * If the event is `WalletEvent.chainChanged` and the provider supports event listeners,
   * it will map the provider's `network` event to the `WalletEvent.chainChanged` event.
   * 
   * @example
   * ```typescript
   * wallet.on('connect', (payload) => {
   *   console.log('Wallet connected:', payload);
   * });
   * ```
   */
  on(event: string, callback: (payload: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Removes a specific callback function for a given event.
   *
   * @param event - The name of the event to remove the callback from.
   * @param callback - The callback function to be removed.
   */
  off(event: string, callback: (payload: unknown) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  /** Network Management */

  /**
   * Retrieves the network information from the provider.
   *
   * @returns A promise that resolves to an object containing the chain ID and optionally the network name.
   * @throws Will throw an error if the provider is not set.
   */
  async getNetwork(): Promise<{ chainId: string; name?: string }> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }

    console.log("[EvmWalletAdapter] Getting network from provider:", this.provider);

    try {
      const network = await this.provider.getNetwork();
      console.log("[EvmWalletAdapter] Network result:", network);
      return { chainId: String(network.chainId), name: network.name };
    } catch (error: any) {
      console.error("[EvmWalletAdapter] Error in getNetwork:", error);
      throw new Error("Failed to get network: " + error.message);
    }
  }

  /**
   * Sets the provider for the wallet and reconnects the wallet with the new provider if it is already connected.
   *
   * @param provider - The new provider to set for the wallet.
   */
  async setProvider(provider: { rpc: Provider }): Promise<void> {
    console.log("[EvmWalletAdapter] Setting new provider:", provider);
    const { rpc } = provider;
    this.provider = new JsonRpcProvider(rpc as any)

    // Reconnect wallet to new provider
    if (this.wallet) {
      try {
        this.wallet = this.wallet.connect(this.provider);
        console.log("[EvmWalletAdapter] Wallet reconnected to new provider", this.provider);
        const network = await this.provider.getNetwork();
        console.log("[EvmWalletAdapter] New network:", network);
        const chainId = `0x${network.chainId.toString(16)}`;
        this.emitEvent(WalletEvent.chainChanged, chainId);

      } catch (err) {
        console.error("[EvmWalletAdapter] Error connecting wallet to provider:", err);
      }
    }
  }

  /** Transactions & Signing */
  private processTransactionValue(tx: TransactionData): TransactionData {
    if (typeof tx.value === 'string' && tx.value.includes('.')) {
      return { ...tx, value: ethers.parseEther(tx.value).toString() };
    }
    return tx;
  }

  /**
   * Sends a transaction using the initialized wallet.
   *
   * @param tx - The transaction object to be sent.
   * @returns A promise that resolves to the transaction hash as a string.
   * @throws Will throw an error if the wallet, provider, or initialization is not properly set up.
   */
  async sendTransaction(tx: TransactionData): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized. Call initialize() first.");
    }

    if (!this.provider) {
      throw new Error("Provider not set");
    }

    try {
      // Process value if it's a string with decimal places
      const txRequest = { ...tx };

      if (typeof tx.value === 'string' && tx.value.includes('.')) {
        txRequest.value = ethers.parseEther(tx.value).toString();
      }

      const response = await this.wallet.sendTransaction(txRequest);
      return response.hash;
    } catch (error) {
      console.error("Transaction error:", error);
      throw error;
    }
  }

  /**
   * Signs a transaction using the wallet.
   *
   * @param tx - The transaction object to be signed.
   * @returns A promise that resolves to the signed transaction as a string.
   * @throws Will throw an error if the wallet is not initialized, the provider is not set, or the wallet is not available.
   */
  async signTransaction(tx: any): Promise<string> {
    const processedTx = this.processTransactionValue(tx);
    return await this.wallet.signTransaction(processedTx);
  }

  /**
   * Signs a given message using the wallet.
   *
   * @param message - The message to be signed.
   * @returns A promise that resolves to the signed message as a string.
   * @throws Will throw an error if the wallet is not initialized.
   */
  async signMessage(message: string): Promise<string> {
    return await this.wallet.signMessage(message);
  }


  /** EVM-Specific Features */

  /**
   * Signs typed data using the wallet.
   *
   * @param data - The data to be signed, including the domain, types, and value.
   * @param version - (Optional) The version of the signing method to use.
   * @returns A promise that resolves to the signed data as a string.
   * @throws Will throw an error if the wallet is not initialized.
   */
  async signTypedData(data: { domain: any; types: any; value: any }, version?: string): Promise<string> {
    return await this.wallet.signTypedData(data.domain, data.types, data.value);
  }

  /**
   * Retrieves the current gas price from the provider.
   *
   * @returns {Promise<string>} A promise that resolves to the gas price as a string.
   * @throws {Error} If the gas price is not available.
   */
  async getGasPrice(): Promise<string> {
    const feeData = await this.provider!.getFeeData();
    if (!feeData.gasPrice) {
      throw new Error("gasPrice not available");
    }
    return feeData.gasPrice.toString();
  }

  /**
   * Estimates the gas required for a given transaction.
   *
   * @param tx - The transaction data containing the recipient address, value, and optional data.
   * @returns A promise that resolves to the estimated gas as a string.
   */
  async estimateGas(tx: TransactionData): Promise<string> {
    const estimate = await this.provider!.estimateGas({
      to: tx.to,
      value: tx.value ? ethers.parseEther(tx.value.toString()) : 0n,
      data: tx.data || "0x"
    });
    return estimate.toString();
  }

  /**
   * Retrieves the transaction receipt for a given transaction hash.
   *
   * @param txHash - The hash of the transaction to retrieve the receipt for.
   * @returns A promise that resolves to the transaction receipt.
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    return await this.provider!.getTransactionReceipt(txHash);
  }

  /**
   * Retrieves the token balance for a given token address and account.
   *
   * @param tokenAddress - The address of the token contract.
   * @param account - The account address to retrieve the balance for. Defaults to the wallet's address.
   * @returns A promise that resolves to the token balance as a string.
   */
  async getTokenBalance(tokenAddress: string, account?: string): Promise<string> {
    if (!account) {
      account = this.wallet.address;
    }

    // Use a more complete ERC-20 ABI with more error handling
    const erc20Abi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];

    try {
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider!);

      // Get balance
      const balance = await tokenContract.balanceOf(account);

      // Try to get decimals, default to 18 if not available
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.log("Could not get token decimals, using default of 18");
      }

      return ethers.formatUnits(balance, decimals);
    } catch (error: any) {
      console.error("Error getting token balance:", error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

}