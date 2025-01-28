////////////////////////////////////////////////////////
// SOLANA WALLET (would be in solanaWallet.ts)

import { CoreWallet } from "..";
import { TransactionData } from "../../types";

////////////////////////////////////////////////////////
export interface SolanaWallet extends CoreWallet {
    /** Solana-Specific Features */
    signMessageWithMemo(message: string, memo: string): Promise<string>;
    getRecentBlockhash(): Promise<string>;
    sendTransactionWithFeePayer(tx: TransactionData, feePayer: string): Promise<string>;
  }
  