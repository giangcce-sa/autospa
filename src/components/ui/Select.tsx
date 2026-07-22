import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef, useId } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, children, id, style, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const errorId = error ? `${controlId}-error` : undefined;
    const hintId = hint && !error ? `${controlId}-hint` : undefined;
    const description = [ariaDescribedBy, errorId, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={controlId} className="block text-[13px] font-semibold text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={controlId}
          aria-describedby={description}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-h-11 w-full cursor-pointer rounded-md border bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-[border-color,box-shadow,background-color] duration-150",
            "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]",
            className,
          )}
          style={{ borderColor: error ? "var(--danger)" : undefined, ...style }}
          {...props}
        >
          {children}
        </select>
        {error && <p id={errorId} className="text-xs text-[var(--danger)]">{error}</p>}
        {hint && !error && <p id={hintId} className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
