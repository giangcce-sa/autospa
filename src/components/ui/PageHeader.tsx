interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  scope?: React.ReactNode;
  status?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, eyebrow, scope, status, action }: PageHeaderProps) {
  return (
    <header className="mb-7 border-b border-[var(--border)] pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-2 text-[13px] font-semibold text-[var(--accent)]">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] font-extrabold tracking-[-0.01em] sm:text-[30px]">{title}</h1>
            {status}
          </div>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
          {scope && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">{scope}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
