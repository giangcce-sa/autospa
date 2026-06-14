"use client";

import { useSearchParams } from "next/navigation";
import { FacebookAdsManager } from "@/components/modules/facebook-ads/FacebookAdsManager";

export function FacebookAdsManagerWrapper() {
  const searchParams = useSearchParams();
  const postId = searchParams.get("postId") ?? undefined;
  return <FacebookAdsManager initialPostId={postId} />;
}
