export default function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-2xl font-bold text-[#131C3B] text-center mb-4 border-b border-gray-200 pb-2">
      {children}
    </h2>
  );
}
