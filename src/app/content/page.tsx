import { ContentGenerator } from "@/components/modules/content/ContentGenerator";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Tạo Nội dung"
        description="AI sinh caption và hashtag tiếng Việt theo văn phong spa của bạn"
      />
      <ContentGenerator />
    </>
  );
}
