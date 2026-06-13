import { CareManager } from "@/components/modules/care/CareManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CarePage() {
  return (
    <>
      <PageHeader title="Chăm sóc Khách hàng" description="Tự động tạo tin nhắn chăm sóc: sinh nhật, nhắc lịch, hỏi thăm sau dịch vụ" />
      <CareManager />
    </>
  );
}
