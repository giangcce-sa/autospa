import "server-only";

import sharp from "sharp";
import { imageSourceToBuffer } from "@/lib/media-storage";

export interface StaffReferenceRecord {
  id: string;
  referenceImageUrl: string | null;
  referenceStorageKey: string | null;
  samples: Array<{
    id: string;
    imageUrl: string;
    storageKey: string | null;
    isPrimary: boolean;
  }>;
}

export async function buildStaffReferences(staff: StaffReferenceRecord, limit = 3) {
  const ordered = [...staff.samples].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const sources = ordered.length
    ? ordered.slice(0, limit).map((sample) => ({
        sampleId: sample.id,
        url: sample.imageUrl,
        storageKey: sample.storageKey,
        weight: sample.isPrimary ? 1 : 0.72,
      }))
    : staff.referenceImageUrl
      ? [{ sampleId: "profile", url: staff.referenceImageUrl, storageKey: staff.referenceStorageKey, weight: 1 }]
      : [];

  const references = await Promise.all(sources.map(async (source) => {
    const input = await imageSourceToBuffer(source.url, source.storageKey);
    const normalized = await sharp(input)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    return {
      sampleId: source.sampleId,
      imageBase64: normalized.toString("base64"),
      weight: source.weight,
    };
  }));

  return references;
}
