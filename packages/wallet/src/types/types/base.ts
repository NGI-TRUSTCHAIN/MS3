export type TransactionData = {
    from?: string;
    to: string;
    value?: string | bigint;
    data?: string;
    nonce?: number;
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
};

export type TypedData = any; // EIP-712 structure
// export type UserOperation = any;
// export type PaymasterData = any;
// export type DIDDocument = any; // Ver lo que monto angelinesh de DID.
// export type VerifiableCredential = any;