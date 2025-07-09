import { clsx } from "clsx";
import { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

export default function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const base = "cursor-pointer px-4 py-2 rounded-xl font-medium transition";
  const variants = {
    primary: "bg-[#131C3B] text-white hover:bg-[#1a274f]",
    secondary: "bg-white text-[#131C3B] border border-[#131C3B] hover:bg-gray-100",
  };
  return (
    <button
      className={clsx(base, variants[variant], className)}
      {...props}
    />
  );
}
