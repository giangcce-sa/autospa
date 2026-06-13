import { ReportsDashboard } from "@/components/modules/reports/ReportsDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Báo cáo Thông minh" description="Tổng hợp hiệu quả marketing, CRM, leads và nhận nhận xét AI" />
      <ReportsDashboard />
    </>
  );
}
