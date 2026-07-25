"use client";

import { useRouter } from "next/navigation";
import { VideoStudio } from "@/components/modules/video-studio/VideoStudio";

export function CreativeVideoStudio({
  view,
  facebookPageId,
  projectId,
  sceneId,
  canMutate,
}: {
  view: "overview" | "projects" | "review" | "jobs";
  facebookPageId: string;
  projectId?: string;
  sceneId?: string;
  canMutate: boolean;
}) {
  const router = useRouter();

  const updateUrl = (nextProjectId?: string, nextSceneId?: string) => {
    const nextView = view === "overview" && nextProjectId ? "projects" : view;
    const params = new URLSearchParams({ view: nextView, scope: "current", pageId: facebookPageId });
    if (nextProjectId) params.set("id", nextProjectId);
    if (nextProjectId && nextSceneId && nextView === "projects") params.set("step", nextSceneId);
    router.replace(`/creative/video?${params.toString()}`, { scroll: false });
  };

  return (
    <VideoStudio
      facebookPageId={facebookPageId}
      canonicalView={view}
      canMutate={canMutate}
      initialProjectId={projectId}
      initialSceneId={sceneId}
      onProjectIdChange={(nextProjectId) => updateUrl(nextProjectId)}
      onSceneIdChange={(nextSceneId) => updateUrl(projectId, nextSceneId)}
    />
  );
}
