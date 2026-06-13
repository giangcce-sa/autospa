import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ className, padding = "md", children, style, ...props }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

  return (
    <div
      className={cn("rounded-xl border transition-shadow duration-200", paddings[padding], className)}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)", ...style }}
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
