import "server-only";

import { readMedia, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { fetchSafeMedia, probeMediaBuffer } from "./media-security";
import type { RenderInspection } from "./quality";

export async function inspectRenderedVideo(outputUrl: string): Promise<RenderInspection | null> {
  if (outputUrl.startsWith("mock://")) return null;
  const storageKey = storageKeyFromMediaUrl(outputUrl);
  const buffer = storageKey
    ? await readMedia(storageKey)
    : await fetchSafeMedia(outputUrl, {
        maxBytes: 500 * 1024 * 1024,
        allowedTypes: ["video/mp4", "video/quicktime", "video/webm"],
      });
  const probe = await probeMediaBuffer(buffer, "mp4");
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  return {
    durationSec: probe.duration,
    width: video?.width || 0,
    height: video?.height || 0,
    hasAudio: probe.streams.some((stream) => stream.codec_type === "audio"),
  };
}
