import { prisma } from "../db";
import { generateContent } from "../claude";
export { calculateCompetitorEngagement, competitorViralLevel } from "../competitor-learning-rules";
import { calculateCompetitorEngagement, competitorViralLevel } from "../competitor-learning-rules";

export interface CompetitorPostAnalysis {
  detectedTopic: string;
  contentFormat: string;
  detectedService: string;
  hookType: string;
  offerType: string;
  ctaType: string;
  aiSummary: string;
}

export interface CompetitorContext {
  insight: string;
  topTopics: string[];
  topServices: string[];
  topFormats: string[];
  topHooks: string[];
  recommendations: string[];
  counterPositioning: string | null;
}

type CountItem = { label: string; count: number; score: number };
type MomentumItem = { competitor: string; posts: number; viralPosts: number; score: number };

const TOPIC_RULES: Array<[RegExp, string]> = [
  [/(triệt lông|lông bikini|diode|ipl|laser)/i, "triệt lông"],
  [/(mụn|thâm|nám|tàn nhang|sắc tố)/i, "điều trị da"],
  [/(trẻ hoá|trẻ hóa|nâng cơ|hifu|rf|căng bóng)/i, "trẻ hóa da"],
  [/(gội đầu|dưỡng sinh|massage đầu|thư giãn)/i, "gội đầu dưỡng sinh"],
  [/(massage|body|đá nóng|thải độc)/i, "massage body"],
  [/(facial|chăm sóc da|da mặt|skincare)/i, "chăm sóc da mặt"],
  [/(combo|liệu trình|ưu đãi|khuyến mãi|sale)/i, "ưu đãi dịch vụ"],
];

const SERVICE_RULES: Array<[RegExp, string]> = [
  [/(triệt lông|bikini|diode|ipl|laser)/i, "Triệt lông"],
  [/(nám|mụn|thâm|sắc tố)/i, "Điều trị da"],
  [/(hifu|nâng cơ|trẻ hoá|trẻ hóa|rf)/i, "Trẻ hóa da"],
  [/(gội đầu|dưỡng sinh)/i, "Gội đầu dưỡng sinh"],
  [/(massage|body|đá nóng)/i, "Massage body"],
  [/(facial|chăm sóc da|da mặt)/i, "Chăm sóc da mặt"],
];

function inferTopic(text: string) {
  return TOPIC_RULES.find(([re]) => re.test(text))?.[1] ?? "chủ đề làm đẹp";
}

function inferService(text: string) {
  return SERVICE_RULES.find(([re]) => re.test(text))?.[1] ?? "Dịch vụ spa";
}

function inferFormat(text: string) {
  if (/(feedback|review|khách hàng|chị khách|cảm nhận|trước.*sau|before.*after)/i.test(text)) return "testimonial";
  if (/(ưu đãi|khuyến mãi|sale|giảm|tặng|combo|chỉ từ)/i.test(text)) return "offer";
  if (/(vì sao|lý do|cách|mẹo|sự thật|dấu hiệu|nên|không nên)/i.test(text)) return "educational";
  if (/(hôm nay|behind|team|nhân viên|quy trình|phòng|máy)/i.test(text)) return "behind_scenes";
  if (/(trend|viral|hot|đang được)/i.test(text)) return "trend";
  return "service_story";
}

function inferHook(text: string) {
  const opening = text.slice(0, 180);
  if (/(đau|sợ|ngại|lo|mệt|khó chịu|vấn đề)/i.test(opening)) return "problem";
  if (/(sau|kết quả|thay đổi|cải thiện|trước)/i.test(opening)) return "result";
  if (/(ưu đãi|giảm|tặng|combo|chỉ từ)/i.test(opening)) return "offer";
  if (/(chị khách|khách hàng|một bạn|câu chuyện)/i.test(opening)) return "customer_story";
  if (/(đừng|cảnh báo|sai lầm|lưu ý)/i.test(opening)) return "warning";
  return "direct_service";
}

function inferOffer(text: string) {
  if (/(miễn phí|free)/i.test(text)) return "free_consult";
  if (/(giảm|sale|%|k|chỉ từ|ưu đãi)/i.test(text)) return "discount";
  if (/(combo|liệu trình|gói)/i.test(text)) return "bundle";
  if (/(tặng|quà)/i.test(text)) return "gift";
  return "none";
}

