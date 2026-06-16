import { prisma } from "./db";
import { generateContent } from "./claude";

export type IssueType =
  | "spelling"
  | "fb_policy"
  | "brand_tone"
  | "length"
  | "cta_missing"
  | "exaggeration"
  | "medical_claim"
  | "personal_attribute"   // FB cấm target/ám chỉ đặc điểm cá nhân
  | "before_after"          // FB cấm before/after cho medical/cosmetic
  | "negative_self_image";  // FB cấm content tạo cảm xúc tiêu cực về bản thân

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface ReviewIssue {
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  status: "pass" | "warn" | "fail";
  score: number;            // 0-100
  issues: ReviewIssue[];
  reviewedAt: Date;
}

// FB Policy banned phrases — beauty/spa industry
const BANNED_EXAGGERATIONS = [
  "100%", "100 phần trăm",
  "chữa khỏi", "chữa được hoàn toàn", "khỏi hẳn",
  "diệt tận gốc", "diệt sạch",
  "siêu tốc", "thần kỳ", "kỳ diệu",
  "không tác dụng phụ", "tuyệt đối an toàn",
  "đảm bảo thành công", "cam kết khỏi",
  "rẻ nhất thị trường", "tốt nhất việt nam",
  "phép màu", "thần dược",
  "vĩnh viễn", "mãi mãi",
  "duy nhất", "số 1 việt nam", "số một việt nam",
];

const MEDICAL_CLAIM_KEYWORDS = [
  "chữa bệnh", "điều trị bệnh", "thuốc",
  "trị dứt điểm", "trị tận gốc",
  "y học", "y khoa",
  "phẫu thuật", "nội tiết", "hormone",
];

// FB cấm content "ám chỉ đặc điểm cá nhân của user" (Personal Attributes policy)
// Ví dụ: "Bạn có béo không?", "Bạn có mụn không?", "Da bạn xấu?" → BAN
const PERSONAL_ATTRIBUTE_PATTERNS = [
  /\bbạn\s+(có|đang|bị|từng)\s+(béo|mập|gầy|xấu|già|nhăn|nám|mụn|đen|hôi)/i,
  /\bda\s+bạn\s+(xấu|tệ|đen|nám|mụn|nhăn|già|hư|khô|dầu|sần|nhờn)/i,
  /\b(làn da|gương mặt|cơ thể)\s+bạn\s+(xấu|tệ|đen|già)/i,
  /\bbạn\s+(đã|có)\s+(\d+\s*tuổi|già)/i,
];

// FB cấm before/after cho cosmetic procedures (Personal Attributes + Misleading)
const BEFORE_AFTER_PATTERNS = [
  /\bbefore\s*[-/&]?\s*after\b/i,
  /\btrước\s*[-/&]?\s*sau\b.*(điều trị|liệu trình|sử dụng|làm)/i,
  /\bso\s+sánh\b.*(trước|sau)/i,
];

// FB cấm content tạo cảm xúc tiêu cực về bản thân
const NEGATIVE_SELF_PATTERNS = [
  /\b(xấu hổ|tự ti|mặc cảm|kém duyên|kém sắc|ế|già nua|hết thời|kém cỏi)\b/i,
  /\b(không ai yêu|không ai để ý|bị chê)\b/i,
];

const PLATFORM_LENGTH_RANGES: Record<string, { min: number; max: number; ideal: [number, number] }> = {
  facebook: { min: 50, max: 600, ideal: [100, 300] },
  zalo: { min: 30, max: 300, ideal: [50, 150] },
  tiktok: { min: 20, max: 200, ideal: [30, 100] },
  instagram: { min: 50, max: 400, ideal: [80, 200] },
};

const CTA_KEYWORDS = [
  "đặt lịch", "đặt ngay", "liên hệ", "inbox", "hotline",
  "gọi ngay", "nhắn tin", "đăng ký", "tham khảo", "xem thêm",
  "trải nghiệm", "ghé thăm", "đến với", "click", "tham gia",
];

function checkBannedPhrases(text: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const lower = text.toLowerCase();

  for (const phrase of BANNED_EXAGGERATIONS) {
    if (lower.includes(phrase)) {
      issues.push({
        type: "exaggeration",
        severity: "high",
        message: `Phát hiện cụm từ phóng đại: "${phrase}"`,
        suggestion: "Thay bằng cách diễn đạt thực tế: 'hiệu quả cao', 'cải thiện rõ rệt', 'phù hợp với nhiều khách hàng'",
      });
    }
  }

  for (const kw of MEDICAL_CLAIM_KEYWORDS) {
    if (lower.includes(kw)) {
      issues.push({
        type: "medical_claim",
        severity: "critical",
        message: `Có ngôn ngữ y tế/khám chữa bệnh: "${kw}"`,
        suggestion: "Spa không phải cơ sở y tế. Tránh từ liên quan chữa bệnh — FB Policy nghiêm ngặt ngành làm đẹp.",
      });
    }
  }

  // FB Personal Attributes policy
  for (const pattern of PERSONAL_ATTRIBUTE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      issues.push({
        type: "personal_attribute",
        severity: "critical",
        message: `Ám chỉ đặc điểm cá nhân của user: "${match[0]}"`,
        suggestion: "FB cấm content ám chỉ user béo/xấu/mụn/già... Diễn đạt chung: 'Khách hàng có làn da mụn' thay vì 'Bạn có mụn?'",
      });
      break; // 1 match là đủ cảnh báo
    }
  }

  // FB Before/After policy (đặc biệt với cosmetic/medical)
  for (const pattern of BEFORE_AFTER_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        type: "before_after",
        severity: "high",
        message: "Có nội dung 'trước/sau' (before/after) — FB hạn chế ngành cosmetic",
        suggestion: "Bỏ so sánh trước/sau hoặc thay bằng 'kết quả sau liệu trình' (không kèm ảnh ghép)",
      });
      break;
    }
  }

  // Negative self-image
  for (const pattern of NEGATIVE_SELF_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      issues.push({
        type: "negative_self_image",
        severity: "high",
        message: `Tạo cảm xúc tiêu cực về bản thân: "${match[0]}"`,
        suggestion: "FB cấm content khiến user cảm thấy tự ti. Thay bằng tone tích cực: 'tự tin hơn', 'rạng rỡ hơn'",
      });
      break;
    }
  }

  return issues;
}

