"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Image as ImageIcon, PaperPlaneTilt } from "@phosphor-icons/react";
import { ContentGenerator } from "@/components/modules/content/ContentGenerator";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import type { CreativePostData } from "./CreativeWorkspace";

export function CreativeContentEditor({
  facebookPageId,
  post,
  canMutate,
}: {
  facebookPageId: string;
  post?: CreativePostData;
  canMutate: boolean;
}) {
  const router = useRouter();

  if (!canMutate) {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-secondary)]">
        Tài khoản của bạn có quyền xem workspace này nhưng không có quyền tạo nội dung.
      </section>
    );
  }

  const navigate = (path: string, view: string, postId: string) => {
    const params = new URLSearchParams({ view, scope: "current", pageId: facebookPageId, id: postId });
    router.push(`${path}?${params.toString()}`);
  };

  if (post) {
    return (
      <PersistedPostEditor
        facebookPageId={facebookPageId}
        post={post}
        onGoToImage={() => navigate("/creative/images", "create", post.id)}
        onGoToPublish={() => navigate("/creative/publishing", "composer", post.id)}
      />
    );
  }

  return (
    <ContentGenerator
      facebookPageId={facebookPageId}
      onGoToImage={(postId) => navigate("/creative/images", "create", postId)}
      onGoToPublish={(postId) => navigate("/creative/publishing", "composer", postId)}
    />
  );
}

function PersistedPostEditor({
  facebookPageId,
  post,
  onGoToImage,
  onGoToPublish,
}: {
  facebookPageId: string;
  post: CreativePostData;
  onGoToImage: () => void;
  onGoToPublish: () => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCaption(post.caption);
    setHashtags(post.hashtags ?? "");
    setSaved(false);
    setError("");
  }, [post]);

  const saveDraft = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          postId: post.id,
          caption,
          hashtags,
          postType: post.postType,
          facebookPageId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không lưu được bài viết");
        return false;
      }
      setSaved(true);
      return true;
    } catch {
      setError("Không lưu được bài viết");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndContinue = async (next: () => void) => {
    if (await saveDraft()) next();
  };

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader><CardTitle>Biên tập bài đã lưu</CardTitle></CardHeader>
        <div className="space-y-3">
          <Textarea label="Caption" rows={12} value={caption} onChange={(event) => setCaption(event.target.value)} />
          <Textarea label="Hashtags" rows={3} value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
          {error && <p className="rounded bg-[var(--rose-light)] p-2 text-xs text-[var(--rose)]">{error}</p>}
          {saved && <p className="rounded bg-[var(--accent-light)] p-2 text-xs text-[var(--accent)]">Đã lưu nội dung.</p>}
          <Button onClick={saveDraft} loading={saving} disabled={!caption.trim()} className="w-full">
            <FloppyDisk size={14} /> Lưu nội dung
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bước tiếp theo</CardTitle></CardHeader>
        <div className="space-y-3 text-xs text-[var(--text-secondary)]">
          <p>Trạng thái hiện tại: <strong className="text-[var(--text)]">{post.status}</strong></p>
          <p>Nội dung được lưu vào đúng bài hiện tại trước khi chuyển workspace.</p>
          <Button onClick={() => saveAndContinue(onGoToImage)} loading={saving} disabled={!caption.trim()} variant="secondary" className="w-full">
            <ImageIcon size={14} /> Tạo hình ảnh
          </Button>
          <Button onClick={() => saveAndContinue(onGoToPublish)} loading={saving} disabled={!caption.trim()} className="w-full">
            <PaperPlaneTilt size={14} weight="fill" /> Sang đăng bài
          </Button>
        </div>
      </Card>
    </div>
  );
}
