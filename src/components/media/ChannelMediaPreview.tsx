"use client";

import { useState } from "react";
import { FacebookLogo, InstagramLogo, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MediaThumbnail } from "./MediaThumbnail";

type PreviewChannel = "facebook" | "instagram" | "tiktok";

const CHANNELS: Array<{ id: PreviewChannel; label: string; aspect: string; icon: React.ReactNode }> = [
  { id: "facebook", label: "Facebook", aspect: "aspect-[4/5]", icon: <FacebookLogo size={15} aria-hidden="true" /> },
  { id: "instagram", label: "Instagram", aspect: "aspect-square", icon: <InstagramLogo size={15} aria-hidden="true" /> },
  { id: "tiktok", label: "TikTok", aspect: "aspect-[9/16]", icon: <span className="text-xs font-bold">TT</span> },
];

export function ChannelMediaPreview({
  mediaUrl,
  kind,
  posterUrl,
  title = "Media bài đăng",
}: {
  mediaUrl?: string | null;
  kind: "image" | "video";
  posterUrl?: string | null;
  title?: string;
}) {
  const [channel, setChannel] = useState<PreviewChannel>("facebook");
  const selected = CHANNELS.find((item) => item.id === channel) ?? CHANNELS[0];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto" aria-label="Kênh xem trước">
        {CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={channel === item.id}
            onClick={() => setChannel(item.id)}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-semibold", channel === item.id ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]")}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </div>
      <div className={cn("mx-auto flex max-h-[32rem] w-full max-w-sm items-center justify-center overflow-hidden rounded-lg bg-black", selected.aspect)}>
        {kind === "video" && mediaUrl && !mediaUrl.startsWith("mock://") ? (
          <video src={mediaUrl} poster={posterUrl ?? undefined} controls preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <MediaThumbnail src={mediaUrl ?? posterUrl} alt={title} kind={kind} className="h-full w-full !aspect-auto" />
        )}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] leading-4 text-[var(--text-muted)]">
        <WarningCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Khung {selected.label} chỉ là mô phỏng tỉ lệ hiển thị, không thay thế kiểm tra định dạng của nền tảng.
      </p>
    </div>
  );
}
