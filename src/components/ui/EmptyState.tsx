interface StateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: StateProps) {
  return <StateLayout icon={icon} title={title} description={description} action={action} />;
}

export function ErrorState({ icon, title, description, action }: StateProps) {
  return <StateLayout icon={icon} title={title} description={description} action={action} role="alert" tone="danger" />;
}

export function PermissionState({ icon, title, description, action }: StateProps) {
  return <StateLayout icon={icon} title={title} description={description} action={action} tone="warning" />;
}

export function LoadingState({ title = "Đang tải dữ liệu", description }: { title?: string; description?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-4 py-12 text-center" aria-live="polite" aria-busy="true">
      <span className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent-light)] border-t-[var(--accent)] motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}

function StateLayout({ icon, title, description, action, role, tone = "neutral" }: StateProps & { role?: "alert"; tone?: "neutral" | "warning" | "danger" }) {
  const colors = {
    neutral: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  };

  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-4 py-12 text-center" role={role}>
      {icon && <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-[11px] ${colors[tone]}`}>{icon}</div>}
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
