import { CRMManager } from "@/components/modules/crm/CRMManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CRMPage() {
  return (
    <>
      <PageHeader title="Mini CRM" description="Quản lý hồ sơ khách hàng, phân khúc và lịch sử tương tác" />
      <CRMManager />
    </>
  );
}
