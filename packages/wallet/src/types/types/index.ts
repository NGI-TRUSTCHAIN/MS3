////////////////////////////////////////////////////////
// PLACEHOLDERS & TYPES (to be refactored or moved)
////////////////////////////////////////////////////////
export type WalletEvent = 'connect' | 'disconnect' | 'accountsChanged' | 'chainChanged';
export type TransactionData = { from?: string; to: string; value: string; data?: string };
export type TypedData = any; // EIP-712 structure
export type SignTypedDataVersion = 'V1' | 'V3' | 'V4';
export type Utxo = { txid: string; vout: number; amount: number };
export type TxInput = { txid: string; vout: number };
export type TxOutput = { address: string; amount: number };
export type UserOperation = any;
export type PaymasterData = any;
export type DIDDocument = any;
export type VerifiableCredential = any;