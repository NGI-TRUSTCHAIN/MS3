"use client";

import { useEffect, useState } from "react";
import { providerConfig } from "@/data/supportedChains";
import { createWallet, IEVMWallet, NetworkHelper } from "@m3s/wallet";
import { PRIVATE_RPCS } from "@/data/private_rcps";
import { createCrossChain } from "@m3s/crosschain";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import DocStep from "@/components/ui/DocStep";
import docSteps from "@/data/usecase3-doc.json";

export default function Usecase3Page() {
  const [adapterType, setAdapterType] = useState<"ethers" | "web3auth">(
    "ethers"
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [crosschainProvider, setCrosschainProvider] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);

  const [walletProvider, setWalletProvider] = useState<any>(null);
  const [polygonConfig, setPolygonConfig] = useState<any>(null);
  const [comision, setComision] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<string | null>(null);
  const [amount, setAmount] = useState("0.1");

  const _createWallet = async () => {
    try {
      if (adapterType === "ethers") {
        const wallet = await createWallet<IEVMWallet>({
          name: "ethers",
          version: "1.0.0",
          expectedInterface: "IEVMWallet",
          options: {
            privateKey:
              "0x4b7c60e8658b44f23f84ce946df1a77ac8a09e5b8a3cb9fc5f979859f7315ad1",
            provider: providerConfig,
            multiChainRpcs: {
              "10": [PRIVATE_RPCS.optimism[0]],
              "137": [PRIVATE_RPCS.matic[0]],
            },
          },
        });
        setWalletProvider(wallet);
        const accounts = await wallet.getAccounts();
        setWalletAddress(accounts[0]);

        console.log(wallet.getAllChainRpcs());
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

  useEffect(() => {
    const onInit = async () => {
      const polygonPreferredRpc = `https://polygon-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1`;

      const networkHelper = NetworkHelper.getInstance();
      await networkHelper.ensureInitialized();
      console.log('networkHelper', networkHelper);

      const polygonConfig = await networkHelper.getNetworkConfig("matic", [
        polygonPreferredRpc,
      ]);
      console.log('polygonConfig', polygonConfig)
      setPolygonConfig(polygonConfig);
    };
    onInit();
  }, []);

  const MATIC_POLYGON = {
    chainId: polygonConfig?.chainId,
    address: "0x0000000000000000000000000000000000001010",
    symbol: "MATIC",
    decimals: 18,
    name: "Matic Token",
  };

  const USDC_POLYGON = {
    chainId: polygonConfig?.chainId,
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin Polygon",
  };

  const USDC_OPTIMISM = {
    chainId: "10",
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin Optimism",
  };

  const checkBalance = async () => {
    const crosschain = await createCrossChain({
      name: "lifi",
      version: "1.0.0",
      options: {
        apiKey:
          "5914aec1-53de-4147-b701-f2751beb4432.47b2600f-bf0e-428b-a9e5-1737f8cc97d4",
        multiChainRpcs: {
          "137": [
            `https://polygon-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1`,
          ],
          "10": [
            `https://optimism-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1`,
          ],
          "0x89": [
            `https://polygon-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1`,
          ],
          "0xa": [
            `https://optimism-mainnet.infura.io/v3/5791a18dd1ee45af8ac3d79b549d54f1`,
          ],
        },
      },
    });

    setCrosschainProvider(crosschain);

    const swapIntent = {
      sourceAsset: USDC_POLYGON,
      destinationAsset: USDC_OPTIMISM,
      amount: amount,
      userAddress: walletAddress as string,
      slippageBps: 100,
    };

    const quotes = await crosschain.getOperationQuote(swapIntent);
    const quote = quotes[0];
    console.log("quotes", quotes);

    setComision(quote.feeUSD);
    setQuote(quote);
  };

  const makeTx = async () => {
    const initialResult = await crosschainProvider.executeOperation(quote, {
      wallet: walletProvider,
    });
    console.log("🚀 Swap execution initiated:", initialResult);

    crosschainProvider.on("status", (stat: any) =>
      console.log("NEW STATUS", stat)
    );
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
        <Button onClick={_createWallet}>Create Wallet</Button>

        {walletAddress && (
          <div className="text-sm text-gray-800">
            Wallet address: <strong>{walletAddress}</strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>2. Check balance</p>
        <input
          type="text"
          inputMode="decimal"
          pattern="^\d*\.?\d*$"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;

            // Solo permitir números con punto como separador decimal
            if (/^\d*\.?\d*$/.test(val)) {
              setAmount(val);
            }
          }}
          className="border px-2 py-1 rounded"
        />
        <Button onClick={checkBalance} disabled={!walletAddress}>
          Check Incoming Balance
        </Button>

        {comision && (
          <div className="text-sm text-green-700">
            Comision: <code>{comision}USDC</code>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-4 mt-8 border p-4 rounded-xl border-gray-200">
        <p>3. Make tx</p>
        {/* <ChainSelect
          chains={supportedChains}
          selected={destinationChainId}
          onSelect={setDestinationChainId}
        /> */}
        <Button onClick={makeTx} disabled={!comision}>
          Make Tx
        </Button>

        {refundTx && (
          <div className="text-sm text-green-700">
            Transaction: <code>{refundTx}</code>
          </div>
        )}
      </div>
    </Container>
  );
}
