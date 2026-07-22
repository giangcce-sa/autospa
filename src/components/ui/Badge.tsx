import { cn } from "@/lib/utils";
import { mediaStatusPresentation } from "@/lib/media-gallery";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

const styles: Record<BadgeVariant, { background: string; color: string }> = {
  default: { background: "var(--accent-light)", color: "var(--accent)" },
  success: { background: "var(--accent-light)", color: "var(--accent)" },
  warning: { background: "var(--amber-light)", color: "var(--amber)" },
  danger: { background: "var(--rose-light)", color: "var(--rose)" },
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
      className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold", className)}
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
