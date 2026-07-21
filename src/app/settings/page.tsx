import { SettingsForm } from "@/components/modules/settings/SettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Quản lý khóa truy cập và kết nối Trang Facebook"
      />
      <SettingsForm />
    </>
  );
}
