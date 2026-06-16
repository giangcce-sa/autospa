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
        borderColor: "var(--accent)",
        boxShadow: "0 0 0 1px var(--accent), var(--shadow-sm)",
      };
    case "premium":
      return {
        background: "var(--bg-card)",
        borderColor: "var(--premium)",
        boxShadow: "var(--shadow-premium)",
      };
    case "subtle":
      return {
        background: "var(--bg-subtle)",
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
      className={cn("rounded-xl border", PADDING_MAP[padding], className)}
      style={{
        ...variantStyle(variant),
        transition: "box-shadow 0.18s ease, border-color 0.18s ease",
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
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-semibold text-sm", className)} style={{ color: "var(--text)" }} {...props}>
      {children}
    </h3>
  );
}
