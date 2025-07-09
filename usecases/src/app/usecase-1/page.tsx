"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase1-doc.json";

// Simulated document to sign
const DEFAULT_DOCUMENT = "This is a sample document to be signed.";

export default function Usecase1Page() {
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [document, setDocument] = useState<string>(DEFAULT_DOCUMENT);
  const [verificationResult, setVerificationResult] = useState<null | boolean>(
    null
  );

  let wallet: any = null; // M3SWallet instance

  const createWallet = async () => {
    /**
     * Imports required (ensure you have these installed):
     *
     * import { M3SWallet } from "@m3s/wallet";
     * import { EthersAdapter } from "@m3s/wallet/adapters/ethers";
     * import { Web3AuthAdapter } from "@m3s/wallet/adapters/web3auth";
     */
    // 👇 Choose the adapter based on selection
    // let adapter;
    // if (adapterType === "ethers") {
    //   adapter = new EthersAdapter({
    //     network: "goerli", // or sepolia
    //     rpcUrl: "https://rpc.ankr.com/eth_goerli",
    //   });
    // } else {
    //   adapter = new Web3AuthAdapter({
    //     clientId: "YOUR_WEB3AUTH_CLIENT_ID", // ⛳ Replace with actual ID
    //     chainConfig: {
    //       chainNamespace: "eip155",
    //       chainId: "0x5", // Goerli
    //       rpcTarget: "https://rpc.ankr.com/eth_goerli",
    //     },
    //   });
    // }
    // wallet = new M3SWallet(adapter);
    // await wallet.connect();
    // const address = await wallet.getAddress();
    // setWalletAddress(address);
  };

  const signDocument = async () => {
    if (!wallet || !wallet.signMessage) return;

    // const sig = await wallet.signMessage(document);
    // setSignature(sig);
  };

  const verifySignature = async () => {
    if (!signature || !walletAddress) return;

    /**
     * You can use ethers.js to verify the signature:
     *
     * import { ethers } from "ethers";
     */
    // const recovered = ethers.utils.verifyMessage(document, signature);
    // setVerificationResult(recovered.toLowerCase() === walletAddress.toLowerCase());
  };

  return (
    <Container>
      <SectionTitle>Use Case 1: Wallet + Signature</SectionTitle>

      <p className="text-gray-600 mb-6">
        This demo lets you create a wallet using the selected adapter, sign a
        document, and verify the signature.
      </p>

      {docSteps.map((step) => (
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

      <div className="space-y-4">
        <textarea
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className="w-full border rounded-md p-2 text-sm text-gray-800"
          rows={4}
        />

        <Button onClick={signDocument} disabled={!walletAddress}>
          Sign Document
        </Button>

        {signature && (
          <>
            <div className="break-all text-lg text-green-700 mt-2 mb-4 mx-2">
              Signature: <br />
              <code>{signature}</code>
            </div>
            <Button onClick={verifySignature} disabled={!signature}>
              Verify Signature
            </Button>
          </>
        )}

        {verificationResult !== null && (
          <div
            className={`text-sm font-medium mt-2 ${
              verificationResult ? "text-green-600" : "text-red-600"
            }`}
          >
            {verificationResult
              ? "✅ Signature is valid."
              : "❌ Signature is invalid."}
          </div>
        )}
      </div>
    </Container>
  );
}
