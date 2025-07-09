import Card from "./ui/Card";

const usecases = [
  {
    title: "Use Case 1: Wallet + Sign",
    description: "Create a wallet and sign a document using Ethers or Web3Auth.",
    href: "/usecase-1",
  },
  {
    title: "Use Case 2: Smart Contract + Mint",
    description: "Create a wallet, deploy a contract and mint a token.",
    href: "/usecase-2",
  },
  {
    title: "Use Case 3: Crosschain Transfer",
    description: "Receive funds and return them in a different currency.",
    href: "/usecase-3",
  },
];

export default function UsecaseList() {
  return (
    <div className="grid md:grid-cols-2 gap-6 mt-6">
      {usecases.map((uc) => (
        <Card key={uc.href} {...uc} />
      ))}
    </div>
  );
}
