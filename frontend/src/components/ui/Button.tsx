import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:brightness-110 shadow-card",
  secondary: "bg-surface text-text border border-border hover:bg-primary-50 hover:border-primary-100",
  ghost: "text-muted hover:text-text hover:bg-neu-bg",
  danger: "bg-neg text-white hover:bg-rose-800",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", loading, icon, size = "md", className = "", children, disabled, ...rest }: Props) {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-base" }[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${sizes} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
