import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, loadingLabel = "Đang xử lý", disabled, children, type = "button", style, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50";

    const variants = {
      primary: "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_6px_16px_rgba(47,111,84,0.16)] hover:bg-[var(--accent-hover)] active:translate-y-px",
      secondary: "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] active:translate-y-px",
      ghost: "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] active:translate-y-px",
      danger: "bg-[var(--danger)] text-[var(--danger-foreground)] hover:brightness-90 active:translate-y-px",
    };

    const sizes = {
      sm: "min-h-9 px-3 text-xs",
      md: "min-h-11 px-4 text-sm",
      lg: "min-h-12 px-5 text-sm",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(base, variants[variant], sizes[size], className)}
        style={style}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
        )}
        {loading ? <span>{loadingLabel}</span> : children}
      </button>
    );
  },
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
