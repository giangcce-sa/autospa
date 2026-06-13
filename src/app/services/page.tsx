import { ServicesManager } from "@/components/modules/services/ServicesManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Quản lý Dịch vụ"
        description="Thêm và quản lý các dịch vụ của spa"
      />
      <ServicesManager />
    </>
  );
}
