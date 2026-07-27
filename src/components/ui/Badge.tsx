import { cn } from "@/lib/utils";
import { mediaStatusPresentation } from "@/lib/media-gallery";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

/**
 * `default` is the brand accent; `success` must stay green and `danger` red.
 * Both used to borrow the accent/rose brand hues, which read as "on brand"
 * rather than "good"/"bad" now that the accent is purple and rose is a chart hue.
 */
const styles: Record<BadgeVariant, { background: string; color: string }> = {
  default: { background: "var(--accent-light)", color: "var(--accent)" },
  success: { background: "var(--green-light)", color: "var(--green)" },
  warning: { background: "var(--amber-light)", color: "var(--amber)" },
  danger: { background: "var(--danger-light)", color: "var(--danger)" },
  info: { background: "var(--blue-light)", color: "var(--blue)" },
  neutral: { background: "var(--bg-subtle)", color: "var(--text-secondary)" },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn("chip-tone inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-bold", className)}
      style={styles[variant]}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const domainStatus: Record<string, { label: string; variant: BadgeVariant }> = {
    confirmed: { label: "Đã xác nhận", variant: "success" },
    cancelled: { label: "Đã hủy", variant: "danger" },
    done: { label: "Hoàn thành", variant: "neutral" },
  };
  const mediaStatus = mediaStatusPresentation(status);
  const item = domainStatus[status] ?? { label: mediaStatus.label, variant: mediaStatus.tone };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
