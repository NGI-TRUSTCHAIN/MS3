import { IRequiredMethods, IEVMRequiredMethods } from "../enums";

export type TransactionData = { from?: string; to: string; value: string; data?: string };
export type TypedData = any; // EIP-712 structure
export type UserOperation = any;
export type PaymasterData = any;
export type DIDDocument = any; // Ver lo que monto angelinesh de DID.
export type VerifiableCredential = any;

// Method enums.
export type IBaseMethods = IRequiredMethods;
export type IEVMMethods = IRequiredMethods | IEVMRequiredMethods;