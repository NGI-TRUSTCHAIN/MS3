// import { ethers, TransactionReceipt, Provider } from 'ethers';
// import { AdapterArguments, AdapterError, NetworkConfig, WalletErrorCode } from '@m3s/common';
// import { IEVMWallet, WalletEvent, GenericTransactionData, AssetBalance, EIP712TypedData, EstimatedFeeData } from '../types/index.js';
// import { EIP712Validator } from '../helpers/signatures.js';
// import { toBigInt, toWei } from '../helpers/units.js';

// /**
//  * An abstract base class for EVM-based wallet adapters.
//  * It implements the common boilerplate logic for the IEVMWallet interface,
//  * such as transaction preparation, signing orchestration, and event handling.
//  * 
//  * Concrete adapters must extend this class and implement the abstract methods
//  * which define the unique, SDK-specific behavior (e.g., how to get a signer).
//  */
// export abstract class BaseEvmWallet implements IEVMWallet {
//   public readonly name: string;
//   public readonly version: string;
//   protected initialized: boolean = false;
//   protected decimals: number = 18;
//   protected eventListeners: Map<string, Set<(payload: any) => void>> = new Map();

//   constructor(args: AdapterArguments<any>) {
//     this.name = args.name;
//     this.version = args.version;
//   }

//   // --- Abstract Methods (The "Contract" for Child Classes) ---
//   // These are unique and MUST be implemented by concrete adapters.

//   abstract initialize(): Promise<void>;
//   abstract disconnect(): Promise<void>;
//   abstract isConnected(): boolean;
//   abstract getAccounts(): Promise<string[]>;
//   abstract getNetwork(): Promise<NetworkConfig>;
//   abstract setProvider(config: NetworkConfig): Promise<void>;
//   protected abstract getProvider(): Promise<Provider>;
//   protected abstract getSigner(): Promise<ethers.Signer>;

//   // --- Concrete Implementations (Shared Boilerplate from IEVMWallet) ---

//   public isInitialized(): boolean {
//     return this.initialized;
//   }

//   public on(event: WalletEvent | string, callback: (...args: any[]) => void): void {
//     if (!this.eventListeners.has(event)) {
//       this.eventListeners.set(event, new Set());
//     }
//     this.eventListeners.get(event)!.add(callback);
//   }

//   public off(event: WalletEvent | string, callback: (...args: any[]) => void): void {
//     if (this.eventListeners.has(event)) {
//       this.eventListeners.get(event)!.delete(callback);
//     }
//   }

//   protected emitEvent(eventName: WalletEvent | string, payload: any): void {
//     const listeners = this.eventListeners.get(eventName);
//     if (listeners && listeners.size > 0) {
//       listeners.forEach(callback => {
//         try {
//           callback(payload);
//         } catch (error: unknown) {
//           console.error(`[${this.name}] Error in ${eventName} event handler:`, error);
//         }
//       });
//     }
//   }

//   public async getBalance(account?: string): Promise<AssetBalance> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getBalance' });
//     }
//     try {
//       const provider = await this.getProvider();
//       const address = account || (await this.getAccounts())[0];
//       if (!address) {
//         throw new AdapterError("No account available.", { code: WalletErrorCode.AccountUnavailable, methodName: 'getBalance' });
//       }
//       const balanceWei = await provider.getBalance(address);
//       const networkConfig = await this.getNetwork();
//       this.decimals = networkConfig.decimals || 18;
//       return {
//         amount: balanceWei.toString(),
//         decimals: this.decimals,
//         symbol: networkConfig.ticker || 'ETH',
//         formattedAmount: ethers.formatUnits(balanceWei, this.decimals)
//       };
//     } catch (error: any) {
//       throw new AdapterError(`Failed to get balance: ${error.message}`, { cause: error, code: WalletErrorCode.NetworkError, methodName: 'getBalance' });
//     }
//   }

//   public async sendTransaction(tx: GenericTransactionData): Promise<string> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'sendTransaction' });
//     }
//     try {
//       const signer = await this.getSigner();
//       const txRequest = await this.prepareTransactionRequest(tx);
//       const response = await signer.sendTransaction(txRequest);
//       return response.hash;
//     } catch (error: any) {
//       const message = error.shortMessage || error.message || String(error);
//       let code: WalletErrorCode | string = WalletErrorCode.TransactionFailed;
//       if (message.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
//       throw new AdapterError(`Failed to send transaction: ${message}`, { cause: error, code, methodName: 'sendTransaction' });
//     }
//   }

//   public async signTransaction(tx: GenericTransactionData): Promise<string> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signTransaction' });
//     }
//     try {
//       const signer = await this.getSigner();
//       const preparedTx = await this.prepareTransactionRequest(tx);
//       return await signer.signTransaction(preparedTx);
//     } catch (error: any) {
//       const message = error.shortMessage || error.message || String(error);
//       throw new AdapterError(`Failed to sign transaction: ${message}`, { cause: error, code: WalletErrorCode.SignatureFailed, methodName: 'signTransaction' });
//     }
//   }

//   public async signMessage(message: string | Uint8Array): Promise<string> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signMessage' });
//     }
//     try {
//       const signer = await this.getSigner();
//       return await signer.signMessage(message);
//     } catch (error: any) {
//       const messageText = error.shortMessage || error.message || String(error);
//       let code: WalletErrorCode | string = WalletErrorCode.SigningFailed;
//       if (messageText.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
//       throw new AdapterError(`Failed to sign message: ${messageText}`, { cause: error, code, methodName: 'signMessage' });
//     }
//   }

