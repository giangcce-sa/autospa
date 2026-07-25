import { ReportsPageClient } from "@/components/modules/reports/ReportsPageClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/page-access";

export default async function ReportsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Báo cáo Thông minh" description="Tổng hợp marketing, CRM và doanh thu ở phạm vi toàn tài khoản" />
      <ReportsPageClient canMutate={user.role === "owner"} />
    </>
  );
}
