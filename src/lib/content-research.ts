import "server-only";

import { prisma } from "./db";
import { readPostBrief } from "./creative-brief";
import { generateContent, getBrandContext } from "./claude";
import { generateChatCompletion } from "./openai";
import { getTopCompetitorPosts } from "./competitor-research";
import { reviewContent } from "./reviewer";
import { scoreHumanWriting } from "./content-humanizer";
import { getHumanVoiceProfile } from "./human-voice";
import { getCompetitorContext } from "./learning/competitor-learning";
import { nextAnnualBusinessOccurrence } from "./today-policy";

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
  facebookPageId: string,
  daysAhead: number = 7,
  postsPerDay: number = 1,
): Promise<{ created: number; ideas: ContentIdea[] }> {
  const now = new Date();

  // Gather context in parallel
  const [services, topPosts, holidays, brandCtx, competitorPosts, competitorMemory] = await Promise.all([
    prisma.service.findMany({
      where: { facebookPageId },
      select: { name: true, description: true },
      take: 10,
    }),
    prisma.post.findMany({
      where: { facebookPageId, status: "published" },
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
    getCompetitorContext(),
  ]);

  const serviceList = services.map((s: { name: string; description: string | null }) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`).join("\n");
  const topCaptions = topPosts.map((p: { caption: string }, i: number) => `${i + 1}. ${p.caption.slice(0, 120)}...`).join("\n");
  const upcomingHolidays = holidays
    .map((holiday: { name: string; date: string }) => ({ ...holiday, occurrence: nextAnnualBusinessOccurrence(holiday.date, now) }))
    .filter((holiday) => holiday.occurrence.daysUntil <= daysAhead);
  const holidayList = upcomingHolidays.map((holiday) => `- ${holiday.name}: ${holiday.occurrence.eventDate.toISOString().slice(0, 10)}`).join("\n");
  const totalPosts = daysAhead * postsPerDay;

  const prompt = `Hôm nay: ${now.toLocaleDateString("vi-VN")} (${["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"][now.getDay()]})

Dịch vụ spa:
${serviceList || "Chưa có dịch vụ nào được cấu hình"}

Ngày đặc biệt trong ${daysAhead} ngày tới:
${holidayList || "Không có"}

Bài đăng hiệu quả nhất gần đây:
${topCaptions || "Chưa có dữ liệu"}

${competitorPosts.length > 0 ? `Bài viral của đối thủ tuần qua (để tham khảo hướng nội dung, KHÔNG copy):\n${competitorPosts.map((p, i) => `${i + 1}. [${p.competitor.name}] ${p.message.slice(0, 150)}... (${p.likes} likes)`).join("\n")}\n` : ""}
${competitorMemory.insight ? `Competitor Memory 30 ngày (chỉ dùng để hiểu thị trường, KHÔNG copy):\n${competitorMemory.insight}\n` : ""}
${competitorMemory.recommendations.length > 0 ? `Gợi ý phản ứng an toàn:\n${competitorMemory.recommendations.map((r) => `- ${r}`).join("\n")}\n` : ""}
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

  const draftIdeas = ideas.map((idea) => ({ ...idea }));
  const voiceProfile = await getHumanVoiceProfile(facebookPageId);
  const voiceRules = voiceProfile?.autoApply ? voiceProfile.rules : "";
  const lowScoreItems = ideas
    .map((idea, index) => ({ index, idea, score: scoreHumanWriting(idea.caption, Boolean(voiceRules)) }))
    .filter((item) => item.score.score < 80);

  if (lowScoreItems.length > 0) {
    try {
      const batch = lowScoreItems.map((item) => ({
        index: item.index,
        caption: item.idea.caption,
        hashtags: item.idea.hashtags,
        issues: item.score.issues.map((issue) => issue.message),
      }));
      const editedRaw = await generateContent(
        `Biên tập các bài sau để nghe như người thật tại spa viết. Không thêm dữ kiện mới.
${voiceRules ? `\nHuman Voice Profile:\n${voiceRules}\n` : ""}
INPUT:
${JSON.stringify(batch)}

Trả JSON array đúng dạng:
[{"index": 0, "caption": "bản đã sửa", "hashtags": "#..."}]`,
        "Bạn là Human Editor tiếng Việt. Loại văn AI, câu sáo rỗng, emoji thừa và CTA máy móc. Giữ nguyên index. Chỉ trả JSON.",
      );
      const json = editedRaw.match(/\[[\s\S]*\]/)?.[0];
      if (json) {
        const edited = JSON.parse(json) as Array<{ index: number; caption: string; hashtags?: string }>;
        for (const item of edited) {
          if (ideas[item.index] && item.caption?.trim()) {
            ideas[item.index] = {
              ...ideas[item.index],
              caption: item.caption.trim(),
              hashtags: item.hashtags?.trim() || ideas[item.index].hashtags,
            };
          }
        }
      }
    } catch {
      // Keep the council version if batch humanization fails.
    }
  }

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
          facebookPageId,
        },
      });
    })
  );

  await prisma.contentGeneration.createMany({
    data: created.map((post, index) => {
      const score = scoreHumanWriting(ideas[index].caption, Boolean(voiceRules));
      return {
        postId: post.id,
        facebookPageId,
        promptVersion: "research-human-v1",
        mode: "research",
        narrator: "brand",
        brief: JSON.stringify({ topic: ideas[index].topic, daysAhead, postsPerDay }),
        strategy: `AI Council content plan: ${ideas[index].topic}`,
        draftCaption: draftIdeas[index]?.caption ?? ideas[index].caption,
        editorCaption: ideas[index].caption,
        finalCaption: ideas[index].caption,
        hashtags: ideas[index].hashtags,
        humanScore: score.score,
        scoreDetails: JSON.stringify(score),
      };
    }),
  });

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

export async function getResearchDrafts(facebookPageId: string, limit = 30) {
  const drafts = await prisma.post.findMany({
    where: {
      facebookPageId,
      status: "draft",
      qualityNotes: { startsWith: "AI-RESEARCH:" },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      summary: true,
      outline: true,
      hooks: true,
      topicTags: true,
      targetChannels: true,
      caption: true,
      hashtags: true,
      postType: true,
      tone: true,
      scheduledAt: true,
      qualityNotes: true,
      createdAt: true,
      assets: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          kind: true,
          name: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          durationSec: true,
        },
      },
    },
  });
  return drafts.map(({ outline, hooks, topicTags, targetChannels, ...draft }) => ({
    ...draft,
    brief: readPostBrief({ title: draft.title, summary: draft.summary, outline, hooks, topicTags, targetChannels }),
    scheduledAt: draft.scheduledAt?.toISOString() ?? null,
    createdAt: draft.createdAt.toISOString(),
  }));
}
