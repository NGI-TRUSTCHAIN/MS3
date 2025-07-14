"use client";

import { useState } from "react";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase2-doc.json";
import { snippetERC20 } from "@/data/snippet-ERC20";
import { snippetERC721 } from "@/data/snippet-ERC721";
import { PRIVATE_RPCS } from "@/data/private_rcps";
import { providerConfig } from "@/data/supportedChains";
import axios from "axios";

export default function Usecase2Page() {
  //Wallet Module
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletProvider, setWalletProvider] = useState<any>(null);

  //Smart contract Module
  const [contractType, setContractType] = useState<"erc20" | "erc721">(
    "erc721"
  );
  const [deployedOutput, setDeployedOutput] = useState<any>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  const _createWallet = async () => {
    try {
      if (adapterType === "ethers") {
        //Use createWallet fc (Provider)
        //setWalletProvider
        //With provider use getAccounts fc
        //setWalletAddress
      } else {
      }
    } catch (e) {
      console.log("error", e);
    }
  };

  const createContract = async () => {
    const res = await axios.post("/api/sc/generate", {
      contractType,
    });

    setDeployedOutput(res.data.deployedOutput);
  };

  const deployContract = async () => {
    //Use wallet provider with sendTransaction fc
    //Use waitForReceipt fc
    //Use waitForReceipt fc
  };

  return (
    <Container>
      <SectionTitle>Use Case 2: Deploy + Mint</SectionTitle>

      <p className="text-gray-600 mb-6">
        This demo lets you create a wallet, deploy a token or NFT contract, and
        mint a token.
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
        <Button onClick={_createWallet}>Create Wallet</Button>

        {walletAddress && (
          <>
            <div className="text-sm text-gray-800">
              Wallet address: <strong>{walletAddress}</strong>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>2. Fund wallet</p>
        <a
          href="https://holesky-faucet.pk910.de"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline text-blue-600"
        >
          → Fund wallet with Goerli Faucet
        </a>
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>3. Create contract</p>
        <div className="w-full flex items-center gap-x-4">
          <Button
            variant={contractType === "erc721" ? "primary" : "secondary"}
            onClick={() => setContractType("erc721")}
          >
            ERC721
          </Button>
          <Button
            variant={contractType === "erc20" ? "primary" : "secondary"}
            onClick={() => setContractType("erc20")}
          >
            ERC20
          </Button>
        </div>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
          {contractType === "erc20" ? (
            <code>{snippetERC20}</code>
          ) : (
            <code>{snippetERC721}</code>
          )}
        </pre>
        <Button onClick={createContract} disabled={!walletAddress}>
          Create and compile Contract ({contractType.toUpperCase()})
        </Button>
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>5. Deploy contract</p>
        <Button onClick={deployContract} disabled={!walletAddress}>
          Deploy Contract ({contractType.toUpperCase()})
        </Button>
        {contractAddress && (
          <div className="text-sm text-green-700">
            Contract deployed at: <code>{contractAddress}</code>
          </div>
        )}
      </div>
    </Container>
  );
}
