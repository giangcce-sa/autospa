import { cn } from "@/lib/utils";
import type { CSSProperties, ElementType, HTMLAttributes } from "react";

type SurfaceVariant = "default" | "subtle" | "elevated" | "highlight" | "premium";
type SurfacePadding = "none" | "compact" | "default" | "spacious";
type CardPadding = "none" | "sm" | "md" | "lg";

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  padding?: SurfacePadding;
  variant?: SurfaceVariant;
  interactive?: boolean;
}

const PADDING_CLASSES: Record<SurfacePadding, string> = {
  none: "",
  compact: "p-[var(--panel-padding-compact)]",
  default: "p-[var(--panel-padding)]",
  spacious: "p-6",
};

const SURFACE_STYLES: Record<SurfaceVariant, CSSProperties> = {
  default: {
    background: "var(--surface-card)",
    borderColor: "var(--border)",
    boxShadow: "var(--shadow-sm)",
  },
  subtle: {
    background: "var(--surface-subtle)",
    borderColor: "var(--border-subtle)",
    boxShadow: "none",
  },
  elevated: {
    background: "var(--surface-elevated)",
    borderColor: "var(--border)",
    boxShadow: "var(--shadow-md)",
  },
  highlight: {
    background: "var(--surface-card)",
    borderColor: "color-mix(in srgb, var(--accent) 56%, var(--border))",
    boxShadow: "var(--shadow-md)",
  },
  premium: {
    background: "var(--surface-card)",
    borderColor: "color-mix(in srgb, var(--premium) 58%, var(--border))",
    boxShadow: "var(--shadow-premium)",
  },
};

export function Surface({
  as: Component = "div",
  className,
  padding = "default",
  variant = "default",
  interactive = false,
  children,
  style,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-xl)] border",
        PADDING_CLASSES[padding],
        interactive && "card-hover focus-within:border-[var(--border-focus)]",
        className,
      )}
      style={{ ...SURFACE_STYLES[variant], ...style }}
      {...props}
    >
      {children}
    </Component>
  );
}

export function SurfaceHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)} {...props}>
      {children}
    </div>
  );
}

export function SurfaceTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[15px] font-bold tracking-tight text-[var(--text)]", className)} {...props}>
      {children}
    </h3>
  );
}

export function SurfaceDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-[13px] leading-5 text-[var(--text-muted)]", className)} {...props}>
      {children}
    </p>
  );
}

export function SurfaceBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4", className)} {...props}>
      {children}
    </div>
  );
}

export function SurfaceFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4", className)} {...props}>
      {children}
    </div>
  );
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  variant?: SurfaceVariant;
  interactive?: boolean;
}

const CARD_PADDING: Record<CardPadding, SurfacePadding> = {
  none: "none",
  sm: "compact",
  md: "default",
  lg: "spacious",
};

export function Card({ padding = "md", ...props }: CardProps) {
  return <Surface as="div" padding={CARD_PADDING[padding]} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <SurfaceHeader className={cn("mb-3.5 items-center", className)} {...props} />;
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  return <SurfaceTitle {...props} />;
}
