import { StoryManager } from "@/components/modules/stories/StoryManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StoriesPage() {
  return (
    <>
      <PageHeader
        title="Câu chuyện thực tế"
        description="Phản hồi khách hàng, kết quả điều trị, sự kiện spa — AI kết hợp vào bài viết để nội dung chân thực hơn"
      />
      <StoryManager />
    </>
  );
}
