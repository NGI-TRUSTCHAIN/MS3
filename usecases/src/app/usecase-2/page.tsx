"use client";

import { useState } from "react";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase2-doc.json";
import { snippetERC20 } from "@/data/snippet-ERC20";
import { snippetERC721 } from "@/data/snippet-ERC721";

export default function Usecase2Page() {
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );
  const [contractType, setContractType] = useState<"erc20" | "erc721">(
    "erc721"
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  let wallet: any = null; // Replace with actual wallet instance
  let smartContract: any = null; // Replace with m3s smart contract instance

  const createWallet = async () => {
    /**
     * TODO: Import and instantiate @m3s/wallet with selected adapter:
     * - EthersAdapter or Web3AuthAdapter
     * - Connect and get wallet address
     */
  };

  const deployContract = async () => {
    /**
     * TODO: Create contract definition before deploying
     *
     * Example:
     * const contractData = {
     *   name: "MyToken",
     *   symbol: "MTK",
     *   baseUri: "https://example.com/metadata/" // if ERC721
     * };
     *
     * Then:
     * - Use @m3s/smartcontract to deploy:
     *   const contract = new SmartContract(wallet, contractType);
     *   await contract.deploy(contractData);
     *   const address = contract.getAddress();
     *   setContractAddress(address);
     */
  };

  const mintToken = async () => {
    /**
     * TODO: Call the smart contract's mint function:
     * - Use a hardcoded recipient address or input
     * - Store transaction hash or result
     */
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
        <Button onClick={createWallet}>Create Wallet</Button>

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
          href="https://www.alchemy.com/faucets/ethereum-holesky"
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
        <Button onClick={deployContract} disabled={!walletAddress}>
          Create Contract ({contractType.toUpperCase()})
        </Button>
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>4. Compile contract</p>
        <Button onClick={deployContract} disabled={!walletAddress}>
          Compile Contract ({contractType.toUpperCase()})
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

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>{contractType === "erc20" ? '6. Mint token' : '6. Mint NFT'}</p>
        <Button onClick={mintToken} disabled={!contractAddress}>
          Mint {contractType === "erc20" ? 'token' : 'nft'}
        </Button>

        {mintTxHash && (
          <div className="text-sm text-green-700">
            Mint transaction: <code>{mintTxHash}</code>
          </div>
        )}
      </div>
    </Container>
  );
}
