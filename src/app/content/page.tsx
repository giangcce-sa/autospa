import { ContentWorkspace } from "@/components/modules/content/ContentWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; postId?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = typeof params.view === "string" && ["content", "image", "publish"].includes(params.view)
    ? params.view as "content" | "image" | "publish"
    : "content";
  const postId = typeof params.postId === "string" ? params.postId : undefined;

  return (
    <>
      <PageHeader
        title="Nội dung"
        description="Tạo caption, hình ảnh AI và đăng lên Facebook — tất cả trong một nơi"
      />
      <ContentWorkspace initialView={view} initialPostId={postId} />
    </>
  );
}
