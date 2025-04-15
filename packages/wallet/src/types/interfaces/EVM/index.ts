import { GenericTransactionData} from "../../types/index.js";
import { ICoreWallet } from "../base.js";

/**
 * Represents the structure for EIP-712 typed data signing.
 * Aligns with the common structure used by libraries like ethers.js.
 */
export interface EIP712TypedData {
  /**
   * The EIP-712 domain separator components.
   */
  domain: {
    name?: string;
    version?: string;
    chainId?: string | number | bigint;
    verifyingContract?: string;
    salt?: string | Uint8Array;
  };
  /**
   * The type definitions for the structured data.
   * Maps type names to arrays of fields (name and type).
   */
  types: Record<string, Array<{ name: string; type: string }>>;
  /**
   * The primary data object (value) to be signed.
   * Its structure must correspond to the definitions in `types`.
   */
  value: Record<string, any>;
}

/**
 * Extends ICoreWallet with EVM-specific functionalities.
 */
export interface IEVMWallet extends ICoreWallet {
  /**
   * Signs typed data according to EIP-712.
   * @param data The structured typed data (domain, types, message).
   * @returns A promise that resolves to the signature string.
   */
  signTypedData(data: EIP712TypedData): Promise<string>;

  /**
   * Gets the current gas price from the network.
   * @returns A promise that resolves to the gas price as a bigint.
   */
  getGasPrice(): Promise<bigint>;

  /**
   * Estimates the gas required for a transaction.
   * Note: Uses original EVM TransactionData structure here for specificity.
   * Consider if GenericTransactionData with options is sufficient.
   * @param tx The transaction data.
   * @returns A promise that resolves to the estimated gas limit as a bigint.
   */
  estimateGas(tx: GenericTransactionData): Promise<bigint>; // Or use GenericTransactionData? Needs decision.

  /**
   * Gets the balance of a specific ERC-20 token for an account.
   * @param tokenAddress The address of the ERC-20 token contract.
   * @param account (Optional) The account address. Defaults to the connected account.
   * @returns A promise that resolves to the token balance as a string (in smallest unit).
   */
  getTokenBalance(tokenAddress: string, account?: string): Promise<string>;

  /**
   * Gets the receipt for a transaction hash.
   * @param txHash The hash of the transaction.
   * @returns A promise that resolves to the transaction receipt object, or null if not found/mined.
   */
  getTransactionReceipt(txHash: string): Promise<any | null>; // Type 'any' for now, can be refined with ethers specific type if desired
}

// TODO: Crear mas interfaces cuando sea necesario.
// export interface IAccountAbstractionWallet {
//   /** Account Abstraction for EVM (ERC-4337) */
//   createUserOperation(tx: TransactionData): Promise<UserOperation>;
//   sendUserOperation(userOp: UserOperation): Promise<string>;
//   getPaymasterSponsorship(userOp: UserOperation): Promise<PaymasterData>;
//   getEntryPointAddress(): Promise<string>;
//   estimateUserOperationGas(userOp: UserOperation): Promise<string>; // Pre-flight gas estimation
//   getUserOperationStatus(userOpId: string): Promise<string>; // Track op status
// }

// export interface IMetaTransactionWallet {
//   /** Meta-Transactions for EVM */
//   signMetaTransaction(tx: TransactionData): Promise<string>;
//   relayMetaTransaction(signedTx: string): Promise<string>;
//   getRelayerAddress(): Promise<string>;
//   cancelMetaTransaction(signedTx: string): Promise<boolean>; // Allow cancellation
//   estimateFee(tx: TransactionData): Promise<string>; // Pre-calculate fee
// }

// export interface IDecentralizedIdentityWallet extends IEVMWallet {
//   /** Decentralized Identity for EVM */
//   createDID(method: string, options?: any): Promise<string>;
//   resolveDID(did: string): Promise<DIDDocument>;
//   issueCredential(did: string, credential: VerifiableCredential): Promise<string>;
//   verifyCredential(credential: VerifiableCredential): Promise<boolean>;
//   updateDID(did: string, updateData: any): Promise<string>; // Support DID modifications
//   revokeCredential(credentialId: string): Promise<boolean>; // Manage lifecycle of credentials
// }
