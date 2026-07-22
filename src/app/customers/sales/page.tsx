import { WorkspacePage, type WorkspacePageProps } from "@/components/workspace/WorkspacePage";

export default function Page({ searchParams }: WorkspacePageProps) {
  return <WorkspacePage routeId="customers-sales" searchParams={searchParams} />;
}
