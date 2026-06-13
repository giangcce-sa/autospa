import { AutoCommentManager } from "@/components/modules/auto-comment/AutoCommentManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AutoCommentPage() {
  return (
    <>
      <PageHeader title="Auto Comment" description="Tự động phân tích cảm xúc và trả lời bình luận Facebook bằng AI" />
      <AutoCommentManager />
    </>
  );
}
