interface Chain {
  chainId: number | string;
  name: string;
  symbol: string;
}

interface ChainSelectProps {
  chains: Chain[];
  selected: string | number | null;
  onSelect: (chainId: string | number) => void;
}

export default function ChainSelect({ chains, selected, onSelect }: ChainSelectProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Select destination chain
      </label>
      <select
        className="w-full border border-gray-300 rounded-md p-2 text-sm"
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>Select a chain</option>
        {chains.map((chain) => (
          <option key={chain.chainId} value={chain.chainId}>
            {chain.name} ({chain.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
