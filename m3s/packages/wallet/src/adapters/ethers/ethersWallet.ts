import { ethers, Provider, Wallet as EthersWallet, JsonRpcProvider, TransactionReceipt } from 'ethers';
import { AdapterArguments, AdapterError, NetworkConfig, NetworkHelper, WalletErrorCode } from '@m3s/shared';
import { IEVMWallet, WalletEvent, GenericTransactionData, AssetBalance, EIP712TypedData, EstimatedFeeData } from '../../types/index.js';
import { EIP712Validator } from '../../helpers/signatures.js';
import { toBigInt, toWei } from '../../helpers/units.js';

/**
 * Configuration specific to the EvmWalletAdapter (Ethers).
 */
export interface IEthersWalletOptionsV1 {
  privateKey: string;
  provider?: NetworkConfig;
  multiChainRpcs?: Record<string, string[]>;
}

interface args extends AdapterArguments<IEthersWalletOptionsV1> { }

/**
 * An adapter for EVM-based wallets using a private key, powered by ethers.js.
 * It implements the IEVMWallet interface directly, without a base class.
 */
export class EvmWalletAdapter implements IEVMWallet {
  public readonly name: string;
  public readonly version: string;
  private wallet!: EthersWallet;
  private provider?: Provider;
  private config: args;
  private _connected: boolean = false;
  protected initialized: boolean = false;
  protected decimals: number = 18;
  protected eventListeners: Map<string, Set<(payload: any) => void>> = new Map();
  private multiChainRpcs: Record<string, string[]> = {};
  private network?: NetworkConfig | null = null; // NEW: Add local network state

  private constructor(args: args) {
    this.name = args.name;
    this.version = args.version;
    this.config = args;

    this.multiChainRpcs = args.options.multiChainRpcs || {};
  }

  /**
   * Factory method to create and initialize an instance of EvmWalletAdapter.
   */
  static async create(args: args): Promise<EvmWalletAdapter> {
    const instance = new EvmWalletAdapter(args);
    await instance.initialize();
    return instance;
  }

  // --- Core Lifecycle & Connection Methods ---

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { privateKey, provider: providerConfig } = this.config.options;

    if (!privateKey) {
      throw new AdapterError("privateKey is required in options.", {
        code: WalletErrorCode.MissingConfig,
        methodName: 'initialize'
      });
    }

    this.wallet = new EthersWallet(privateKey);

    if (providerConfig) {
      await this.setProvider(providerConfig);
    }

    this.initialized = true;
  }

  async disconnect(): Promise<void> {
    this.provider = undefined;
    this._connected = false;
    this.initialized = false;
    this.eventListeners.clear();
    this.emitEvent('disconnect', undefined);
  }

  isConnected(): boolean {
    return this._connected && !!this.provider && !!this.wallet;
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
    // ✅ Fix: Add proper validation that actually throws
    if (!multiChainRpcs || typeof multiChainRpcs !== 'object') {
      throw new AdapterError('Invalid RPC configuration - must be an object', {
        code: WalletErrorCode.InvalidInput,
        methodName: 'updateAllChainRpcs'
      });
    }

    for (const [chainId, rpcUrls] of Object.entries(multiChainRpcs)) {
      // ✅ Fix: Check if rpcUrls is actually an array
      if (!Array.isArray(rpcUrls)) {
        throw new AdapterError(`Invalid RPC URLs for chain ${chainId} - must be array`, {
          code: WalletErrorCode.InvalidInput,
          methodName: 'updateAllChainRpcs'
        });
      }

      // ✅ Fix: Check for empty arrays
      if (rpcUrls.length === 0) {
        throw new AdapterError(`Invalid RPC URLs for chain ${chainId} - array cannot be empty`, {
          code: WalletErrorCode.InvalidInput,
          methodName: 'updateAllChainRpcs'
        });
      }

      // ✅ Fix: Validate each URL
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
    console.log(`[EvmWalletAdapter] Updated all chain RPCs for ${Object.keys(multiChainRpcs).length} chains`);
  }

  async setProvider(config: NetworkConfig): Promise<void> {
    if (!config.chainId) {
      throw new AdapterError("chainId is required in NetworkConfig", {
        code: WalletErrorCode.InvalidInput,
        methodName: 'setProvider'
      });
    }
    
    // 1) Build preferred list (hex or decimal chainId)
    const cid = config.chainId;
    const preferred = this.multiChainRpcs[cid] || this.multiChainRpcs[String(cid)] || [];

    // 2) Ask NetworkHelper to pick a working RPC (fast‐failing if none)
    const networkHelper = NetworkHelper.getInstance();
    await networkHelper.ensureInitialized();
    const netConf = await networkHelper.getNetworkConfig(cid, preferred, false);

    if (!netConf) {
      throw new AdapterError(
        `Failed to connect to any provided RPC URL for chain ${cid}`,
        { code: WalletErrorCode.ConnectionFailed, methodName: 'setProvider' }
      );
    }

    this.network = null;

    // 3) Record it and wire up ethers.js
    this.network = netConf;
    this.provider = new JsonRpcProvider(netConf.rpcUrls[0]);

    if (this.wallet) {
      this.wallet = this.wallet.connect(this.provider);
    }

    this._connected = true;
    this.emitEvent(WalletEvent.chainChanged, netConf.chainId);
  }

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
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected });
    }
    const accounts = [this.wallet.address];
    this.emitEvent('accountsChanged', accounts);
    return accounts;
  }

  async getNetwork(): Promise<NetworkConfig> {
    if (!this.network) {
      throw new AdapterError(
        "No network configured.",
        { code: WalletErrorCode.WalletNotConnected, methodName: 'getNetwork' }
      );
    }
    return this.network;
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

      const network = await this.getNetwork();

      if (!network) {
        throw new AdapterError("Network not found.", { code: WalletErrorCode.NetworkError, methodName: 'signTypedData' });
      }

      // This throws it's own adapter errors.
      EIP712Validator.validateStructure(data);
      EIP712Validator.validateTypes(data.types);
      EIP712Validator.validateDomain(data.domain, network.chainId.toString());


      const signer = await this.getSigner();
      const signature = await signer.signTypedData(data.domain, data.types, data.value);
      return signature;
    } catch (error: any) {
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
    if (!this.isConnected()) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'sendTransaction' });
    }

    const signer = await this.getSigner();
    const txRequest = await this.prepareTransactionRequest(tx);
    console.log('Sending tx from client: ', txRequest)

    try {

      const response = await signer.sendTransaction(txRequest);

      this.provider!.once(response.hash, (receipt) => {
        this.emitEvent('txConfirmed', receipt); // or use a callback
      });

      return response.hash;
    } catch (error: any) {

      const senderAddress = (await this.getAccounts())[0];
      console.log('Sender address:', senderAddress);

      console.error('Error decoded:', error)

      console.error('Transaction failed:', error)
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
  }): Promise<any> {
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
    const provider = await this.getProvider();
    const signer = await this.getSigner();
    const fromAddress = await signer.getAddress();

    try {

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
    
      // Gas object data response.
      const gas = {
        gasLimit,
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      }

      console.log('Gas estimation for: ', txRequest)
      console.log('Gas estimation results:', gas)

      return gas

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
    if (!this.provider) {
      throw new AdapterError("Provider not set.", { code: WalletErrorCode.ProviderNotFound });
    }
    return this.provider;
  }

  protected async getSigner(): Promise<ethers.Signer> {
    if (!this.isConnected() || !this.wallet) {
      throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected });
    }
    return this.wallet;
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