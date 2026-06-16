import { ReportsPageClient } from "@/components/modules/reports/ReportsPageClient";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Báo cáo Thông minh" description="Tổng hợp marketing, CRM, doanh thu — biết bài/quảng cáo nào sinh tiền" />
      <ReportsPageClient />
    </>
  );
}