//   public async signTypedData(data: EIP712TypedData): Promise<string> {
//        if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'signTypedData' });
//     }
//     try {
//       // FIX: Perform structure validation first, as tests expect this.
//       EIP712Validator.validateStructure(data);
//       const network = await this.getNetwork();
//       EIP712Validator.validateDomain(data.domain, network.chainId.toString());
//       const signer = await this.getSigner();
      
//       // FIX: Remove the immediate self-verification. The signer's job is just to sign.
//       // The `verifySignature` method is available for consumers to use separately.
//       const signature = await signer.signTypedData(data.domain, data.types, data.value);
      
//       return signature;
//     } catch (error: any) {
//       if (error === AdapterError) throw error;
//       const message = error.shortMessage || error.message || String(error);
//       let code: WalletErrorCode | string = WalletErrorCode.SigningFailed;
//       if (message.toLowerCase().includes('user denied')) code = WalletErrorCode.UserRejected;
//       throw new AdapterError(`Failed to sign typed data: ${message}`, { cause: error, code, methodName: 'signTypedData' });
//     }
//   }

//   public async estimateGas(tx: GenericTransactionData): Promise<EstimatedFeeData> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'estimateGas' });
//     }
//     try {
//       const provider = await this.getProvider();
//       const preparedTx = await this.prepareTransactionRequest(tx);
//       const gasLimit = await provider.estimateGas(preparedTx);
//       const feeData = await provider.getFeeData();
//       return {
//         gasLimit: gasLimit,
//         gasPrice: feeData?.gasPrice?.toString(),
//         maxFeePerGas: feeData?.maxFeePerGas?.toString(),
//         maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString(),
//       };
//     } catch (error: any) {
//       throw new AdapterError(`Failed to estimate gas: ${error.message}`, { cause: error, code: WalletErrorCode.GasEstimationFailed, methodName: 'estimateGas' });
//     }
//   }

//   public async getGasPrice(): Promise<bigint> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getGasPrice' });
//     }
//     const provider = await this.getProvider();
//     const feeData = await provider.getFeeData();
//     if (!feeData.gasPrice) throw new AdapterError("Gas price not available (network might be EIP-1559 only).");
//     return feeData.gasPrice;
//   }

//   public async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'getTransactionReceipt' });
//     }
//     const provider = await this.getProvider();
//     return provider.getTransactionReceipt(txHash);
//   }

//   public async callContract(to: string, data: string): Promise<string> {
//     if (!this.isConnected()) {
//       throw new AdapterError("Wallet not connected.", { code: WalletErrorCode.WalletNotConnected, methodName: 'callContract' });
//     }
//     const provider = await this.getProvider();
//     return provider.call({ to, data });
//   }

//   public async verifySignature(message: string | Uint8Array | EIP712TypedData, signature: string, address: string): Promise<boolean> {
//     if (!ethers.isAddress(address)) {
//       throw new AdapterError("Invalid address format.", { code: WalletErrorCode.InvalidInput, methodName: 'verifySignature' });
//     }
//     try {
//       if (typeof message === 'object' && 'domain' in message) {
//         return EIP712Validator.verifySignature(message, signature, address);
//       } else {
//         const recoveredAddress = ethers.verifyMessage(message, signature);
//         return recoveredAddress.toLowerCase() === address.toLowerCase();
//       }
//     } catch (error) {
//       console.error(`[${this.name}] Signature verification failed:`, error);
//       return false;
//     }
//   }

//   protected async prepareTransactionRequest(tx: GenericTransactionData): Promise<ethers.TransactionRequest> {
//     const signer = await this.getSigner();
//     const provider = await this.getProvider();

//     const txRequest: ethers.TransactionRequest = {
//       to: tx.to,
//       value: tx.value ? toWei(tx.value, this.decimals) : undefined,
//       data: tx.data ? (typeof tx.data === 'string' ? tx.data : ethers.hexlify(tx.data)) : undefined,
//       nonce: tx.options?.nonce,
//       gasLimit: tx.options?.gasLimit ? toBigInt(tx.options.gasLimit) : undefined,
//       gasPrice: tx.options?.gasPrice ? toBigInt(tx.options.gasPrice) : undefined,
//       maxFeePerGas: tx.options?.maxFeePerGas ? toBigInt(tx.options.maxFeePerGas) : undefined,
//       maxPriorityFeePerGas: tx.options?.maxPriorityFeePerGas ? toBigInt(tx.options.maxPriorityFeePerGas) : undefined,
//       chainId: tx.options?.chainId ? toBigInt(tx.options.chainId) : undefined,
//     };

//     if (txRequest.nonce === undefined) {
//       txRequest.nonce = await signer.getNonce('pending');
//     }

//     if (!txRequest.gasLimit) {
//       try {
//         txRequest.gasLimit = await provider.estimateGas(txRequest);
//       } catch (e: any) {
//         console.warn(`[${this.name}] Gas estimation failed: ${e.message}. Using fallback.`);
//         txRequest.gasLimit = toBigInt(tx.to ? 300000 : 5000000); // Simple fallback
//       }
//     }
    
//     Object.keys(txRequest).forEach(key => (txRequest as any)[key] === undefined && delete (txRequest as any)[key]);
//     return txRequest;
//   }
// }