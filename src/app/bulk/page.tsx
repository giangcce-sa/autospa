import { BulkGenerator } from "@/components/modules/bulk/BulkGenerator";
import { PageHeader } from "@/components/ui/PageHeader";

export default function BulkPage() {
  return (
    <>
      <PageHeader
        title="Bulk Generation"
        description="Tạo toàn bộ kế hoạch nội dung cho cả tháng chỉ trong một lần"
      />
      <BulkGenerator />
    </>
  );
}
