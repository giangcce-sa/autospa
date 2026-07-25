import "server-only";

import { prisma } from "@/lib/db";

export type IntelligenceScope = "current" | "all";

export interface IntelligenceProvenance {
  availability: "available" | "unavailable" | "partial";
  scope: IntelligenceScope | "account";
  source: string;
  window: string;
  asOf: string;
  completeness: number | null;
  warning?: string;
}

export interface IntelligencePostData {
  id: string;
  caption: string;
  platform: string;
  status: string;
  publishedAt: string | null;
  facebookPageId: string;
  pageName: string;
  analytics: {
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    fetchedAt: string;
  } | null;
}

export interface IntelligencePerformanceData {
  provenance: IntelligenceProvenance;
  totals: {
    posts: number;
    published: number;
    measured: number;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    engagementRate: number | null;
  };
  topPosts: IntelligencePostData[];
  recentPosts: IntelligencePostData[];
}

export interface CompetitorData {
  id: string;
  fbPageId: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  hasDedicatedToken: boolean;
  lastFetchAt: string | null;
  createdAt: string;
  postCount: number;
}

export interface CompetitorPostData {
  id: string;
  fbPostId: string;
  message: string;
  likes: number;
  comments: number;
  shares: number;
  engagementScore: number;
  viralLevel: string;
  learningStatus: string;
  detectedTopic: string | null;
  contentFormat: string | null;
  publishedAt: string;
  fetchedAt: string;
  competitorName: string;
}

export interface CompetitorIntelligenceData {
  provenance: IntelligenceProvenance;
  competitors: CompetitorData[];
  topPosts: CompetitorPostData[];
  memory: {
    topTopics: string;
    topServices: string;
    topFormats: string;
    topHooks: string;
    competitorMomentum: string;
    sampleCount: number;
    confidence: number;
    counterPositioning: string | null;
    recommendations: string;
    updatedAt: string;
  } | null;
}

export interface ListeningIntelligenceData {
  provenance: IntelligenceProvenance;
  stats: {
    total: number;
    unread: number;
    critical: number;
    high: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    content: string;
    source: string;
    severity: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

const postSelect = {
  id: true,
  caption: true,
  platform: true,
  status: true,
  publishedAt: true,
  facebookPageId: true,
  facebookPage: { select: { pageName: true } },
  analytics: {
    select: {
      reach: true,
      likes: true,
      comments: true,
      shares: true,
      clicks: true,
      fetchedAt: true,
    },
  },
} as const;

type SelectedPost = Awaited<ReturnType<typeof readRecentPosts>>[number];

async function readRecentPosts(pageIds: string[]) {
  return prisma.post.findMany({
    where: {
      facebookPageId: { in: pageIds },
      OR: [{ status: "published" }, { analytics: { isNot: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: postSelect,
  });
}

function serializePost(post: SelectedPost): IntelligencePostData | null {
  if (!post.facebookPageId) return null;
  return {
    id: post.id,
    caption: post.caption,
    platform: post.platform,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    facebookPageId: post.facebookPageId,
    pageName: post.facebookPage?.pageName ?? "Facebook Page",
    analytics: post.analytics ? {
      reach: post.analytics.reach,
      likes: post.analytics.likes,
      comments: post.analytics.comments,
      shares: post.analytics.shares,
      clicks: post.analytics.clicks,
      fetchedAt: post.analytics.fetchedAt.toISOString(),
    } : null,
  };
}

export async function getIntelligencePerformance(
  pageIds: string[],
  scope: IntelligenceScope,
): Promise<IntelligencePerformanceData> {
  const asOf = new Date().toISOString();
  const postFilter = { facebookPageId: { in: pageIds } };
  const [posts, published, measured, aggregate, latestAnalytics, recentPosts, topPosts] = await Promise.all([
    prisma.post.count({ where: postFilter }),
    prisma.post.count({ where: { ...postFilter, status: "published" } }),
    prisma.post.count({ where: { ...postFilter, analytics: { isNot: null } } }),
    prisma.postAnalytics.aggregate({
      where: { post: postFilter },
      _sum: { reach: true, likes: true, comments: true, shares: true },
    }),
    prisma.postAnalytics.findFirst({
      where: { post: postFilter },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
    readRecentPosts(pageIds),
    prisma.post.findMany({
      where: { ...postFilter, analytics: { isNot: null } },
      orderBy: { analytics: { likes: "desc" } },
      take: 5,
      select: postSelect,
    }),
  ]);

  const totalReach = measured ? aggregate._sum.reach ?? 0 : null;
  const totalLikes = measured ? aggregate._sum.likes ?? 0 : null;
  const totalComments = measured ? aggregate._sum.comments ?? 0 : null;
  const totalShares = measured ? aggregate._sum.shares ?? 0 : null;
  const engagementRate = totalReach && totalLikes != null && totalComments != null && totalShares != null
    ? Math.round(((totalLikes + totalComments + totalShares) / totalReach) * 10_000) / 100
    : totalReach === 0 && measured ? 0 : null;
  const completeness = published ? Math.min(measured / published, 1) : null;
  const availability = measured === 0 ? "unavailable" : completeness != null && completeness < 1 ? "partial" : "available";

  return {
    provenance: {
      availability,
      scope,
      source: "Post.facebookPageId + PostAnalytics",
      window: "Toàn bộ dữ liệu persisted",
      asOf: latestAnalytics?.fetchedAt.toISOString() ?? asOf,
      completeness,
      warning: measured === 0
        ? "Chưa có PostAnalytics cho phạm vi đã chọn; các metric hiệu quả không được suy diễn thành 0."
        : completeness != null && completeness < 1
          ? `${measured}/${published} bài đã đăng có analytics; tổng và tỷ lệ có thể chưa đầy đủ.`
          : undefined,
    },
    totals: {
      posts,
      published,
      measured,
      reach: totalReach,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagementRate,
    },
    topPosts: topPosts.map(serializePost).filter((post): post is IntelligencePostData => Boolean(post)),
    recentPosts: recentPosts.map(serializePost).filter((post): post is IntelligencePostData => Boolean(post)),
  };
}

export async function getCompetitorIntelligence(): Promise<CompetitorIntelligenceData> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [competitors, topPosts, memory] = await Promise.all([
    prisma.competitor.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fbPageId: true,
        name: true,
        notes: true,
        isActive: true,
        accessToken: true,
        lastFetchAt: true,
        createdAt: true,
        _count: { select: { posts: true } },
      },
    }),
    prisma.competitorPost.findMany({
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
        publishedAt: true,
        fetchedAt: true,
        competitor: { select: { name: true } },
      },
    }),
    prisma.competitorMemory.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        topTopics: true,
        topServices: true,
        topFormats: true,
        topHooks: true,
        competitorMomentum: true,
        sampleCount: true,
        confidence: true,
        counterPositioning: true,
        recommendations: true,
        updatedAt: true,
      },
    }),
  ]);

