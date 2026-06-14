import { AutomationDashboard } from "@/components/modules/automation/AutomationDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AutomationPage() {
  return (
    <>
      <PageHeader
        title="Tự động hóa"
        description="Giám sát vòng lặp marketing 24/7 — approvals, tối ưu quảng cáo, lead agent, đồng bộ spa"
      />
      <AutomationDashboard />
    </>
  );
}
