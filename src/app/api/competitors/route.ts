import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { syncOneCompetitor } from "@/lib/competitor-research";
import { prisma } from "@/lib/db";
import { getCompetitorIntelligence } from "@/lib/growth-intelligence";
import { learnFromCompetitors } from "@/lib/learning/competitor-learning";
import { AccessError, accessErrorResponse, requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { encryptSecret } from "@/lib/secrets-crypto";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const rawDays = Number(new URL(req.url).searchParams.get("days") ?? 7);
    const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= 90 ? rawDays : 7;
    const data = await getCompetitorData(days);
    return NextResponse.json({ data, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      const fbPageId = typeof body.fbPageId === "string" ? body.fbPageId.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!fbPageId || !name) throw new AccessError("Thiếu fbPageId hoặc name", 400);
      const competitor = await prisma.competitor.create({
        data: {
          fbPageId,
          name,
          notes: optionalText(body.notes),
          accessToken: encryptOptionalToken(body.accessToken),
        },
        select: competitorSafeSelect,
      });
      return NextResponse.json({ data: serializeCompetitor(competitor), success: true });
    }

    if (action === "update") {
      const id = requiredId(body.id);
      const data: { name?: string; notes?: string | null; accessToken?: string | null; isActive?: boolean } = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) throw new AccessError("Tên đối thủ không hợp lệ", 400);
        data.name = body.name.trim();
      }
      if (body.notes !== undefined) data.notes = optionalText(body.notes);
      if (body.accessToken !== undefined) data.accessToken = encryptOptionalToken(body.accessToken);
      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") throw new AccessError("isActive không hợp lệ", 400);
        data.isActive = body.isActive;
      }
      const competitor = await prisma.competitor.update({ where: { id }, data, select: competitorSafeSelect });
      return NextResponse.json({ data: serializeCompetitor(competitor), success: true });
    }

    if (action === "delete") {
      await prisma.competitor.delete({ where: { id: requiredId(body.id) } });
      return NextResponse.json({ success: true });
    }

    if (action === "fetch-now") {
      const result = await syncOneCompetitor(requiredId(body.id));
      return NextResponse.json({ data: result, success: true });
    }

    if (action === "learn") {
      const result = await learnFromCompetitors();
      return NextResponse.json({ data: result, success: true });
    }

    if (action === "set-post-learning-status") {
      const id = requiredId(body.id);
      if (!["approved", "rejected"].includes(body.learningStatus)) throw new AccessError("Trạng thái học không hợp lệ", 400);
      const post = await prisma.competitorPost.update({
        where: { id },
        data: { learningStatus: body.learningStatus },
        select: { id: true, learningStatus: true },
      });
      return NextResponse.json({ data: post, success: true });
    }

    throw new AccessError("Action không hợp lệ", 400);
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}

const competitorSafeSelect = {
  id: true,
  fbPageId: true,
  name: true,
  notes: true,
  isActive: true,
  accessToken: true,
  lastFetchAt: true,
  createdAt: true,
  _count: { select: { posts: true } },
} as const;

type SafeCompetitor = Prisma.CompetitorGetPayload<{ select: typeof competitorSafeSelect }>;

function serializeCompetitor(competitor: SafeCompetitor) {
  return {
    id: competitor.id,
    fbPageId: competitor.fbPageId,
    name: competitor.name,
    notes: competitor.notes,
    isActive: competitor.isActive,
    hasDedicatedToken: Boolean(competitor.accessToken),
    lastFetchAt: competitor.lastFetchAt?.toISOString() ?? null,
    createdAt: competitor.createdAt.toISOString(),
    _count: competitor._count,
  };
}

async function getCompetitorData(days: number) {
  const data = await getCompetitorIntelligence();
  const since = new Date(Date.now() - days * 86_400_000);
  const topPosts = await prisma.competitorPost.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: [{ engagementScore: "desc" }, { publishedAt: "desc" }],
    take: 10,
    select: {
      id: true,
      fbPostId: true,
      message: true,
      likes: true,
      comments: true,
      shares: true,
      engagementScore: true,
      viralLevel: true,
      learningStatus: true,
      detectedTopic: true,
      contentFormat: true,
      hookType: true,
      publishedAt: true,
      competitor: { select: { name: true } },
    },
  });
  return {
    competitors: data.competitors.map(({ postCount, ...competitor }) => ({ ...competitor, _count: { posts: postCount } })),
    topPosts: topPosts.map((post) => ({
      ...post,
      score: post.engagementScore,
      publishedAt: post.publishedAt.toISOString(),
    })),
    memory: data.memory,
    provenance: { ...data.provenance, window: `Bài nổi bật ${days} ngày; cấu hình và memory toàn thời gian` },
  };
}

function requiredId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new AccessError("Thiếu ID", 400);
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function encryptOptionalToken(value: unknown) {
  const text = optionalText(value);
  return text ? encryptSecret(text) : null;
}
