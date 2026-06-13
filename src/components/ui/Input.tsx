import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all duration-150",
            "focus:ring-2 placeholder:opacity-40",
            className
          )}
          style={{
            background: "var(--bg-card)",
            borderColor: error ? "var(--rose)" : "var(--border)",
            color: "var(--text)",
          }}
          {...props}
        />
        {error && <p className="text-xs" style={{ color: "var(--rose)" }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all duration-150 resize-none",
            "focus:ring-2 placeholder:opacity-40",
            className
          )}
          style={{
            background: "var(--bg-card)",
            borderColor: error ? "var(--rose)" : "var(--border)",
            color: "var(--text)",
          }}
          {...props}
        />
        {error && <p className="text-xs" style={{ color: "var(--rose)" }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
