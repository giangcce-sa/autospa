import "server-only";

import { prisma } from "@/lib/db";
import { AccessError } from "@/lib/page-access";

export interface ImageHistoryItem {
  id: string;
  postId: string | null;
  parentGenerationId: string | null;
  batchId: string | null;
  variantIndex: number;
  imageUrl: string;
  thumbnailUrl: string;
  model: string | null;
  format: string;
  preset: string;
  prompt: string;
  visualBrief: string | null;
  qualityScore: number;
  promptScore: number;
  visionScore: number | null;
  generationStatus: string;
  userAccepted: boolean | null;
  createdAt: string;
}

export interface ImageHistoryPage {
  items: ImageHistoryItem[];
  nextCursor: string | null;
}

export async function getImageHistoryPage(
  facebookPageId: string | null,
  options: { take?: number; cursor?: string | null; staffProfileId?: string | null } = {},
): Promise<ImageHistoryPage> {
  const take = Math.min(Math.max(options.take ?? 24, 1), 60);
  if (options.cursor) {
    const cursor = await prisma.imageGeneration.findFirst({
      where: { id: options.cursor, facebookPageId },
      select: { id: true },
    });
    if (!cursor) throw new AccessError("Cursor hình ảnh không hợp lệ", 400);
  }
  const generations = await prisma.imageGeneration.findMany({
    where: {
      facebookPageId,
      ...(options.staffProfileId ? { staffProfileId: options.staffProfileId } : {}),
    },
    select: {
      id: true,
      postId: true,
      parentGenerationId: true,
      batchId: true,
      variantIndex: true,
      imageUrl: true,
      model: true,
      format: true,
      preset: true,
      prompt: true,
      visualBrief: true,
      qualityScore: true,
      promptScore: true,
      visionScore: true,
      generationStatus: true,
      userAccepted: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    take: take + 1,
  });
  const hasMore = generations.length > take;
  const items = generations.slice(0, take).map((generation) => ({
    ...generation,
    createdAt: generation.createdAt.toISOString(),
    thumbnailUrl: `/api/images/${encodeURIComponent(generation.id)}/thumbnail`,
  }));

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
}
