"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase1-doc.json";
import { PRIVATE_RPCS } from "@/data/private_rcps";
import { providerConfig } from "@/data/supportedChains";
import { createWallet } from "@m3s/wallet";

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
      if (adapterType === "ethers") {
        const wallet = await createWallet({
          name: "ethers",
          version: "1.0.0",
          expectedInterface: "IEVMWallet",
          options: {
            privateKey:
              "0x4b7c60e8658b44f23f84ce946df1a77ac8a09e5b8a3cb9fc5f979859f7315ad1",
            provider: providerConfig,
          },
        });
        setWalletProvider(wallet);
        const accounts = await wallet.getAccounts();
        setWalletAddress(accounts[0]);
      } else {
        const wallet = await createWallet({
          name: "web3auth",
          version: "1.0.0",
          expectedInterface: "IEVMWallet",
          options: {
            web3authConfig: {
              clientId: "BLgyMSY64LJfOo-6dEPmsFs51oVZJafLC6l5S4NjxsMUrlj9c-_5B0BV9VlOwgU8R7LfkKwImDYIMVPdHCIoHI8",
              web3AuthNetwork: "sapphire_devnet",
              chainConfig: {
                chainNamespace: "eip155",
                chainId: "0xaa36a7",
                rpcTarget: providerConfig.rpcUrls[1],
                displayName: "Sepolia Testnet",
                blockExplorerUrl: "https://sepolia.etherscan.io",
                ticker: "ETH",
                tickerName: "Ethereum",
              },
              loginConfig: {
                google: {
                  verifier: 'm3s-google-client',
                  typeOfLogin: "google",
                  clientId: '279202560930-jfr3a5htp9b720mhh3t7v1j5ntsjm7k1.apps.googleusercontent.com'
                },
              },
            },
            multiChainRpcs: {
              "1": PRIVATE_RPCS.ethereum,
              "137": PRIVATE_RPCS.matic,
              "42161": PRIVATE_RPCS.arbitrum,
              "10": PRIVATE_RPCS.optimism,
              "11155111": PRIVATE_RPCS.sepolia,
              "0x1": PRIVATE_RPCS.ethereum,
              "0x89": PRIVATE_RPCS.matic,
              "0xa4b1": PRIVATE_RPCS.arbitrum,
              "0xa": PRIVATE_RPCS.optimism,
              "0xaa36a7": PRIVATE_RPCS.sepolia,
            }
          },
        });
        console.log("walletProvider", wallet);
        setWalletProvider(wallet);
        const accounts = await wallet.getAccounts();
        setWalletAddress(accounts[0]);
      }
    } catch (e) {
      console.log("error", e);
    }
  };

  const signDocument = async () => {
    try {
      const sig = await walletProvider.signMessage(document);
      setSignature(sig);
    } catch (e) {
      console.log("error", e);
    }
  };

  const verifySignature = async () => {
    try {
      const recovered = await walletProvider.verifySignature(
        document,
        signature,
        walletAddress
      );
      recovered === true
        ? setFeedback(":white_check_mark: Signature is valid")
        : setFeedback(":x: Signature is invalid");
    } catch (e) {
      setFeedback(":x: Signature is invalid");
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