function inferCta(text: string) {
  if (/(inbox|nhắn tin|ib)/i.test(text)) return "inbox";
  if (/(đặt lịch|book|booking)/i.test(text)) return "book_now";
  if (/(comment|bình luận)/i.test(text)) return "comment";
  if (/(gọi|hotline|sđt|sdt)/i.test(text)) return "call";
  return "soft";
}

function fallbackAnalysis(message: string): CompetitorPostAnalysis {
  return {
    detectedTopic: inferTopic(message),
    contentFormat: inferFormat(message),
    detectedService: inferService(message),
    hookType: inferHook(message),
    offerType: inferOffer(message),
    ctaType: inferCta(message),
    aiSummary: message.replace(/\s+/g, " ").slice(0, 180),
  };
}

function parseJsonObject(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI không trả JSON");
  return JSON.parse(match[0]) as Partial<CompetitorPostAnalysis>;
}

function normalizeAnalysis(raw: Partial<CompetitorPostAnalysis>, message: string): CompetitorPostAnalysis {
  const fallback = fallbackAnalysis(message);
  return {
    detectedTopic: String(raw.detectedTopic ?? fallback.detectedTopic).slice(0, 80),
    contentFormat: String(raw.contentFormat ?? fallback.contentFormat).slice(0, 60),
    detectedService: String(raw.detectedService ?? fallback.detectedService).slice(0, 80),
    hookType: String(raw.hookType ?? fallback.hookType).slice(0, 60),
    offerType: String(raw.offerType ?? fallback.offerType).slice(0, 60),
    ctaType: String(raw.ctaType ?? fallback.ctaType).slice(0, 60),
    aiSummary: String(raw.aiSummary ?? fallback.aiSummary).slice(0, 260),
  };
}

async function analyzeCompetitorPost(message: string, score: number): Promise<CompetitorPostAnalysis> {
  if (score < 120) return fallbackAnalysis(message);

  try {
    const raw = await generateContent(
      `Phân tích bài Facebook của đối thủ spa. Không copy nội dung, chỉ phân loại insight marketing.

BÀI ĐỐI THỦ:
${message.slice(0, 2_500)}

Trả JSON:
{
  "detectedTopic": "chủ đề chính, ngắn",
  "contentFormat": "testimonial|offer|educational|before_after|service_story|behind_scenes|trend|livestream",
  "detectedService": "dịch vụ liên quan",
  "hookType": "problem|result|offer|customer_story|warning|curiosity|direct_service",
  "offerType": "none|discount|bundle|gift|free_consult|limited_time",
  "ctaType": "soft|inbox|book_now|comment|call",
  "aiSummary": "1 câu insight, không sao chép câu chữ"
}`,
      "Bạn là competitor intelligence analyst cho spa Việt Nam. Chỉ trả JSON hợp lệ.",
    );
    return normalizeAnalysis(parseJsonObject(raw), message);
  } catch {
    return fallbackAnalysis(message);
  }
}

function addCount(map: Map<string, CountItem>, label: string | null | undefined, score: number) {
  const key = (label ?? "").trim();
  if (!key) return;
  const current = map.get(key) ?? { label: key, count: 0, score: 0 };
  current.count += 1;
  current.score += score;
  map.set(key, current);
}

function topItems(map: Map<string, CountItem>, limit: number) {
  return Array.from(map.values())
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit);
}

function stringifyItems(items: Array<Record<string, unknown>>) {
  return JSON.stringify(items);
}

function safeParseArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

