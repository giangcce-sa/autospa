import { prisma } from "./db";
import { generateContent, getBrandContext } from "./claude";
import { generateChatCompletion } from "./openai";
import { getTopCompetitorPosts } from "./competitor-research";
import { reviewContent } from "./reviewer";

interface ContentIdea {
  topic: string;
  caption: string;
  hashtags: string;
  postType: string;
  tone: string;
  dayOffset: number;
  hour: number;
}

export async function generateContentPlan(
  daysAhead: number = 7,
  postsPerDay: number = 1
): Promise<{ created: number; ideas: ContentIdea[] }> {
  const now = new Date();

  // Gather context in parallel
  const [services, topPosts, holidays, brandCtx, competitorPosts] = await Promise.all([
    prisma.service.findMany({ select: { name: true, description: true }, take: 10 }),
    prisma.post.findMany({
      where: { status: "published" },
      orderBy: [{ analytics: { likes: "desc" } }],
      select: { caption: true, postType: true, tone: true },
      take: 5,
    }),
    prisma.holidayEvent.findMany({
      where: { isActive: true },
      select: { name: true, date: true },
      take: 20,
    }),
    getBrandContext(),
    getTopCompetitorPosts(7, 5).catch(() => []),
  ]);

  const serviceList = services.map((s: { name: string; description: string | null }) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`).join("\n");
  const topCaptions = topPosts.map((p: { caption: string }, i: number) => `${i + 1}. ${p.caption.slice(0, 120)}...`).join("\n");
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const upcomingHolidays = holidays.filter((h: { name: string; date: string }) => h.date >= todayStr && h.date <= cutoff);
  const holidayList = upcomingHolidays.map((h: { name: string; date: string }) => `- ${h.name}: ${h.date}`).join("\n");
  const totalPosts = daysAhead * postsPerDay;

  const prompt = `Hôm nay: ${now.toLocaleDateString("vi-VN")} (${["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"][now.getDay()]})

Dịch vụ spa:
${serviceList || "Chưa có dịch vụ nào được cấu hình"}

Ngày đặc biệt trong ${daysAhead} ngày tới:
${holidayList || "Không có"}

Bài đăng hiệu quả nhất gần đây:
${topCaptions || "Chưa có dữ liệu"}

${competitorPosts.length > 0 ? `Bài viral của đối thủ tuần qua (để tham khảo hướng nội dung, KHÔNG copy):\n${competitorPosts.map((p, i) => `${i + 1}. [${p.competitor.name}] ${p.message.slice(0, 150)}... (${p.likes} likes)`).join("\n")}\n` : ""}
${brandCtx ? `Thông tin thương hiệu:\n${brandCtx}\n` : ""}

Tạo kế hoạch nội dung ${totalPosts} bài cho ${daysAhead} ngày tới (${postsPerDay} bài/ngày). Trả về JSON array, mỗi phần tử:
{
  "topic": "chủ đề ngắn",
  "caption": "nội dung bài đăng đầy đủ bằng tiếng Việt (150-300 từ, có emoji)",
  "hashtags": "#hashtag1 #hashtag2 ...",
  "postType": "service|promotion|educational|testimonial|behind_scenes",
  "tone": "friendly|professional|emotional|humorous",
  "dayOffset": 1,
  "hour": 9
}
dayOffset: 1 = ngày mai, 2 = ngày kia... Phân bổ đều các ngày. hour: giờ đăng tốt nhất (8/9/11/17/20).
Chỉ trả về JSON array, không giải thích.`;

  // Vòng 1: Claude đề xuất plan
  const claudeRaw = await generateContent(prompt,
    "Bạn là chuyên gia marketing spa tại Việt Nam. Tạo nội dung hấp dẫn, phù hợp văn hóa Việt, tập trung vào lợi ích cho khách hàng."
  );

  // Vòng 2: GPT phản biện plan của Claude
  let revisedRaw = claudeRaw;
  try {
    const critiquePrompt = `Đây là kế hoạch content do Claude vừa tạo cho spa Việt Nam:

${claudeRaw}

BỐI CẢNH GỐC:
${prompt}

Hãy phản biện ngắn gọn (5-8 câu, gạch đầu dòng): Có gì trùng đề tài? Có thiếu pillar nào không? Tone có phù hợp khách spa nữ Việt Nam? Có rủi ro vi phạm chính sách FB ngành làm đẹp không?`;

    const gptCritique = await generateChatCompletion(
      critiquePrompt,
      "Bạn là chuyên gia kiểm duyệt content marketing spa. Phản biện xây dựng, cụ thể, không lan man."
    );

    // Vòng 3: Claude revise plan dựa trên critique
    const revisePrompt = `Kế hoạch ban đầu của bạn (JSON):
${claudeRaw}

Phản biện từ chuyên gia kiểm duyệt:
${gptCritique}

Hãy điều chỉnh kế hoạch để khắc phục các điểm phản biện. Giữ NGUYÊN định dạng JSON array với cùng các field (topic, caption, hashtags, postType, tone, dayOffset, hour). Chỉ trả JSON, không giải thích thêm.`;

    revisedRaw = await generateContent(revisePrompt,
      "Bạn là chuyên gia marketing spa tại Việt Nam. Phản hồi phản biện bằng cách điều chỉnh kế hoạch. Luôn trả JSON hợp lệ."
    );
  } catch {
    // Council bị lỗi (vd OpenAI chưa cấu hình) → dùng plan gốc của Claude
    revisedRaw = claudeRaw;
  }

  const raw = revisedRaw;

  // Parse JSON — handle markdown code blocks
  let ideas: ContentIdea[] = [];
  try {
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    ideas = JSON.parse(jsonStr);
  } catch {
    // Try extracting JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) ideas = JSON.parse(match[0]);
  }

  if (!ideas.length) return { created: 0, ideas: [] };

  // Create Post records
  const created = await prisma.$transaction(
    ideas.map((idea) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + (idea.dayOffset ?? 1));
      scheduledAt.setHours(idea.hour ?? 9, 0, 0, 0);

      return prisma.post.create({
        data: {
          caption: idea.caption,
          hashtags: idea.hashtags,
          postType: idea.postType ?? "service",
          tone: idea.tone ?? "friendly",
          status: "draft",
          scheduledAt,
          qualityNotes: `AI-RESEARCH: ${idea.topic}`,
        },
      });
    })
  );

  // Auto-review tất cả drafts vừa tạo — không chờ user click publish mới phát hiện vi phạm
  await Promise.allSettled(
    created.map((post) =>
      reviewContent({
        id: post.id,
        caption: post.caption,
        hashtags: post.hashtags,
        platform: post.platform,
        facebookPageId: post.facebookPageId,
      })
    )
  );

  return { created: created.length, ideas };
}

export async function getResearchDrafts(limit = 30) {
  return prisma.post.findMany({
    where: { status: "draft", qualityNotes: { startsWith: "AI-RESEARCH:" } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}
