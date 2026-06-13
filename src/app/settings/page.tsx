import { SettingsForm } from "@/components/modules/settings/SettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Cấu hình API keys và kết nối Facebook Page"
      />
      <SettingsForm />
    </>
  );
}
