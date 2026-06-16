import { OrchestratorView } from "@/components/modules/orchestrator/OrchestratorView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OrchestratorPage() {
  return (
    <>
      <PageHeader
        title="Orchestrator"
        description="AI meta đọc state toàn hệ thống → quyết định ưu tiên agent nào, tự thực thi (semi/full mode)"
      />
      <OrchestratorView />
    </>
  );
}
