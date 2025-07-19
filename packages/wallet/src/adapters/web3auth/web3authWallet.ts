import { Web3AuthNoModal } from "@web3auth/no-modal";
import { ChainNamespaceType, CustomChainConfig, IBaseProvider, WALLET_ADAPTERS } from "@web3auth/base";
import { BrowserProvider, ethers, Provider, TransactionReceipt } from "ethers";
import { AdapterArguments, AdapterError, NetworkConfig, NetworkHelper, WalletErrorCode } from "@m3s/shared";
import { AuthAdapter, LoginConfig } from "@web3auth/auth-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { IEVMWallet, WalletEvent, GenericTransactionData, AssetBalance, EIP712TypedData, EstimatedFeeData } from '../../types/index.js';
import { EIP712Validator } from '../../helpers/signatures.js';
import { toBigInt, toWei } from '../../helpers/units.js';

/**
 * Configuration specific to the Web3AuthWalletAdapter.
 */
export interface IWeb3AuthWalletOptionsV1 {
  web3authConfig: {
    clientId: string;
    web3AuthNetwork: string;
    chainConfig: CustomChainConfig;
    loginConfig: LoginConfig;
    privateKeyProvider?: IBaseProvider<any>;
  };
  multiChainRpcs?: Record<string, string[]>;
}

interface args extends AdapterArguments<IWeb3AuthWalletOptionsV1> { }

/**
 * An adapter for EVM-based wallets using Web3Auth for social logins.
 * It implements the IEVMWallet interface directly.
 */
export class Web3AuthWalletAdapter implements IEVMWallet {
  public readonly name: string;
  public readonly version: string;
  private web3auth: Web3AuthNoModal | null = null;
  private config: args;
  protected initialized: boolean = false;
  protected decimals: number = 18;
  protected eventListeners: Map<string, Set<(payload: any) => void>> = new Map();
  private multiChainRpcs: Record<string, string[]> = {};
  private network: NetworkConfig | null = null; // NEW: Add local network state

  private constructor(args: args) {
    this.name = args.name;
    this.version = args.version;
    this.config = args;
    this.multiChainRpcs = args.options.multiChainRpcs || {};
  }

  /**
   * Factory method to create and initialize an instance of Web3AuthWalletAdapter.
   */
  static async create(args: args): Promise<Web3AuthWalletAdapter> {
    const instance = new Web3AuthWalletAdapter(args);
    await instance.initialize();
    return instance;
  }

  // --- Core Lifecycle & Connection Methods ---

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const opts = this.config.options.web3authConfig;
    if (!opts) {
      throw new AdapterError("web3authConfig is missing.", { code: WalletErrorCode.MissingConfig });
    }

