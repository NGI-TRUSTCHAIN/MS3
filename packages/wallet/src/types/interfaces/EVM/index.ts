import { SignTypedDataVersion } from "@web3auth/ethereum-provider";
import { TransactionReceipt } from "ethers";
import { TransactionData, TypedData,
   // DIDDocument, PaymasterData, UserOperation, VerifiableCredential
   } from "../../types/index.js";
import { ICoreWallet } from "../base.js";

export interface IEVMWallet extends ICoreWallet {
  /** EVM-Specific Features */
  signTypedData(data: TypedData, version?: SignTypedDataVersion): Promise<string>;
  getGasPrice(): Promise<string>;
  estimateGas(tx: TransactionData): Promise<string>;
  getTransactionReceipt(txHash: string): Promise<TransactionReceipt>; // Retrieve tx details
  getTokenBalance(tokenAddress: string, account?: string): Promise<string>; // Support ERC-20 and similar tokens
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
