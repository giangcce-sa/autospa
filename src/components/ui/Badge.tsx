import { cn } from "@/lib/utils";

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
      className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", className)}
      style={styles[variant]}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    draft: { label: "Nháp", variant: "neutral" },
    scheduled: { label: "Đã lên lịch", variant: "info" },
    published: { label: "Đã đăng", variant: "success" },
    failed: { label: "Thất bại", variant: "danger" },
    pending: { label: "Chờ xử lý", variant: "warning" },
    confirmed: { label: "Đã xác nhận", variant: "success" },
    cancelled: { label: "Đã hủy", variant: "danger" },
    done: { label: "Hoàn thành", variant: "neutral" },
  };
  const item = map[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