    try {
      const privateKeyProvider = opts.privateKeyProvider || new EthereumPrivateKeyProvider({ config: { chainConfig: opts.chainConfig } });

      this.web3auth = new Web3AuthNoModal({
        clientId: opts.clientId,
        web3AuthNetwork: opts.web3AuthNetwork as any,
        chainConfig: opts.chainConfig,
        privateKeyProvider,
      });

      const authAdapter = new AuthAdapter({ adapterSettings: { loginConfig: opts.loginConfig } });
      this.web3auth.configureAdapter(authAdapter);

      await this.web3auth.init();
      this.initialized = true;
    } catch (error: unknown) {
      throw new AdapterError("Web3Auth initialization failed.", { cause: error, code: WalletErrorCode.InitializationFailed });
    }
  }

  async disconnect(): Promise<void> {
    if (this.web3auth && this.web3auth.connected) {
      await this.web3auth.logout();
    }
    this.web3auth = null;
    this.initialized = false;
    this.eventListeners.clear();
    this.emitEvent('disconnect', undefined);
  }

  isConnected(): boolean {
    return this.initialized && !!this.web3auth?.connected;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
  * Get ALL configured RPC URLs for ALL chains
  */
  getAllChainRpcs(): Record<string, string[]> {
    return { ...this.multiChainRpcs };
  }

  /**
   * Update ALL RPC configurations at once
   */
  async updateAllChainRpcs(multiChainRpcs: Record<string, string[]>): Promise<void> {
    // ✅ Same validation logic as ethers
    if (!multiChainRpcs || typeof multiChainRpcs !== 'object') {
      throw new AdapterError('Invalid RPC configuration - must be an object', {
        code: WalletErrorCode.InvalidInput,
        methodName: 'updateAllChainRpcs'
      });
    }

    for (const [chainId, rpcUrls] of Object.entries(multiChainRpcs)) {
      if (!Array.isArray(rpcUrls)) {
        throw new AdapterError(`Invalid RPC URLs for chain ${chainId} - must be array`, {
          code: WalletErrorCode.InvalidInput,
          methodName: 'updateAllChainRpcs'
        });
      }

      if (rpcUrls.length === 0) {
        throw new AdapterError(`Invalid RPC URLs for chain ${chainId} - array cannot be empty`, {
          code: WalletErrorCode.InvalidInput,
          methodName: 'updateAllChainRpcs'
        });
      }

      for (const url of rpcUrls) {
        if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
          throw new AdapterError(`Invalid RPC URL for chain ${chainId}: ${url} - must be HTTP/HTTPS URL`, {
            code: WalletErrorCode.InvalidInput,
            methodName: 'updateAllChainRpcs'
          });
        }
      }
    }

    this.multiChainRpcs = { ...multiChainRpcs };
    console.log(`[Web3AuthWalletAdapter] Updated all chain RPCs for ${Object.keys(multiChainRpcs).length} chains`);
  }

  async setProvider(config: NetworkConfig): Promise<void> {
    if (!this.isConnected() || !this.web3auth) {
      throw new AdapterError("Not connected.", { code: WalletErrorCode.WalletNotConnected });
    }
    const newChainIdHex = config.chainId.startsWith('0x') ? config.chainId : `0x${parseInt(config.chainId, 10).toString(16)}`;

    // ✅ MISSING PART: Use RPC data like ethers adapter does
    const cid = config.chainId;
    const cidDecimal = parseInt(newChainIdHex, 16).toString();
    const preferred = this.multiChainRpcs[cid] || this.multiChainRpcs[cidDecimal] || this.multiChainRpcs[newChainIdHex] || [];

    // ✅ Get proper network config with RPC preferences
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();
    let finalConfig: NetworkConfig;

    try {
      // Try to get enhanced config with preferred RPCs
      const enhancedConfig = await networkHelper.getNetworkConfig(cid, preferred, false);
      finalConfig = enhancedConfig || config; // Fall back to original config
    } catch (error) {
      console.warn(`[Web3AuthWalletAdapter] NetworkHelper failed, using original config:`, error);
      finalConfig = config;
    }

    // ✅ Ensure we have valid RPC URLs
    if (!finalConfig.rpcUrls || finalConfig.rpcUrls.length === 0) {
      if (preferred.length > 0) {
        finalConfig = { ...finalConfig, rpcUrls: preferred };
      } else {
        throw new AdapterError(`No RPC URLs available for chain ${newChainIdHex}`, {
          code: WalletErrorCode.ConnectionFailed,
          methodName: 'setProvider'
        });
      }
    }

    try {
      await this.web3auth.switchChain({ chainId: newChainIdHex });
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain ID') || switchError.message?.includes('Chain config has not been added')) {
        try {
          console.log(`[Web3AuthWalletAdapter] Adding chain ${newChainIdHex} to Web3Auth`);

          const chainToAdd = {
            chainId: newChainIdHex,
            chainNamespace: "eip155" as ChainNamespaceType,
            displayName: finalConfig.displayName || finalConfig.name,
            rpcTarget: finalConfig.rpcUrls[0], // ✅ Use the proper RPC URL
            blockExplorerUrl: finalConfig.blockExplorerUrl,
            ticker: finalConfig.ticker || "ETH",
            tickerName: finalConfig.tickerName || "Ethereum",
          };

          await this.web3auth.addChain(chainToAdd as any);
          console.log(`[Web3AuthWalletAdapter] ✅ Successfully added chain ${newChainIdHex}`);

          // Now try to switch again
          await this.web3auth.switchChain({ chainId: newChainIdHex });
          console.log(`[Web3AuthWalletAdapter] ✅ Successfully switched to chain ${newChainIdHex}`);

        } catch (addError: any) {
          throw new AdapterError(`Failed to add or switch to chain ${newChainIdHex}: ${addError.message}`, {
            cause: addError,
            code: WalletErrorCode.ConnectionFailed,
            methodName: 'setProvider'
          });
        }
      } else {
        throw new AdapterError(`Failed to switch chain ${newChainIdHex}: ${switchError.message}`, {
          cause: switchError,
          code: WalletErrorCode.ConnectionFailed,
          methodName: 'setProvider'
        });
      }
    }

    this.network = null;
    const network = await this.getNetwork();
    this.network = network;
    this.decimals = network.decimals || 18;
    this.emitEvent('chainChanged', network.chainId);
  }

  // --- Event Handling ---

  public on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  public off(event: WalletEvent | string, callback: (...args: any[]) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  protected emitEvent(eventName: WalletEvent | string, payload: any): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners && listeners.size > 0) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error: unknown) {
          console.error(`[${this.name}] Error in ${eventName} event handler:`, error);
        }
      });
    }
  }

  // --- Wallet Information & State ---

  async getAccounts(): Promise<string[]> {
    if (!this.isConnected()) {
      const loginProvider = Object.keys(this.config.options.web3authConfig.loginConfig)[0];
      if (!loginProvider) {
        throw new AdapterError("No login providers configured.", { code: WalletErrorCode.MissingConfig });
      }
      await this.web3auth?.connectTo(WALLET_ADAPTERS.AUTH, { loginProvider });

      if (!this.web3auth?.connected || !this.web3auth.provider) {
        throw new AdapterError("Failed to connect to Web3Auth.", { code: WalletErrorCode.ConnectionFailed });
      }

      const network = await this.getNetwork();
      this.network = network;
      this.emitEvent('connect', { chainId: network.chainId });
    }

    const accounts = (await this.web3auth?.provider?.request({ method: "eth_accounts" })) as string[];
    this.emitEvent('accountsChanged', accounts);
    return accounts;
  }

  async getNetwork(): Promise<NetworkConfig> {
    if (!this.isConnected() || !this.web3auth?.provider) {
      throw new AdapterError("Not connected.", { code: WalletErrorCode.WalletNotConnected });
    }
    // Return cached network if available
    if (this.network) {
      return this.network;
    }

    const provider = await this.getProvider();
    const network = await provider.getNetwork();
    const chainId = `0x${network.chainId.toString(16)}`;

    // Use NetworkHelper to get rich data
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();
    const config = await networkHelper.getNetworkConfig(chainId);

    const finalConfig = config ?? {
      chainId,
      name: network.name,
      displayName: network.name,
      rpcUrls: [(provider as any)?.connection?.url || ''].filter(Boolean),
      decimals: 18,
      ticker: 'ETH',
      tickerName: 'Ethereum',
    };

    this.network = finalConfig; // Cache the result
    return finalConfig;
  }

  public async getBalance(account?: string): Promise<AssetBalance> {
    if (!this.isConnected()) {
      throw new AdapterError("Not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getBalance' });
    }
    try {
      const provider = await this.getProvider();
      const address = account || (await this.getAccounts())[0];
      if (!address) {
        throw new AdapterError("No account available.", { code: WalletErrorCode.AccountUnavailable, methodName: 'getBalance' });
      }
      const balanceWei = await provider.getBalance(address);
      const networkConfig = await this.getNetwork();
      this.decimals = networkConfig.decimals || 18;
      return {
        amount: balanceWei.toString(),
        decimals: this.decimals,
        symbol: networkConfig.ticker || 'ETH',
        formattedAmount: ethers.formatUnits(balanceWei, this.decimals)
      };
    } catch (error: any) {
      throw new AdapterError(`Failed to get balance: ${error.message}`, { cause: error, code: WalletErrorCode.NetworkError, methodName: 'getBalance' });
    }
  }

  // --- Signing Methods ---

  public async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signMessage' });
    }
    try {
      const signer = await this.getSigner();
      return await signer.signMessage(message);
    } catch (error: any) {
      const messageText = (error as any).shortMessage || (error as any).message || String(error);
      let code: WalletErrorCode | string = WalletErrorCode.SigningFailed;
      if (messageText.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
      throw new AdapterError(`Failed to sign message: ${messageText}`, { cause: error, code, methodName: 'signMessage' });
    }
  }

  public async signTransaction(tx: GenericTransactionData): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signTransaction' });
    }
    try {
      const signer = await this.getSigner();
      const preparedTx = await this.prepareTransactionRequest(tx);
      return await signer.signTransaction(preparedTx);
    } catch (error: any) {
      const message = (error as any).shortMessage || (error as any).message || String(error);
      throw new AdapterError(`Failed to sign transaction: ${message}`, { cause: error, code: WalletErrorCode.SignatureFailed, methodName: 'signTransaction' });
    }
  }

  public async signTypedData(data: EIP712TypedData): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signTypedData' });
    }
    try {
      EIP712Validator.validateStructure(data);
      EIP712Validator.validateTypes(data.types);
      const network = await this.getNetwork();
      EIP712Validator.validateDomain(data.domain, network.chainId.toString());
      const signer = await this.getSigner();

      const signature = await signer.signTypedData(data.domain, data.types, data.value);

      return signature;
    } catch (error: any) {
      if (error instanceof AdapterError) {
        throw error;
      }
      const message = (error as any).shortMessage || (error as any).message || String(error);
      let code: WalletErrorCode | string = WalletErrorCode.SigningFailed;
      if (message.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
      throw new AdapterError(`Failed to sign typed data: ${message}`, { cause: error, code, methodName: 'signTypedData' });
    }
  }

  public async verifySignature(message: string | Uint8Array | EIP712TypedData, signature: string, address: string): Promise<boolean> {
    if (!ethers.isAddress(address)) {
      throw new AdapterError("Invalid address format.", { code: WalletErrorCode.InvalidInput, methodName: 'verifySignature' });
    }
    try {
      if (typeof message === 'object' && 'domain' in message) {
        return EIP712Validator.verifySignature(message, signature, address);
      } else {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
      }
    } catch (error) {
      console.error(`[${this.name}] Signature verification failed:`, error);
      return false;
    }
  }

  // --- Transaction Methods ---
  public async getNonce(type: 'latest' | 'pending' = 'pending'): Promise<number> {
    const signer = await this.getSigner();
    return signer.getNonce(type);
  }

  public async sendTransaction(tx: GenericTransactionData): Promise<string> {
    console.log('SENDING THIS TX FROM THE CLIENT ...', tx)

    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'sendTransaction' });
    }
    try {
      const signer = await this.getSigner();
      const txRequest = await this.prepareTransactionRequest(tx);
      console.log('SENDING THIS TX FROM prepareTransactionRequest ...', txRequest)

      const response = await signer.sendTransaction(txRequest);
      return response.hash;
    } catch (error: any) {
      const message = (error as any).shortMessage || (error as any).message || String(error);
      let code: WalletErrorCode | string = WalletErrorCode.TransactionFailed;
      if (message.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
      throw new AdapterError(`Failed to send transaction: ${message}`, { cause: error, code, methodName: 'sendTransaction' });
    }
  }

  public async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getTransactionReceipt' });
    }
    const provider = await this.getProvider();
    return provider.getTransactionReceipt(txHash);
  }

  public async callContract(options: {
    contractAddress: string;
    abi: any;
    method: string;
    args?: any[];
  }): Promise<any> {
    if (!this.isConnected()) throw new AdapterError("Wallet not connected.");

    const provider = await this.getProvider();
    const iface = new ethers.Interface(options.abi);

    // Convert arguments to strings
    const data = iface.encodeFunctionData(options.method, options.args || []);

    const rawResult = await provider.call({
      to: options.contractAddress,
      data,
    });

    return iface.decodeFunctionResult(options.method, rawResult);
  }

  public async writeContract(options: {
    contractAddress: string;
    abi: any;
    method: string;
    args?: any[];
    value?: string | bigint; // Optional: send ETH with call
    overrides?: Partial<GenericTransactionData['options']>;
  }): Promise<string> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'writeContract' });
    }

    const iface = new ethers.Interface(options.abi);
    const data = iface.encodeFunctionData(options.method, options.args || []);

    const tx: GenericTransactionData = {
      to: options.contractAddress,
      data,
      value: options.value?.toString(),
      options: options.overrides,
    };

    return this.sendTransaction(tx);
  }

  // --- Gas & Fee Methods ---
  public async estimateGas(tx: GenericTransactionData): Promise<EstimatedFeeData> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'estimateGas' });
    }

    try {
      const provider = await this.getProvider();
      const signer = await this.getSigner();
      const fromAddress = await signer.getAddress();

      // Build a minimal tx request for estimation
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        value: tx.value ? toWei(tx.value, this.decimals) : undefined,
        data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
        from: fromAddress,
      };

      // Estimate gas limit
      const gasLimit = await provider.estimateGas(txRequest);

      // Get fee data from provider
      const feeData = await provider.getFeeData();

      return {
        gasLimit,
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      };

    } catch (error: any) {
      throw new AdapterError(`Failed to estimate gas: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.GasEstimationFailed,
        methodName: 'estimateGas'
      });
    }
  }

  public async getGasPrice(): Promise<bigint> {
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getGasPrice' });
    }

    try {
      const provider = await this.getProvider();
      const feeData = await provider.getFeeData();

      if (feeData.gasPrice) {
        return feeData.gasPrice;
      } else if (feeData.maxFeePerGas) {
        return feeData.maxFeePerGas;
      } else {
        throw new AdapterError("Gas price not available from any source.");
      }

    } catch (error: any) {
      throw new AdapterError(`Failed to get gas price: ${(error as Error).message}`, {
        cause: error,
        code: WalletErrorCode.GasEstimationFailed,
        methodName: 'getGasPrice'
      });
    }
  }

  // --- Protected Helper Methods ---

  protected async getProvider(): Promise<Provider> {
    if (!this.web3auth?.provider) {
      throw new AdapterError("Provider not available from Web3Auth.", { code: WalletErrorCode.ProviderNotFound });
    }
    return new BrowserProvider(this.web3auth.provider);
  }

  protected async getSigner(): Promise<ethers.Signer> {
    const provider = await this.getProvider();
    const accounts = await this.getAccounts();
    if (accounts.length === 0) {
      throw new AdapterError("No accounts available to create signer.", { code: WalletErrorCode.AccountUnavailable });
    }
    return (provider as BrowserProvider).getSigner(accounts[0]);
  }
  public async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
    const signer = await this.getSigner();
    // const provider = await this.getProvider();

    const txRequest: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value ? toWei(tx.value, this.decimals) : undefined,
      data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
      nonce: tx.options?.nonce,
      chainId: tx.options?.chainId ? toBigInt(tx.options.chainId) : undefined,
    };

    // Set nonce if not provided
    if (txRequest.nonce === undefined) {
      txRequest.nonce = await signer.getNonce('pending');
    }

    // Clean up undefined values
    Object.keys(txRequest).forEach(key => (txRequest as any)[key] === undefined && delete (txRequest as any)[key]);

    return txRequest;
  }
}