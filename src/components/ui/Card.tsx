import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type CardVariant = "default" | "highlight" | "premium" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  variant?: CardVariant;
}

const PADDING_MAP = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

function variantStyle(variant: CardVariant): React.CSSProperties {
  switch (variant) {
    case "highlight":
      return {
        background: "var(--bg-card)",
        borderColor: "color-mix(in srgb, var(--accent) 56%, var(--border))",
        boxShadow: "var(--shadow-md)",
      };
    case "premium":
      return {
        background: "var(--bg-card)",
        borderColor: "color-mix(in srgb, var(--premium) 58%, var(--border))",
        boxShadow: "var(--shadow-premium)",
      };
    case "subtle":
      return {
        background: "color-mix(in srgb, var(--bg-subtle) 82%, var(--bg-card))",
        borderColor: "transparent",
        boxShadow: "none",
      };
    default:
      return {
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      };
  }
}

export function Card({ className, padding = "md", variant = "default", children, style, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-[var(--radius-xl)] border", PADDING_MAP[padding], className)}
      style={{
        ...variantStyle(variant),
        transition: "box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3.5 flex items-center justify-between gap-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[15px] font-bold tracking-tight text-[var(--text)]", className)} {...props}>
      {children}
    </h3>
  );
}