function checkLength(text: string, platform: string): ReviewIssue[] {
  const wordCount = text.trim().split(/\s+/).length;
  const range = PLATFORM_LENGTH_RANGES[platform] ?? PLATFORM_LENGTH_RANGES.facebook;

  const issues: ReviewIssue[] = [];
  if (wordCount < range.min) {
    issues.push({
      type: "length",
      severity: "medium",
      message: `Bài quá ngắn (${wordCount} từ, tối thiểu ${range.min} từ cho ${platform})`,
      suggestion: "Bổ sung lợi ích cụ thể hoặc câu chuyện khách hàng",
    });
  } else if (wordCount > range.max) {
    issues.push({
      type: "length",
      severity: "low",
      message: `Bài hơi dài (${wordCount} từ, lý tưởng ${range.ideal[0]}-${range.ideal[1]} cho ${platform})`,
      suggestion: "Rút gọn hoặc tách thành 2 bài",
    });
  }
  return issues;
}

function checkCTA(text: string): ReviewIssue[] {
  const lower = text.toLowerCase();
  const hasCta = CTA_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasCta) {
    return [{
      type: "cta_missing",
      severity: "medium",
      message: "Thiếu lời kêu gọi hành động (CTA)",
      suggestion: "Thêm câu như 'Inbox để được tư vấn miễn phí' hoặc 'Đặt lịch hotline 09xx...'",
    }];
  }
  return [];
}

async function checkSpellingAndTone(text: string, facebookPageId?: string | null): Promise<ReviewIssue[]> {
  const styleProfile = await prisma.styleProfile.findFirst({
    where: facebookPageId ? { facebookPageId } : undefined,
  });

  const stylePrompt = styleProfile?.profile
    ? `Văn phong thương hiệu cần theo:\n${styleProfile.profile}\n\n`
    : "";

  const prompt = `${stylePrompt}Hãy kiểm tra bài viết spa sau:

"""
${text}
"""

Trả về JSON CHÍNH XÁC theo định dạng:
{
  "spelling_errors": ["lỗi 1", "lỗi 2"],
  "tone_match": "good" | "ok" | "off",
  "tone_notes": "ngắn gọn nếu tone_match != good"
}

spelling_errors: chỉ liệt kê lỗi chính tả/ngữ pháp tiếng Việt rõ ràng. Nếu không có → array rỗng.
tone_match: so với văn phong thương hiệu (nếu có).
Chỉ trả JSON, không thêm text.`;

  try {
    const raw = await generateContent(prompt, "Bạn là proofreader tiếng Việt. Trả JSON hợp lệ.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { spelling_errors?: string[]; tone_match?: string; tone_notes?: string };

    const issues: ReviewIssue[] = [];

    if (parsed.spelling_errors && parsed.spelling_errors.length > 0) {
      for (const err of parsed.spelling_errors.slice(0, 5)) {
        issues.push({
          type: "spelling",
          severity: "low",
          message: err,
        });
      }
    }

    if (parsed.tone_match === "off") {
      issues.push({
        type: "brand_tone",
        severity: "medium",
        message: parsed.tone_notes ?? "Tone không khớp văn phong thương hiệu",
        suggestion: "Tham khảo Style Training samples để điều chỉnh",
      });
    }

    return issues;
  } catch {
    return [];
  }
}

export async function reviewContent(post: {
  id: string;
  caption: string;
  hashtags?: string | null;
  platform?: string | null;
  facebookPageId?: string | null;
}): Promise<ReviewResult> {
  const text = `${post.caption}${post.hashtags ? `\n\n${post.hashtags}` : ""}`;
  const platform = post.platform ?? "facebook";

  // Sync checks
  const bannedIssues = checkBannedPhrases(text);
  const lengthIssues = checkLength(text, platform);
  const ctaIssues = checkCTA(text);

  // Async checks (Claude)
  const aiIssues = await checkSpellingAndTone(text, post.facebookPageId).catch(() => [] as ReviewIssue[]);

  const allIssues = [...bannedIssues, ...lengthIssues, ...ctaIssues, ...aiIssues];

  // Score
  let score = 100;
  for (const issue of allIssues) {
    if (issue.severity === "critical") score -= 40;
    else if (issue.severity === "high") score -= 20;
    else if (issue.severity === "medium") score -= 8;
    else score -= 3;
  }
  score = Math.max(0, score);

  // Status
  const hasCritical = allIssues.some((i) => i.severity === "critical");
  const hasHigh = allIssues.some((i) => i.severity === "high");
  let status: "pass" | "warn" | "fail";
  if (hasCritical) status = "fail";
  else if (hasHigh || score < 70) status = "warn";
  else status = "pass";

  const result: ReviewResult = {
    status,
    score,
    issues: allIssues,
    reviewedAt: new Date(),
  };

  // Persist
  await prisma.contentReview.upsert({
    where: { postId: post.id },
    create: {
      postId: post.id,
      status: result.status,
      score: result.score,
      issues: JSON.stringify(result.issues),
    },
    update: {
      status: result.status,
      score: result.score,
      issues: JSON.stringify(result.issues),
      reviewedAt: new Date(),
    },
  });

  return result;
}
