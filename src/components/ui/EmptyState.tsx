interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-3 opacity-30" style={{ color: "var(--text-secondary)" }}>{icon}</div>
      )}
      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{title}</p>
      {description && (
        <p className="mt-1 text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