async function summarizeCounterPositioning(input: {
  topics: CountItem[];
  formats: CountItem[];
  hooks: CountItem[];
  services: CountItem[];
}) {
  const fallbackRecommendations = [
    "Tạo 1-2 bài cùng chủ đề thị trường đang quan tâm nhưng dùng trải nghiệm/thế mạnh riêng của spa.",
    "Không lặp câu chữ hoặc offer của đối thủ; ưu tiên góc tư vấn thật và bằng chứng vận hành.",
    "Nếu nhiều đối thủ đẩy ưu đãi, phản ứng bằng combo rõ điều kiện thay vì giảm giá chung chung.",
  ];
  const fallbackCounter = "Đi theo insight thị trường nhưng khác biệt bằng câu chuyện thật, dịch vụ cụ thể và bằng chứng từ spa mình.";

  const compact = {
    topics: input.topics.slice(0, 5),
    formats: input.formats.slice(0, 5),
    hooks: input.hooks.slice(0, 5),
    services: input.services.slice(0, 5),
  };

  try {
    const raw = await generateContent(
      `Từ pattern đối thủ dưới đây, đề xuất cách spa mình phản ứng mà KHÔNG copy.

PATTERN:
${JSON.stringify(compact, null, 2)}

Trả JSON:
{
  "counterPositioning": "2-3 câu chiến lược khác biệt",
  "recommendations": ["hành động cụ thể 1", "hành động cụ thể 2", "hành động cụ thể 3"]
}`,
      "Bạn là chiến lược gia marketing spa. Không đề xuất copy đối thủ. Trả JSON hợp lệ.",
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Không có JSON");
    const parsed = JSON.parse(match[0]) as { counterPositioning?: string; recommendations?: string[] };
    return {
      counterPositioning: parsed.counterPositioning?.slice(0, 800) || fallbackCounter,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length
        ? parsed.recommendations.map((r) => String(r).slice(0, 220)).slice(0, 5)
        : fallbackRecommendations,
    };
  } catch {
    return { counterPositioning: fallbackCounter, recommendations: fallbackRecommendations };
  }
}

export async function learnFromCompetitors(): Promise<{ updated: number; insights: string[] }> {
  const since = new Date(Date.now() - 30 * 86400000);
  const insights: string[] = [];

  const candidates = await prisma.competitorPost.findMany({
    where: {
      learningStatus: "approved",
      publishedAt: { gte: since },
      OR: [
        { analyzedAt: null },
        { viralLevel: { in: ["medium", "high"] } },
      ],
    },
    include: { competitor: { select: { name: true } } },
    orderBy: [{ publishedAt: "desc" }],
    take: 80,
  });

  let updated = 0;
  for (const post of candidates) {
    const score = calculateCompetitorEngagement(post.likes, post.comments, post.shares);
    const level = competitorViralLevel(score);
    if (post.analyzedAt && post.engagementScore === score && post.viralLevel === level) continue;

    const analysis = await analyzeCompetitorPost(post.message, score);
    await prisma.competitorPost.update({
      where: { id: post.id },
      data: {
        engagementScore: score,
        viralLevel: level,
        detectedTopic: analysis.detectedTopic,
        contentFormat: analysis.contentFormat,
        detectedService: analysis.detectedService,
        hookType: analysis.hookType,
        offerType: analysis.offerType,
        ctaType: analysis.ctaType,
        aiSummary: analysis.aiSummary,
        analyzedAt: new Date(),
      },
    });
    updated++;
  }

  const posts = await prisma.competitorPost.findMany({
    where: {
      learningStatus: "approved",
      publishedAt: { gte: since },
    },
    include: { competitor: { select: { name: true } } },
    orderBy: [{ engagementScore: "desc" }, { likes: "desc" }],
    take: 300,
  });

  if (posts.length === 0) return { updated, insights: ["Chưa có bài đối thủ đủ điều kiện để học"] };

  const topicMap = new Map<string, CountItem>();
  const serviceMap = new Map<string, CountItem>();
  const formatMap = new Map<string, CountItem>();
  const hookMap = new Map<string, CountItem>();
  const offerMap = new Map<string, CountItem>();
  const competitorMap = new Map<string, MomentumItem>();
  let lastAnalyzedPostAt: Date | null = null;

  for (const post of posts) {
    const score = post.engagementScore || calculateCompetitorEngagement(post.likes, post.comments, post.shares);
    addCount(topicMap, post.detectedTopic ?? inferTopic(post.message), score);
    addCount(serviceMap, post.detectedService ?? inferService(post.message), score);
    addCount(formatMap, post.contentFormat ?? inferFormat(post.message), score);
    addCount(hookMap, post.hookType ?? inferHook(post.message), score);
    addCount(offerMap, post.offerType ?? inferOffer(post.message), score);

    const name = post.competitor.name;
    const current = competitorMap.get(name) ?? { competitor: name, posts: 0, viralPosts: 0, score: 0 };
    current.posts += 1;
    current.viralPosts += post.viralLevel === "high" || score >= 500 ? 1 : 0;
    current.score += score;
    competitorMap.set(name, current);

    if (!lastAnalyzedPostAt || post.publishedAt > lastAnalyzedPostAt) lastAnalyzedPostAt = post.publishedAt;
  }

  const topTopics = topItems(topicMap, 8);
  const topServices = topItems(serviceMap, 8);
  const topFormats = topItems(formatMap, 8);
  const topHooks = topItems(hookMap, 8);
  const commonOffers = topItems(offerMap, 8);
  const competitorMomentum = Array.from(competitorMap.values())
    .sort((a, b) => b.score - a.score || b.viralPosts - a.viralPosts)
    .slice(0, 8);
  const strategic = await summarizeCounterPositioning({
    topics: topTopics,
    formats: topFormats,
    hooks: topHooks,
    services: topServices,
  });

  const data = {
    windowDays: 30,
    topTopics: stringifyItems(topTopics),
    topServices: stringifyItems(topServices),
    topFormats: stringifyItems(topFormats),
    topHooks: stringifyItems(topHooks),
    commonOffers: stringifyItems(commonOffers),
    competitorMomentum: stringifyItems(competitorMomentum),
    counterPositioning: strategic.counterPositioning,
    recommendations: JSON.stringify(strategic.recommendations),
    sampleCount: posts.length,
    confidence: Math.min(posts.length / 60, 1),
    lastAnalyzedPostAt,
  };

  const existing = await prisma.competitorMemory.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) {
    await prisma.competitorMemory.update({ where: { id: existing.id }, data });
  } else {
    await prisma.competitorMemory.create({ data });
  }

  if (topTopics[0]) insights.push(`Đối thủ đang nổi bật với chủ đề "${topTopics[0].label}"`);
  if (topFormats[0]) insights.push(`Format đối thủ đang thắng: ${topFormats[0].label}`);
  if (competitorMomentum[0]) insights.push(`${competitorMomentum[0].competitor} có momentum mạnh nhất (${competitorMomentum[0].score} điểm)`);

  await prisma.learningInsight.create({
    data: {
      loop: "competitor",
      insight: insights.join(" · "),
      confidence: Math.min(posts.length / 60, 1),
      appliedTo: "content-generator, ads-creative, orchestrator",
    },
  });

  return { updated, insights };
}

