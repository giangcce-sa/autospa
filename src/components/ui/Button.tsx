import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

    const variants = {
      primary: "text-white active:scale-[0.98]",
      secondary: "border active:scale-[0.98]",
      ghost: "hover:opacity-80 active:scale-[0.98]",
      danger: "text-white active:scale-[0.98]",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-5 py-2.5 text-sm",
    };

    const styles = {
      primary: { background: "var(--accent)", color: "white" },
      secondary: { background: "var(--bg-card)", color: "var(--text)", borderColor: "var(--border)" },
      ghost: { background: "transparent", color: "var(--text-secondary)" },
      danger: { background: "var(--rose)", color: "white" },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        style={styles[variant]}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
