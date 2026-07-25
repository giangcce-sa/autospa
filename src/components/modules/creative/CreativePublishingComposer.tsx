"use client";

import { useRouter } from "next/navigation";
import { PublishManager, type PublishingPostData } from "@/components/modules/publish/PublishManager";
import type { ReviewIssue } from "@/components/ui/ReviewBadge";

export function CreativePublishingComposer({
  facebookPageId,
  postId,
  initialPost,
  initialReview,
}: {
  facebookPageId: string;
  postId?: string;
  initialPost?: PublishingPostData;
  initialReview?: { status: "pass" | "warn" | "fail"; score: number; issues: ReviewIssue[] } | null;
}) {
  const router = useRouter();

  const updatePostId = (nextPostId?: string) => {
    const params = new URLSearchParams({ view: "composer", scope: "current", pageId: facebookPageId });
    if (nextPostId) params.set("id", nextPostId);
    router.replace(`/creative/publishing?${params.toString()}`, { scroll: false });
  };

  return (
    <PublishManager
      initialPostId={postId}
      initialPost={initialPost}
      initialReview={initialReview}
      facebookPageId={facebookPageId}
      onPostIdChange={updatePostId}
    />
  );
}
