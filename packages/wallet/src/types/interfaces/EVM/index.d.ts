import { SignTypedDataVersion } from "@web3auth/ethereum-provider";
import { TransactionReceipt } from "ethers";
import { TransactionData, TypedData } from "../../types/index.js";
import { ICoreWallet } from "../base.js";
export interface IEVMWallet extends ICoreWallet {
    /** EVM-Specific Features */
    signTypedData(data: TypedData, version?: SignTypedDataVersion): Promise<string>;
    getGasPrice(): Promise<string>;
    estimateGas(tx: TransactionData): Promise<string>;
    getTransactionReceipt(txHash: string): Promise<TransactionReceipt>;
    getTokenBalance(tokenAddress: string, account?: string): Promise<string>;
}
