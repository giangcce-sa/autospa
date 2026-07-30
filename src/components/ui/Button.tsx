import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export type ActionVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ActionSize = "sm" | "md" | "lg";

const ACTION_VARIANTS: Record<ActionVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_6px_16px_color-mix(in_srgb,var(--accent)_24%,transparent)] hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--action-secondary)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--action-secondary-hover)] hover:text-[var(--accent)]",
  ghost:
    "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--action-quiet-hover)] hover:text-[var(--text)]",
  quiet:
    "border border-transparent text-[var(--accent)] hover:bg-[var(--accent-light)]",
  danger:
    "bg-[var(--danger)] text-[var(--danger-foreground)] shadow-[0_6px_16px_color-mix(in_srgb,var(--danger)_20%,transparent)] hover:brightness-95",
};

const ACTION_SIZES: Record<ActionSize, string> = {
  sm: "min-h-[var(--control-height-sm)] px-3 text-[12.5px]",
  md: "min-h-[var(--control-height-md)] px-4 text-[13px]",
  lg: "min-h-[var(--control-height-lg)] px-5 text-[13.5px]",
};

export function actionStyles({
  variant = "primary",
  size = "md",
  iconOnly = false,
  fullWidth = false,
  className,
}: {
  variant?: ActionVariant;
  size?: ActionSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-bold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50",
    ACTION_VARIANTS[variant],
    ACTION_SIZES[size],
    iconOnly && "aspect-square px-0",
    fullWidth && "w-full",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant;
  size?: ActionSize;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, loadingLabel = "Đang xử lý", fullWidth, disabled, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={actionStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
      {loading ? <span>{loadingLabel}</span> : children}
    </button>
  ),
);

Button.displayName = "Button";

interface IconButtonProps extends ButtonProps {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, className, size = "md", ...props }, ref) => (
    <Button ref={ref} size={size} aria-label={label} className={cn("aspect-square px-0", className)} {...props}>
      {children}
    </Button>
  ),
);

IconButton.displayName = "IconButton";
