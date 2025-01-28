////////////////////////////////////////////////////////
// BITCOIN WALLET (would be in bitcoinWallet.ts)

import { CoreWallet } from "..";
import { Utxo, TxInput, TxOutput } from "../../types";

////////////////////////////////////////////////////////
export interface BitcoinWallet extends CoreWallet {
    /** Bitcoin-Specific Features */
    signPsbt(psbt: string): Promise<string>;
    getUtxos(): Promise<Utxo[]>;
    createRawTransaction(inputs: TxInput[], outputs: TxOutput[]): Promise<string>;
  }