export async function getCompetitorMemory() {
  return prisma.competitorMemory.findFirst({ orderBy: { updatedAt: "desc" } });
}

export async function getCompetitorContext(): Promise<CompetitorContext> {
  const mem = await getCompetitorMemory();
  if (!mem) {
    return {
      insight: "",
      topTopics: [],
      topServices: [],
      topFormats: [],
      topHooks: [],
      recommendations: [],
      counterPositioning: null,
    };
  }

  const topics = safeParseArray<CountItem>(mem.topTopics);
  const services = safeParseArray<CountItem>(mem.topServices);
  const formats = safeParseArray<CountItem>(mem.topFormats);
  const hooks = safeParseArray<CountItem>(mem.topHooks);
  const recommendations = safeParseArray<string>(mem.recommendations);

  const parts: string[] = [];
  if (topics[0]) parts.push(`topic đối thủ đang thắng: ${topics[0].label}`);
  if (services[0]) parts.push(`dịch vụ bị đẩy mạnh: ${services[0].label}`);
  if (formats[0]) parts.push(`format hiệu quả: ${formats[0].label}`);
  if (hooks[0]) parts.push(`hook phổ biến: ${hooks[0].label}`);
  if (mem.counterPositioning) parts.push(`khác biệt đề xuất: ${mem.counterPositioning}`);

  return {
    insight: parts.join("; "),
    topTopics: topics.map((i) => i.label),
    topServices: services.map((i) => i.label),
    topFormats: formats.map((i) => i.label),
    topHooks: hooks.map((i) => i.label),
    recommendations,
    counterPositioning: mem.counterPositioning,
  };
}