  const latest = [
    ...competitors.map((competitor) => competitor.lastFetchAt?.getTime() ?? 0),
    ...topPosts.map((post) => post.fetchedAt.getTime()),
    memory?.updatedAt.getTime() ?? 0,
  ].reduce((max, value) => Math.max(max, value), 0);

  return {
    provenance: {
      availability: competitors.length || topPosts.length ? "available" : "unavailable",
      scope: "account",
      source: "Competitor + CompetitorPost + CompetitorMemory",
      window: "Bài nổi bật 7 ngày; cấu hình và memory toàn thời gian",
      asOf: latest ? new Date(latest).toISOString() : new Date().toISOString(),
      completeness: null,
      warning: competitors.length ? undefined : "Chưa cấu hình đối thủ; không có tín hiệu cạnh tranh để đánh giá.",
    },
    competitors: competitors.map((competitor) => ({
      id: competitor.id,
      fbPageId: competitor.fbPageId,
      name: competitor.name,
      notes: competitor.notes,
      isActive: competitor.isActive,
      hasDedicatedToken: Boolean(competitor.accessToken),
      lastFetchAt: competitor.lastFetchAt?.toISOString() ?? null,
      createdAt: competitor.createdAt.toISOString(),
      postCount: competitor._count.posts,
    })),
    topPosts: topPosts.map((post) => ({
      id: post.id,
      fbPostId: post.fbPostId,
      message: post.message,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      engagementScore: post.engagementScore,
      viralLevel: post.viralLevel,
      learningStatus: post.learningStatus,
      detectedTopic: post.detectedTopic,
      contentFormat: post.contentFormat,
      publishedAt: post.publishedAt.toISOString(),
      fetchedAt: post.fetchedAt.toISOString(),
      competitorName: post.competitor.name,
    })),
    memory: memory ? {
      topTopics: memory.topTopics,
      topServices: memory.topServices,
      topFormats: memory.topFormats,
      topHooks: memory.topHooks,
      competitorMomentum: memory.competitorMomentum,
      sampleCount: memory.sampleCount,
      confidence: memory.confidence,
      counterPositioning: memory.counterPositioning,
      recommendations: memory.recommendations,
      updatedAt: memory.updatedAt.toISOString(),
    } : null,
  };
}

export async function getListeningIntelligence(): Promise<ListeningIntelligenceData> {
  const [alerts, total, unread, critical, high, latest] = await Promise.all([
    prisma.socialAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        content: true,
        source: true,
        severity: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.socialAlert.count(),
    prisma.socialAlert.count({ where: { isRead: false } }),
    prisma.socialAlert.count({ where: { severity: "critical" } }),
    prisma.socialAlert.count({ where: { severity: "high" } }),
    prisma.socialAlert.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  return {
    provenance: {
      availability: total ? "available" : "unavailable",
      scope: "account",
      source: "SocialAlert",
      window: "100 cảnh báo gần nhất; aggregate toàn thời gian",
      asOf: latest?.createdAt.toISOString() ?? new Date().toISOString(),
      completeness: null,
      warning: total ? undefined : "Chưa có cảnh báo persisted; không thể kết luận thị trường không có rủi ro.",
    },
    stats: { total, unread, critical, high },
    alerts: alerts.map((alert) => ({
      ...alert,
      createdAt: alert.createdAt.toISOString(),
    })),
  };
}
