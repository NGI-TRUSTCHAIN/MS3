"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase1-doc.json";
import { PRIVATE_RPCS } from "@/data/private_rcps";
import { providerConfig } from "@/data/supportedChains";

// Simulated document to sign
const DEFAULT_DOCUMENT = "This is a sample document to be signed.";

export default function Usecase1Page() {
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletProvider, setWalletProvider] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [document, setDocument] = useState<string>(DEFAULT_DOCUMENT);
  const [feedback, setFeedback] = useState("");

  const _createWallet = async () => {
    try {
      //Use createWallet fc (Provider)
      //setWalletProvider

      //With provider use getAccounts fc
      //setWalletAddress
      if (adapterType === "ethers") {
      } else {
      }
    } catch (e) {
      console.log("error", e);
    }
  };

  const signDocument = async () => {
    try {
      //use signMessage fc
    } catch (e) {
      console.log("error", e);
    }
  };

  const verifySignature = async () => {
    try {
      //use verifySignature fc
    } catch (e) {
      setFeedback("❌ Signature is invalid");
      console.log("error", e);
    }
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
        <Button onClick={_createWallet}>Create Wallet</Button>

        {walletAddress && (
          <div className="text-sm text-gray-800">
            Wallet address: <strong>{walletAddress}</strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>2. Sign doc</p>
        <div className="space-y-4">
          <div>
            <textarea
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full border rounded-md p-2 text-sm text-gray-800"
              rows={4}
            />

            <Button onClick={signDocument} disabled={!walletAddress}>
              Sign Document
            </Button>
          </div>
          {signature && (
            <div className="text-sm text-gray-800 break-words">
              Signature: <strong>{signature}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>3. Verify signature</p>
        {signature && (
          <>
            <div className="break-all text-lg mt-2 mb-4 mx-2">
              <p>Enter signature to validate:</p>
              <input
                type="text"
                onChange={(e) => setSignature(e.target.value)}
                className="w-full p-2 mt-1 border rounded text-sm text-gray-800"
              />
            </div>
            <Button onClick={verifySignature} disabled={!signature}>
              Verify Signature
            </Button>
          </>
        )}
        <div className={`text-sm font-medium mt-2`}>{feedback}</div>
      </div>
    </Container>
  );
}
