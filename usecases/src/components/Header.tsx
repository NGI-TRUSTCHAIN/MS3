import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="M3S Logo" width={30} height={30} />
        <span className="font-semibold text-[#131C3B] text-lg">M3S</span>
      </Link>
    </header>
  );
}
