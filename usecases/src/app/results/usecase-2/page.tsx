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
import { createWallet } from "@m3s/wallet";

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
              clientId:
                "BLgyMSY64LJfOo-6dEPmsFs51oVZJafLC6l5S4NjxsMUrlj9c-_5B0BV9VlOwgU8R7LfkKwImDYIMVPdHCIoHI8",
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
                  verifier: "m3s-google-client",
                  typeOfLogin: "google",
                  clientId:
                    "279202560930-jfr3a5htp9b720mhh3t7v1j5ntsjm7k1.apps.googleusercontent.com",
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
            },
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

  const createContract = async () => {
    const res = await axios.post("/api/results/sc/generate", {
      contractType,
    });

    console.log("sourceCode", res.data.deployedOutput);
    setDeployedOutput(res.data.deployedOutput);
  };

  const deployContract = async () => {
    const deployTxHash = await walletProvider.sendTransaction({
      data: deployedOutput.data,
      value: deployedOutput.value || "0",
    });
    const waitForReceipt = async (
      txHash: string,
      maxAttempts = 20,
      waitTime = 6000
    ) => {
      for (let i = 0; i < maxAttempts; i++) {
        const receipt = await walletProvider.getTransactionReceipt(txHash);
        if (receipt) {
          console.log(
            `Receipt found for ${txHash} (attempt ${i + 1}). Status: ${
              receipt.status
            }`
          );
          return receipt;
        }
        console.log(
          `Receipt not found for ${txHash} (attempt ${i + 1}). Waiting ${
            waitTime / 1000
          }s...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      console.error(
        `Receipt not found for ${txHash} after ${maxAttempts} attempts.`
      );
      return null;
    };

    const deploymentReceipt = await waitForReceipt(deployTxHash);
    console.log('deploymentReceipt', deploymentReceipt);
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
