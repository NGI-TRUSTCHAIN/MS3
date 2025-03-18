import { ICoreWallet } from "..";
import { SignTypedDataVersion } from "../../enums";
import { TypedData, TransactionData, UserOperation, PaymasterData, DIDDocument, VerifiableCredential } from "../../types";
// TODO: Add EVM-specific types y separar en carpetas. 
export interface EVMWallet extends ICoreWallet {
  /** EVM-Specific Features */
  signTypedData(data: TypedData, version?: SignTypedDataVersion): Promise<string>;
  getGasPrice(): Promise<string>;
  estimateGas(tx: TransactionData): Promise<string>;
}

/** Account Abstraction for EVM (ERC-4337) */
export interface AccountAbstractionWallet {
  createUserOperation(tx: TransactionData): Promise<UserOperation>;
  sendUserOperation(userOp: UserOperation): Promise<string>;
  getPaymasterSponsorship(userOp: UserOperation): Promise<PaymasterData>;
  getEntryPointAddress(): Promise<string>;
}

/** Meta-Transactions for EVM */
export interface MetaTransactionWallet {
  signMetaTransaction(tx: TransactionData): Promise<string>;
  relayMetaTransaction(signedTx: string): Promise<string>;
  getRelayerAddress(): Promise<string>;
}

export interface DecentralizedIdentityWallet {
  createDID(method: string, options?: any): Promise<string>;
  resolveDID(did: string): Promise<DIDDocument>;
  issueCredential(did: string, credential: VerifiableCredential): Promise<string>;
  verifyCredential(credential: VerifiableCredential): Promise<boolean>;
}
