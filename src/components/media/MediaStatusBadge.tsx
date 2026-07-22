import { StatusBadge } from "@/components/ui/Badge";

export function MediaStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
