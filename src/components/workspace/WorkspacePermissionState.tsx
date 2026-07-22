import Link from "next/link";
import { LockKey } from "@phosphor-icons/react/dist/ssr";
import type { AppRoute } from "@/config/routes";
import { PermissionState } from "@/components/ui/EmptyState";

export function WorkspacePermissionState({
  route,
  message,
}: {
  route: AppRoute;
  message: string;
}) {
  return (
    <div className="max-w-6xl rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <PermissionState
        icon={<LockKey size={24} aria-hidden="true" />}
        title={`Không thể mở ${route.label}`}
        description={message}
        action={(
          <Link
            href={`/${route.section}`}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text)]"
          >
            Quay lại khu vực
          </Link>
        )}
      />
    </div>
  );
}
