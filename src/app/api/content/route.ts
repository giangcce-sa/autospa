import { prisma } from "@/lib/db";
import { generateContent, getBrandContext, getStyleProfile, getStyleSamples } from "@/lib/claude";
import { getContentContext } from "@/lib/learning/content-memory";
import { getCompetitorContext } from "@/lib/learning/competitor-learning";
import { getHumanVoiceProfile } from "@/lib/human-voice";
import { humanEditorPrompt, scoreHumanWriting } from "@/lib/content-humanizer";
import { BRIEF_LIMITS } from "@/lib/creative-brief";
import { AccessError, requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { pageScopeMatches } from "@/lib/page-scope-policy";
import { clampBriefList, clampBriefText } from "@/lib/post-brief-input";
import { NextRequest, NextResponse } from "next/server";

const POST_TYPE_LABELS: Record<string, string> = {
  service: "giới thiệu dịch vụ",
  promotion: "thông báo khuyến mãi",
  tip: "tip làm đẹp",
  intro: "giới thiệu combo",
};

const TONE_LABELS: Record<string, string> = {
  friendly: "thân thiện, gần gũi, như người bạn",
  professional: "chuyên nghiệp, tư vấn uy tín",
  luxury: "sang trọng, tinh tế, cao cấp",
};

/** The labelled sections the writer prompt asks for, in the order it asks for them. */
const BRIEF_SECTIONS = ["TITLE", "SUMMARY", "OUTLINE", "HOOKS", "CAPTION", "HASHTAGS"] as const;

type BriefSection = (typeof BRIEF_SECTIONS)[number];

// Tolerates the decoration models add around labels: "TITLE:", "**TITLE**:",
// "**TITLE:**", "## TITLE:", "- TITLE:", full-width colon.
const SECTION_LABEL = new RegExp(String.raw`^[ \t*#>_-]*(${BRIEF_SECTIONS.join("|")})\s*\**\s*[:：]\**`, "gim");
const BULLET_PREFIX = /^\s*(?:[-–—•*+]|\d{1,2}[.)])\s*/;

/** "- Mở bài", "• Mở bài", "1. Mở bài" and "**Mở bài**" all reduce to "Mở bài". */
function cleanBriefLine(line: string) {
  return line.replace(BULLET_PREFIX, "").replace(/^\*+|\*+$/g, "").trim();
}

/**
 * Splits the model answer on its section labels. Order-independent and tolerant
 * of missing sections — a label the model skipped is simply absent from the map.
 */
function splitLabelledSections(result: string) {
  const labels: { label: BriefSection; labelStart: number; bodyStart: number }[] = [];
  for (const match of result.matchAll(SECTION_LABEL)) {
    const index = match.index ?? 0;
    labels.push({
      label: match[1].toUpperCase() as BriefSection,
      labelStart: index,
      bodyStart: index + match[0].length,
    });
  }
  const sections = new Map<BriefSection, string>();
  labels.forEach((entry, position) => {
    const body = result.slice(entry.bodyStart, labels[position + 1]?.labelStart ?? result.length).trim();
    // First occurrence wins: a model that repeats a label is echoing the format.
    if (body && !sections.has(entry.label)) sections.set(entry.label, body);
  });
  // Text before the first label — the whole answer when the model used none.
  return { sections, preamble: result.slice(0, labels[0]?.labelStart ?? result.length).trim() };
}

function parseBulletList(body: string | undefined, maxItems: number) {
  if (!body) return [];
  const lines = body.split(/\r?\n/).map(cleanBriefLine);
  return clampBriefList(lines, maxItems, BRIEF_LIMITS.itemLength);
}

/**
 * Reads CAPTION/HASHTAGS plus the structured brief (TITLE, SUMMARY, OUTLINE,
 * HOOKS) out of a generation. Never throws: an answer that carries no labels at
 * all still yields the whole text as the caption, as the editor passes rely on.
 */
