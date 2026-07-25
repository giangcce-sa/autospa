import { AutoCommentManager } from "@/components/modules/auto-comment/AutoCommentManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/page-access";

export default async function AutoCommentPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Auto Comment" description="Tự động phân tích cảm xúc và trả lời bình luận Facebook bằng AI" />
      <AutoCommentManager canMutate={user.role === "owner"} />
    </>
  );
}
