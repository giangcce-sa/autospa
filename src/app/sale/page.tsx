import { SaleManager } from "@/components/modules/sale/SaleManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SalePage() {
  return (
    <>
      <PageHeader title="Chốt Sale AI" description="Quản lý leads, chấm điểm tiềm năng bằng AI và nhận kịch bản tư vấn" />
      <SaleManager />
    </>
  );
}
