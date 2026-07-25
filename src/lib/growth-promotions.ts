import "server-only";

import { prisma } from "@/lib/db";
import { detectSlotGaps } from "@/lib/flash-deal-engine";

export interface PromotionPostData {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  service: { name: string } | null;
}

export interface PromotionServiceData {
  id: string;
  name: string;
}

export async function getPromotionPosts(facebookPageId: string): Promise<PromotionPostData[]> {
  const posts = await prisma.post.findMany({
    where: { postType: "promotion", facebookPageId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      caption: true,
      hashtags: true,
      imageUrl: true,
      platform: true,
      status: true,
      scheduledAt: true,
      publishedAt: true,
      createdAt: true,
      service: { select: { name: true } },
    },
  });
  return posts.map((post) => ({
    ...post,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
  }));
}

export async function getPromotionServices(facebookPageId: string): Promise<PromotionServiceData[]> {
  return prisma.service.findMany({
    where: { facebookPageId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getPromotionCapacity() {
  const gaps = await detectSlotGaps();
  return {
    gaps,
    availability: "partial" as const,
    source: "AppointmentRequest.preferredAt + công suất mặc định 8 slot/ngày",
    window: "48 giờ tới",
    asOf: new Date().toISOString(),
    warning: "Công suất là ước tính cấp tài khoản; schema chưa lưu lịch vận hành, địa điểm hoặc Facebook Page nguồn.",
  };
}