function parseGeneratedContent(result: string) {
  const { sections, preamble } = splitLabelledSections(result);
  const summary = sections.get("SUMMARY")?.replace(/\s+/g, " ");
  return {
    caption: sections.get("CAPTION") || preamble || result.trim(),
    hashtags: sections.get("HASHTAGS") ?? "",
    title: clampBriefText(sections.get("TITLE")?.split(/\r?\n/).map(cleanBriefLine).find(Boolean), BRIEF_LIMITS.title),
    summary: clampBriefText(summary, BRIEF_LIMITS.summary),
    outline: parseBulletList(sections.get("OUTLINE"), BRIEF_LIMITS.outlineItems),
    hooks: parseBulletList(sections.get("HOOKS"), BRIEF_LIMITS.hookItems),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      serviceId, postType, tone, customNote, platform, facebookPageId,
      includeStory, storyId, mode = "quick", narrator = "brand", material = {},
    } = body;
    await requirePageAccess(facebookPageId, { owner: true });

    const [brandContext, styleProfile, styleSamples, service, learningCtx, competitorCtx, humanVoice, settings] = await Promise.all([
      getBrandContext(),
      getStyleProfile(facebookPageId),
      getStyleSamples(5, facebookPageId),
      serviceId ? prisma.service.findUnique({ where: { id: serviceId } }) : null,
      getContentContext(),
      getCompetitorContext(),
      getHumanVoiceProfile(facebookPageId),
      prisma.settings.findFirst({ select: { claudeBaseUrl: true, openaiChatModel: true } }),
    ]);
    if (service && !pageScopeMatches(service.facebookPageId, facebookPageId, { allowGlobalRecord: true })) {
      throw new AccessError("Dịch vụ không thuộc Facebook Page đã chọn", 403);
    }

    // Pick a real spa story to weave into the post
    let storyContext: string | null = null;
    if (includeStory) {
      let story = storyId
        ? await prisma.spaStory.findUnique({ where: { id: storyId } })
        : null;
      if (storyId && !story) throw new AccessError("Không tìm thấy câu chuyện", 404);
      if (story && !pageScopeMatches(story.facebookPageId, facebookPageId, { allowGlobalRecord: true })) {
        throw new AccessError("Câu chuyện không thuộc Facebook Page đã chọn", 403);
      }

      if (!story) {
        // Auto-pick: prefer stories matching the service name, else any active
        const candidates = await prisma.spaStory.findMany({
          where: {
            facebookPageId: facebookPageId || null,
            isActive: true,
            ...(service ? { service: { contains: service.name, mode: "insensitive" as const } } : {}),
          },
          take: 5,
        });

        if (candidates.length === 0 && service) {
          // Fallback: any active story
          const all = await prisma.spaStory.findMany({
            where: { facebookPageId: facebookPageId || null, isActive: true },
            take: 10,
          });
          candidates.push(...all);
        }

        if (candidates.length > 0) {
          story = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (story) {
        const who = story.customerName ? `${story.customerName}` : "một khách hàng";
        const svc = story.service ? ` (dịch vụ ${story.service})` : "";
        storyContext = `Câu chuyện thực tế từ spa${svc} — ${who}:\n"${story.content}"`;
      }
    }

    const serviceInfo = service
      ? `Dịch vụ: ${service.name}\nGiá: ${service.price ?? "liên hệ"}\nMô tả: ${service.description ?? ""}\nThời gian: ${service.duration ?? ""}`
      : "Không có dịch vụ cụ thể";

    const voiceRules = humanVoice?.autoApply
      ? humanVoice.rules
      : "";
    const materialContext = [
      material.situation ? `Tình huống thật: ${material.situation}` : "",
      material.customerProblem ? `Vấn đề khách gặp: ${material.customerProblem}` : "",
      material.observation ? `Chi tiết quan sát tại spa: ${material.observation}` : "",
      material.customerQuote ? `Lời khách nói: "${material.customerQuote}"` : "",
      material.avoid ? `Điều không được viết: ${material.avoid}` : "",
      material.goal ? `Mục tiêu bài: ${material.goal}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `Bạn viết nội dung cho một spa Việt Nam như người đang trực tiếp làm việc tại đó.
${brandContext ? `\nThông tin thương hiệu:\n${brandContext}` : ""}
${styleProfile ? `\nVăn phong cần theo:\n${styleProfile}` : ""}
${styleSamples ? `\nCác bài mẫu tham khảo văn phong:\n${styleSamples}` : ""}
${voiceRules ? `\nHuman Voice Profile đã học từ bản người dùng sửa:\n${voiceRules}` : ""}
${learningCtx.insight ? `\nHọc từ lịch sử: ${learningCtx.insight}` : ""}
${learningCtx.topKeywords.length > 0 ? `Từ khóa resonates với khách: ${learningCtx.topKeywords.slice(0, 5).join(", ")}` : ""}
${competitorCtx.insight ? `\nRadar đối thủ đã học: ${competitorCtx.insight}` : ""}
${competitorCtx.recommendations.length > 0 ? `Gợi ý phản ứng thị trường: ${competitorCtx.recommendations.slice(0, 3).join(" | ")}` : ""}

Quy tắc bắt buộc:
- Viết hoàn toàn bằng tiếng Việt
- Tone giọng: ${TONE_LABELS[tone] ?? "thân thiện"}
- Người kể: ${narrator}
- Không hứa hẹn kết quả 100%, không dùng từ ngữ phóng đại
- Không vi phạm chính sách Facebook về ngành làm đẹp
- Có CTA rõ ràng nhưng không quá thúc ép
- Có yếu tố cảm xúc, dễ đọc trên điện thoại
- Không mở bài bằng câu hỏi sáo rỗng
- Không dùng các cụm "nâng tầm", "đánh thức vẻ đẹp", "tự tin tỏa sáng", "giải pháp hoàn hảo", "inbox ngay" nếu không thật sự cần
- Không tự bịa tên khách, trải nghiệm, con số hoặc kết quả
- Nếu dùng insight đối thủ: chỉ lấy hướng thị trường, không copy câu chữ/offer của đối thủ, không nhắc tên đối thủ trong bài public
- Trả về đúng 6 phần có nhãn, theo thứ tự: TITLE, SUMMARY, OUTLINE, HOOKS, CAPTION, HASHTAGS
- TITLE: một dòng ngắn gọn để gọi tên bài, không phải tiêu đề quảng cáo
- SUMMARY: 2-3 câu tóm tắt bài nói gì và cho ai
- OUTLINE: 3-6 dòng gạch đầu dòng, mỗi dòng một ý theo mạch bài
- HOOKS: đúng 3 câu mở bài thay thế, đánh số 1. 2. 3., mỗi câu một góc tiếp cận khác nhau
- CAPTION: nội dung bài đăng hoàn chỉnh
- HASHTAGS: danh sách hashtag, mỗi cái một dòng`;

    const brief = `Bài ${POST_TYPE_LABELS[postType] ?? "giới thiệu"} cho ${platform ?? "Facebook"}.

${serviceInfo}
${customNote ? `Ghi chú thêm: ${customNote}` : ""}
${materialContext ? `\nChất liệu do người dùng cung cấp:\n${materialContext}` : ""}
${storyContext ? `\n${storyContext}\n\nYêu cầu: Kết hợp câu chuyện thực tế trên một cách tự nhiên vào bài viết. Đừng copy nguyên văn — hãy diễn đạt lại để nó trở thành điểm nhấn cảm xúc của bài.` : ""}
Chế độ: ${mode}. Người kể: ${narrator}.`;

    const strategy = await generateContent(
      `${brief}\n\nChọn một góc kể cụ thể. Trả lời ngắn theo 4 dòng: INSIGHT, OPENING, DETAIL, CTA. Không viết caption.`,
      "Bạn là content strategist thực tế. Không dùng ý tưởng quảng cáo chung chung và không tự bịa chất liệu.",
    );

    const writerResult = await generateContent(`${brief}

CHIẾN LƯỢC:
${strategy}

Viết bài dựa trên chiến lược và chỉ dùng các chi tiết đã được cung cấp.

Trả về theo format:
TITLE:
[một dòng ngắn gọn gọi tên bài]

SUMMARY:
[2-3 câu tóm tắt bài]

OUTLINE:
- [ý mở bài]
- [ý triển khai]
- [ý chốt và CTA]

HOOKS:
1. [câu mở bài thay thế 1]
2. [câu mở bài thay thế 2]
3. [câu mở bài thay thế 3]

CAPTION:
[Nội dung bài viết]

HASHTAGS:
[hashtag1]
[hashtag2]
...`, systemPrompt);
    const draft = parseGeneratedContent(writerResult);

    let editorResult = await generateContent(
      humanEditorPrompt({ draft: `${draft.caption}\n\n${draft.hashtags}`, voiceRules }),
      "Bạn là Human Editor tiếng Việt khó tính. Mục tiêu là bài tự nhiên, cụ thể và đúng giọng, không phải làm văn hay hơn.",
    );
    let edited = parseGeneratedContent(editorResult);
    let humanScore = scoreHumanWriting(edited.caption, Boolean(voiceRules));

    if (humanScore.score < 80 && humanScore.issues.length > 0) {
      editorResult = await generateContent(
        humanEditorPrompt({ draft: `${edited.caption}\n\n${edited.hashtags}`, voiceRules, issues: humanScore.issues }),
        "Bạn là Human Editor vòng cuối. Chỉ sửa đúng các lỗi được chỉ ra, không thêm dữ kiện mới.",
      );
      edited = parseGeneratedContent(editorResult);
      humanScore = scoreHumanWriting(edited.caption, Boolean(voiceRules));
    }
    const caption = edited.caption;
    const hashtags = edited.hashtags || draft.hashtags;
    // The Human Editor passes only return CAPTION/HASHTAGS, so the brief stays
    // the writer's unless an editor pass happens to restate it.
    const title = edited.title ?? draft.title;
    const summary = edited.summary ?? draft.summary;
    const outline = edited.outline.length > 0 ? edited.outline : draft.outline;
    const hooks = edited.hooks.length > 0 ? edited.hooks : draft.hooks;

    const generation = await prisma.contentGeneration.create({
      data: {
        postId: null,
        facebookPageId: facebookPageId ?? null,
        promptVersion: "human-v1",
        model: settings?.claudeBaseUrl.includes("anthropic.com") ? "claude-direct" : settings?.openaiChatModel ?? "gateway",
        mode,
        narrator,
        brief: JSON.stringify({ serviceId, postType, tone, customNote, platform, material, storyId }),
        strategy,
        draftCaption: draft.caption,
        editorCaption: caption,
        finalCaption: caption,
        hashtags,
        humanScore: humanScore.score,
        scoreDetails: JSON.stringify(humanScore),
      },
    });

    return NextResponse.json({
      data: {
        caption,
        hashtags,
        title: title ?? null,
        summary: summary ?? null,
        outline,
        hooks,
        generationId: generation.id,
        humanScore,
        draftCaption: draft.caption,
        voiceProfile: humanVoice ? {
          id: humanVoice.id,
          approvedEdits: humanVoice.approvedEdits,
          confidence: humanVoice.confidence,
          autoApply: humanVoice.autoApply,
        } : null,
      },
      success: true,
    });
  } catch (err) {
    return routeErrorResponse(err, "Lỗi không xác định");
  }
}
