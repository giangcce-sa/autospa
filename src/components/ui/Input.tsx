import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

function describedBy(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, style, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const hintId = hint && !error ? `${controlId}-hint` : undefined;
    const errorId = error ? `${controlId}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={controlId} className="block text-[13px] font-semibold text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={controlId}
          aria-describedby={describedBy(ariaDescribedBy, hintId, errorId)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-h-11 w-full rounded-md border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-[border-color,box-shadow,background-color] duration-150",
            "placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]",
            className,
          )}
          style={{ borderColor: error ? "var(--danger)" : undefined, ...style }}
          {...props}
        />
        {error && <p id={errorId} className="text-xs text-[var(--danger)]">{error}</p>}
        {hint && !error && <p id={hintId} className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, style, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const hintId = hint && !error ? `${controlId}-hint` : undefined;
    const errorId = error ? `${controlId}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={controlId} className="block text-[13px] font-semibold text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={controlId}
          aria-describedby={describedBy(ariaDescribedBy, hintId, errorId)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-h-24 w-full resize-y rounded-md border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-[border-color,box-shadow,background-color] duration-150",
            "placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]",
            className,
          )}
          style={{ borderColor: error ? "var(--danger)" : undefined, ...style }}
          {...props}
        />
        {error && <p id={errorId} className="text-xs text-[var(--danger)]">{error}</p>}
        {hint && !error && <p id={hintId} className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
