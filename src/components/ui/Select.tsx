import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all duration-150 cursor-pointer",
            className
          )}
          style={{
            background: "var(--bg-card)",
            borderColor: error ? "var(--rose)" : "var(--border)",
            color: "var(--text)",
          }}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs" style={{ color: "var(--rose)" }}>{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
