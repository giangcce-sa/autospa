import { ContentWorkspace } from "@/components/modules/content/ContentWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Nội dung"
        description="Tạo caption, hình ảnh AI và đăng lên Facebook — tất cả trong một nơi"
      />
      <ContentWorkspace />
    </>
  );
}
