import Link from "next/link";
import { clsx } from "clsx";

type Props = {
  title: string;
  description: string;
  href: string;
  className?: string;
};

export default function Card({ title, description, href, className }: Props) {
  return (
    <Link href={href} className={clsx("block p-5 rounded-2xl shadow-md bg-white hover:shadow-lg transition", className)}>
      <h3 className="text-xl font-semibold text-[#131C3B] mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
