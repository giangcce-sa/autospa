"use client";

import { useEffect, useState } from "react";
import { FilmSlate, Image as ImageIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { mediaAspectClass } from "@/lib/media-gallery";

export function MediaThumbnail({
  src,
  alt,
  kind = "image",
  aspectRatio,
  className,
}: {
  src?: string | null;
  alt: string;
  kind?: "image" | "video";
  aspectRatio?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = kind === "video" ? FilmSlate : ImageIcon;
  const showImage = Boolean(src) && !failed && !src?.startsWith("mock://");

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={cn("relative overflow-hidden bg-[var(--bg-subtle)]", mediaAspectClass(aspectRatio), className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? ""}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 text-center text-[var(--text-muted)]">
          <Icon size={30} weight="duotone" aria-hidden="true" />
          <span className="text-xs">{kind === "video" ? "Chưa có poster" : "Không tải được thumbnail"}</span>
        </div>
      )}
    </div>
  );
}
