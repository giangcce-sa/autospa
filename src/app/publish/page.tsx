import { PublishManager } from "@/components/modules/publish/PublishManager";
import { PageHeader } from "@/components/ui/PageHeader";

interface Props {
  searchParams: Promise<{ postId?: string; imageUrl?: string }>;
}

export default async function PublishPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <>
      <PageHeader
        title="Đăng bài"
        description="Xem trước bài viết và đăng lên Facebook — ngay bây giờ hoặc lên lịch"
      />
      <PublishManager initialPostId={params.postId} initialImageUrl={params.imageUrl} />
    </>
  );
}
