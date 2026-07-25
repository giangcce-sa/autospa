"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ContentGenerator } from "./ContentGenerator";
import { ImageGenerator } from "@/components/modules/images/ImageGenerator";
import { PublishManager } from "@/components/modules/publish/PublishManager";
import { Sparkle, Image as ImageIcon, PaperPlaneTilt } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

type Tab = "content" | "image" | "publish";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Tạo nội dung", icon: <Sparkle size={14} weight="fill" /> },
  { id: "image", label: "Tạo hình ảnh", icon: <ImageIcon size={14} /> },
  { id: "publish", label: "Đăng bài", icon: <PaperPlaneTilt size={14} weight="fill" /> },
];

export function ContentWorkspace({
  initialView = "content",
  initialPostId,
}: {
  initialView?: Tab;
  initialPostId?: string;
}) {
  const { selectedPageId } = useActivePage();
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialView);

  // Shared state across tabs
  const [postId, setPostId] = useState<string | undefined>(initialPostId);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const previousPageId = useRef(selectedPageId);

  useEffect(() => {
    if (!selectedPageId) return;

    if (!previousPageId.current) {
      previousPageId.current = selectedPageId;
      return;
    }

    if (previousPageId.current === selectedPageId) return;

    previousPageId.current = selectedPageId;
    setPostId(undefined);
    setImageUrl(undefined);
    router.replace(`${pathname}?view=content`, { scroll: false });
    setTab("content");
  }, [pathname, router, selectedPageId]);

  const navigate = (view: Tab, id = postId) => {
    const params = new URLSearchParams();
    params.set("view", view);
    if (id) params.set("postId", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setTab(view);
  };

  const handleImageSet = (url: string) => {
    setImageUrl(url);
  };

  const handlePostIdChange = (id?: string) => {
    setPostId(id);
    const params = new URLSearchParams();
    params.set("view", "publish");
    if (id) params.set("postId", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleGoToPublish = (id = postId) => {
    if (id) setPostId(id);
    navigate("publish", id);
  };

  const handleGoToImage = (id: string) => {
    setPostId(id);
    navigate("image", id);
  };

  return (
    <div className="space-y-4">
      {/* Top bar: tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => navigate(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? "var(--bg-card)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>
              {t.icon} {t.label}
              {t.id === "publish" && postId && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
              )}
            </button>
          ))}
        </div>

        {postId && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            Bài nháp đã lưu
          </span>
        )}
      </div>

      {/* Tab content — always mounted, hidden with CSS to preserve state */}
      <div style={{ display: tab === "content" ? undefined : "none" }}>
        <ContentGenerator
          facebookPageId={selectedPageId || undefined}
          onGoToImage={handleGoToImage}
          onGoToPublish={handleGoToPublish}
        />
      </div>
      <div style={{ display: tab === "image" ? undefined : "none" }}>
        <ImageGenerator
          postId={postId}
          facebookPageId={selectedPageId || undefined}
          onImageSet={handleImageSet}
          onGoToPublish={() => handleGoToPublish()}
        />
      </div>
      <div style={{ display: tab === "publish" ? undefined : "none" }}>
        <PublishManager
          initialPostId={postId}
          initialImageUrl={imageUrl}
          onPostIdChange={handlePostIdChange}
        />
      </div>
    </div>
  );
}
