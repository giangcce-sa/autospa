import { cn } from "@/lib/utils";

interface StateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  density?: "compact" | "panel" | "page";
  className?: string;
}

export function EmptyState(props: StateProps) {
  return <StateLayout {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateLayout {...props} role="alert" tone="danger" />;
}

export function PermissionState(props: StateProps) {
  return <StateLayout {...props} tone="warning" />;
}

export function UnavailableState(props: StateProps) {
  return <StateLayout {...props} tone="info" />;
}

export function LoadingState({
  title = "Đang tải dữ liệu",
  description,
  density = "panel",
  className,
}: {
  title?: string;
  description?: string;
  density?: StateProps["density"];
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center text-center", densityClass(density), className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent-light)] border-t-[var(--accent)] motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {description ? <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
    </div>
  );
}

function StateLayout({
  icon,
  title,
  description,
  action,
  secondaryAction,
  density = "panel",
  className,
  role,
  tone = "neutral",
}: StateProps & { role?: "alert"; tone?: "neutral" | "warning" | "danger" | "info" }) {
  const colors = {
    neutral: "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
    info: "bg-[var(--info-light)] text-[var(--info)]",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", densityClass(density), className)} role={role}>
      {icon ? <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)]", colors[tone])}>{icon}</div> : null}
      <p className={cn("font-semibold text-[var(--text)]", density === "page" ? "text-lg" : "text-sm")}>{title}</p>
      {description ? <p className="mt-1 max-w-lg text-[13px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

function densityClass(density: StateProps["density"] = "panel") {
  return {
    compact: "min-h-28 px-3 py-6",
    panel: "min-h-48 px-4 py-12",
    page: "min-h-[min(32rem,70vh)] px-5 py-16",
  }[density];
}
