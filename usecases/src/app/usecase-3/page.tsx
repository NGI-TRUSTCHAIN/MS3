"use client";

import { useState } from "react";
import { supportedChains } from "@/data/supportedChains";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase3-doc.json";
import ChainSelect from "@/components/ui/ChainSelect";

export default function Usecase3Page() {
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<string | null>(null);
  const [destinationChainId, setDestinationChainId] = useState<
    string | number | null
  >(null);

  let wallet: any = null;
  let crossChain: any = null;

  const createWallet = async () => {
    /**
     * TODO: Import and instantiate @m3s/wallet with selected adapter
     * Connect and get wallet address
     */
  };

  const checkBalance = async () => {
    /**
     * TODO: Query wallet balance using wallet provider
     * Example with ethers: provider.getBalance(walletAddress)
     * Format and store the result in `setBalance`
     */
  };

  const returnFunds = async () => {
    /**
     * Use m3s crosschain module to send funds back in the selected currency
     * Example:
     * - Convert ETH → USDC or simulate cross-chain swap
     * Store transaction hash in `setRefundTx`
     */
  };

  return (
    <Container>
      <SectionTitle>Use Case 3: Crosschain Transfer</SectionTitle>

      <p className="text-gray-600 mb-6">
        This demo shows how to receive funds and return them in a different
        currency.
      </p>

      {docSteps.map((step: any) => (
        <DocStep key={step.step} {...step} />
      ))}

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>1. Create wallet</p>
        <div className="w-full flex gap-x-4">
          <Button
            variant={adapterType === "ethers" ? "primary" : "secondary"}
            onClick={() => setAdapterType("ethers")}
          >
            Ethers
          </Button>
          <Button
            variant={adapterType === "web3auth" ? "primary" : "secondary"}
            onClick={() => setAdapterType("web3auth")}
          >
            Web3Auth
          </Button>
        </div>
        <Button onClick={createWallet}>Create Wallet</Button>

        {walletAddress && (
          <div className="text-sm text-gray-800">
            Wallet address: <strong>{walletAddress}</strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>2. Check balance</p>
        <Button onClick={checkBalance} disabled={!walletAddress}>
          Check Incoming Balance
        </Button>

        {balance && (
          <div className="text-sm text-green-700">
            Current balance: <code>{balance}</code>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>3. Return funds</p>
        <ChainSelect
          chains={supportedChains}
          selected={destinationChainId}
          onSelect={setDestinationChainId}
        />
        <Button onClick={returnFunds} disabled={!balance}>
          Return Funds
        </Button>

        {refundTx && (
          <div className="text-sm text-green-700">
            Refund transaction: <code>{refundTx}</code>
          </div>
        )}
      </div>
    </Container>
  );
}
