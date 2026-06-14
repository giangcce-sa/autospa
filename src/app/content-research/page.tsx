import { ContentResearch } from "@/components/modules/content-research/ContentResearch";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContentResearchPage() {
  return (
    <>
      <PageHeader
        title="Nghiên cứu & Lên kế hoạch nội dung"
        description="AI phân tích xu hướng, tự động tạo kế hoạch nội dung và lên lịch đăng bài"
      />
      <ContentResearch />
    </>
  );
}
