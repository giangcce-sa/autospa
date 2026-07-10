export type HumanWritingIssue = {
  code: string;
  message: string;
  phrase?: string;
  penalty: number;
};

export type HumanWritingScore = {
  score: number;
  dimensions: {
    naturalness: number;
    specificity: number;
    rhythm: number;
    restraint: number;
    brandVoice: number;
  };
  issues: HumanWritingIssue[];
};

const AI_PHRASES = [
  "bạn có đang",
  "bạn đã sẵn sàng",
  "không chỉ là",
  "hơn cả một",
  "giải pháp hoàn hảo",
  "lựa chọn hoàn hảo",
  "nâng tầm",
  "đánh thức vẻ đẹp",
  "vẻ đẹp rạng ngời",
  "tự tin tỏa sáng",
  "đừng bỏ lỡ",
  "inbox ngay",
  "liên hệ ngay hôm nay",
  "trải nghiệm tuyệt vời",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sentenceLengths(text: string) {
  return text
    .split(/[.!?…\n]+/)
    .map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length)
    .filter(Boolean);
}

export function scoreHumanWriting(text: string, hasVoiceProfile = false): HumanWritingScore {
  const normalized = text.toLowerCase();
  const issues: HumanWritingIssue[] = [];
  let naturalness = 100;
  let specificity = 100;
  let rhythm = 100;
  let restraint = 100;
  const brandVoice = hasVoiceProfile ? 90 : 65;

  for (const phrase of AI_PHRASES) {
    if (normalized.includes(phrase)) {
      issues.push({ code: "ai_phrase", phrase, message: `Cụm từ dễ tạo cảm giác văn AI: “${phrase}”`, penalty: 8 });
      naturalness -= 8;
    }
  }

  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emojiCount > 5) {
    issues.push({ code: "emoji_overuse", message: `Có ${emojiCount} emoji; nên giữ tối đa 3-5 emoji có chủ đích.`, penalty: 10 });
    restraint -= 10;
  }

  const exclamationCount = (text.match(/!/g) ?? []).length;
  if (exclamationCount > 3) {
    issues.push({ code: "exclamation_overuse", message: "Dấu chấm than xuất hiện quá đều, làm giọng viết thiếu tự nhiên.", penalty: 8 });
    restraint -= 8;
  }

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => /^[✅✔️🔹•\-👉]/u.test(line)).length;
  if (bulletLines >= 4) {
    issues.push({ code: "template_list", message: "Bài đang giống danh sách lợi ích theo khuôn quảng cáo.", penalty: 10 });
    naturalness -= 6;
    rhythm -= 4;
  }

  const lengths = sentenceLengths(text);
  if (lengths.length >= 4) {
    const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const variance = lengths.reduce((sum, value) => sum + (value - average) ** 2, 0) / lengths.length;
    if (variance < 8) {
      issues.push({ code: "flat_rhythm", message: "Độ dài các câu quá đều; cần xen câu ngắn với câu dài.", penalty: 10 });
      rhythm -= 10;
    }
  }

  const hasConcreteDetail = /\d|["“”]|phút|giờ|hôm qua|sáng nay|chiều nay|tuần trước|chị\s+[A-ZÀ-Ỹ]/u.test(text);
  if (!hasConcreteDetail) {
    issues.push({ code: "not_specific", message: "Thiếu chi tiết thật như thời điểm, lời khách, con số hoặc quan sát tại spa.", penalty: 16 });
    specificity -= 16;
  }

  if (/^(bạn có|bạn đã|chị em có)/iu.test(text.trim())) {
    issues.push({ code: "generic_opening", message: "Mở bài bằng câu hỏi phổ biến khiến nội dung giống mẫu AI.", penalty: 8 });
    naturalness -= 8;
  }

  if (text.length < 120) specificity -= 8;
  if (text.length > 2_000) restraint -= 8;
  if (!hasVoiceProfile) {
    issues.push({ code: "missing_voice_profile", message: "Chưa có Human Voice Profile đủ dữ liệu cho thương hiệu.", penalty: 8 });
  }

  const dimensions = {
    naturalness: clamp(naturalness),
    specificity: clamp(specificity),
    rhythm: clamp(rhythm),
    restraint: clamp(restraint),
    brandVoice: clamp(brandVoice),
  };
  const score = clamp(
    dimensions.naturalness * 0.3
    + dimensions.specificity * 0.25
    + dimensions.rhythm * 0.15
    + dimensions.restraint * 0.15
    + dimensions.brandVoice * 0.15,
  );
  return { score, dimensions, issues };
}

export function contentChangeRatio(original: string, final: string) {
  if (original === final) return 0;
  const originalWords = original.trim().split(/\s+/);
  const finalWords = final.trim().split(/\s+/);
  const originalCounts = new Map<string, number>();
  for (const word of originalWords) originalCounts.set(word, (originalCounts.get(word) ?? 0) + 1);
  let common = 0;
  for (const word of finalWords) {
    const count = originalCounts.get(word) ?? 0;
    if (count > 0) {
      common += 1;
      originalCounts.set(word, count - 1);
    }
  }
  return Math.min(1, 1 - (2 * common) / Math.max(1, originalWords.length + finalWords.length));
}

export function humanEditorPrompt(input: {
  draft: string;
  voiceRules?: string;
  issues?: HumanWritingIssue[];
}) {
  return `Biên tập lại bài dưới đây để nghe như một người Việt đang làm việc tại spa tự viết.

NGUYÊN TẮC:
- Giữ đúng sự thật và ý chính; không tự bịa trải nghiệm, tên khách hoặc kết quả.
- Loại câu mở đầu sáo rỗng, ngôn ngữ hoa mỹ chung chung và nhịp câu quá đều.
- Ưu tiên chi tiết cụ thể đã có trong bản nháp.
- Không biến bài thành danh sách lợi ích nếu không cần.
- CTA mềm và phù hợp ngữ cảnh; không mặc định dùng "Inbox ngay".
- Emoji có chủ đích, tối đa 3-5.
- Không giải thích quá trình biên tập.
${input.voiceRules ? `\nGIỌNG THƯƠNG HIỆU:\n${input.voiceRules}` : ""}
${input.issues?.length ? `\nCÁC LỖI CẦN SỬA:\n${input.issues.map((issue) => `- ${issue.message}`).join("\n")}` : ""}

BẢN NHÁP:
${input.draft}

Trả đúng định dạng:
CAPTION:
[bài đã biên tập]

HASHTAGS:
[tối đa 5 hashtag, mỗi hashtag một dòng]`;
}
