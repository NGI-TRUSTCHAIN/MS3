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
export type TypedData = any;
