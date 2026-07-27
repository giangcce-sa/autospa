"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  FloppyDisk,
  Image as ImageIcon,
  NotePencil,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { ContentGenerator } from "@/components/modules/content/ContentGenerator";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, TONE_LABELS, label } from "@/lib/creative-labels";
import { BriefFields, briefToDraft, draftToPayload, type BriefDraft } from "./BriefFields";
import type { CreativePostData } from "./CreativeWorkspace";

export function CreativeContentEditor({
  facebookPageId,
  post,
  canMutate,
  connectedChannels,
}: {
  facebookPageId: string;
  post?: CreativePostData;
  canMutate: boolean;
  connectedChannels?: string[];
}) {
  const router = useRouter();

  if (!canMutate) {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 text-[13px] text-[var(--text-secondary)]">
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
        connectedChannels={connectedChannels}
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

type Tab = "caption" | "brief";

function PersistedPostEditor({
  facebookPageId,
  post,
  connectedChannels,
  onGoToImage,
  onGoToPublish,
}: {
  facebookPageId: string;
  post: CreativePostData;
  connectedChannels?: string[];
  onGoToImage: () => void;
  onGoToPublish: () => void;
}) {
  const [tab, setTab] = useState<Tab>("caption");
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags ?? "");
  const [brief, setBrief] = useState<BriefDraft>(() => briefToDraft(post.brief));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCaption(post.caption);
    setHashtags(post.hashtags ?? "");
    setBrief(briefToDraft(post.brief));
    setSaved(false);
    setError("");
  }, [post]);

  // One save covers both tabs, so switching tabs can never lose an edit.
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
          ...draftToPayload(brief),
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

  const status = label(POST_STATUS_LABELS, post.status);
  const briefCount = brief.outline.length + brief.hooks.length;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-extrabold leading-snug tracking-tight">
              {brief.title.trim() || caption.split("\n")[0].slice(0, 80) || "Bài chưa có tiêu đề"}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <span className="rounded-[5px] bg-[var(--bg-subtle)] px-2 py-0.5 font-bold text-[var(--text-secondary)]">
                {label(POST_TYPE_LABELS, post.postType)}
              </span>
              {post.tone && (
                <span className="rounded-[5px] bg-[var(--bg-subtle)] px-2 py-0.5 font-bold text-[var(--text-secondary)]">
                  {label(TONE_LABELS, post.tone)}
                </span>
              )}
              <span>Trạng thái {status}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 border-b border-[var(--border)]">
          <TabButton active={tab === "caption"} icon={NotePencil} onClick={() => setTab("caption")}>
            Caption
          </TabButton>
          <TabButton active={tab === "brief"} icon={FileText} onClick={() => setTab("brief")} count={briefCount || undefined}>
            Brief nội dung
          </TabButton>
        </div>

        <div className="mt-4">
          {tab === "caption" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-bold text-[var(--text-secondary)]">Caption</span>
                  <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                    {caption.trim() ? caption.trim().split(/\s+/).length : 0} từ
                  </span>
                </div>
                <textarea
                  value={caption}
                  aria-label="Caption"
                  rows={16}
                  onChange={(event) => setCaption(event.target.value)}
                  className="w-full resize-y rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[12px] font-bold text-[var(--text-secondary)]">Hashtags</span>
                <textarea
                  value={hashtags}
                  aria-label="Hashtags"
                  rows={2}
                  onChange={(event) => setHashtags(event.target.value)}
                  placeholder="#spa #chamsocda"
                  className="w-full resize-y rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--accent)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
              </div>
            </div>
          ) : (
            <BriefFields draft={brief} onChange={setBrief} connectedChannels={connectedChannels} />
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-4 flex items-center gap-1.5 rounded-[9px] bg-[var(--green-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--green)]">
            <CheckCircle size={14} weight="fill" aria-hidden="true" />
            Đã lưu caption và brief.
          </p>
        )}

        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || !caption.trim()}
          aria-busy={saving}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FloppyDisk size={16} weight="bold" aria-hidden="true" />
          {saving ? "Đang lưu…" : "Lưu nội dung"}
        </button>
      </section>

      <aside className="space-y-4">
        <section className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
          <h3 className="text-[14px] font-bold">Bước tiếp theo</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Cả caption và brief được lưu vào đúng bài hiện tại trước khi chuyển sang bước khác.
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => saveAndContinue(onGoToImage)}
              disabled={saving || !caption.trim()}
              className="flex min-h-11 w-full items-center gap-2 rounded-[9px] border border-[var(--border-strong)] px-3 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ImageIcon size={16} aria-hidden="true" />Tạo hình ảnh
            </button>
            <button
              type="button"
              onClick={() => saveAndContinue(onGoToPublish)}
              disabled={saving || !caption.trim()}
              className="flex min-h-11 w-full items-center gap-2 rounded-[9px] bg-[var(--accent)] px-3 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />Sang đăng bài
            </button>
          </div>
        </section>

        <section className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
          <h3 className="text-[14px] font-bold">Brief đã có</h3>
          <dl className="mt-2.5 space-y-1.5 text-[12.5px]">
            <BriefStat term="Tiêu đề" filled={!!brief.title.trim()} />
            <BriefStat term="Tóm tắt" filled={!!brief.summary.trim()} />
            <BriefStat term="Dàn ý" filled={brief.outline.length > 0} value={`${brief.outline.length} ý`} />
            <BriefStat term="Hook" filled={brief.hooks.length > 0} value={`${brief.hooks.length} hook`} />
            <BriefStat term="Thẻ chủ đề" filled={brief.topicTags.length > 0} value={`${brief.topicTags.length} thẻ`} />
            <BriefStat term="Kênh dự định" filled={brief.targetChannels.length > 0} value={`${brief.targetChannels.length} kênh`} />
          </dl>
          {tab === "caption" && (
            <button
              type="button"
              onClick={() => setTab("brief")}
              className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70"
            >
              <ArrowRight size={13} weight="bold" aria-hidden="true" />Sửa brief
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  count,
  onClick,
  children,
}: {
  active: boolean;
  icon: typeof NotePencil;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1 text-[13px] font-bold transition-colors ${
        active
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      }`}
    >
      <Icon size={15} aria-hidden="true" />
      {children}
      {count !== undefined && (
        <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[var(--text-secondary)]">
          {count}
        </span>
      )}
    </button>
  );
}

function BriefStat({ term, filled, value }: { term: string; filled: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--text-secondary)]">{term}</dt>
      <dd className={`shrink-0 font-bold tabular-nums ${filled ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
        {filled ? (value ?? "Đã có") : "Chưa có"}
      </dd>
    </div>
  );
}
