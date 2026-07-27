/**
 * Vietnamese display labels for creative-domain enum-ish strings.
 * Pure module (no prisma, no server-only) so every studio surface — client or
 * server — reads the same vocabulary and the labels cannot drift apart.
 */

/**
 * Several vocabularies reach these columns and all of them are already stored:
 * the composer writes `promo`/`story`, the AI research prompt in
 * content-research.ts asks the model for `promotion`/`behind_scenes`, and older
 * rows carry `education`/`behind-scenes`. Every spelling is mapped rather than
 * normalised on read, so a row is shown as it actually is; `label()` falling back
 * to the raw key is what surfaced these variants in the first place.
 */
export const POST_TYPE_LABELS: Record<string, string> = {
  service: "Dịch vụ",
  promo: "Ưu đãi",
  promotion: "Ưu đãi",
  educational: "Kiến thức",
  education: "Kiến thức",
  story: "Câu chuyện",
  behind_scenes: "Hậu trường",
  "behind-scenes": "Hậu trường",
  testimonial: "Cảm nhận",
  event: "Sự kiện",
  seasonal: "Theo dịp",
  video: "Video",
};

/** Same split as POST_TYPE_LABELS: `luxury`/`playful` from the composer, `emotional`/`humorous` from research. */
export const TONE_LABELS: Record<string, string> = {
  friendly: "Thân thiện",
  professional: "Chuyên nghiệp",
  luxury: "Sang trọng",
  playful: "Trẻ trung",
  emotional: "Cảm xúc",
  humorous: "Vui vẻ",
};

export const POST_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  scheduled: "Đã lên lịch",
  published: "Đã đăng",
  failed: "Lỗi",
};

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  zalo: "Zalo",
  multi: "Nhiều kênh",
};

export const SIGNAL_SOURCE_LABELS: Record<string, string> = {
  google_trends: "Google Trends",
  fb_ads_library: "Facebook Ads Library",
  fb_competitor: "Đối thủ Facebook",
  manual: "Nhập thủ công",
};

export const IMAGE_PRESET_LABELS: Record<string, string> = {
  organic: "Bài thường",
  ads: "Quảng cáo",
  story: "Story",
  flash_deal: "Flash deal",
  testimonial: "Cảm nhận khách",
  educational: "Kiến thức",
  service_hero: "Ảnh dịch vụ",
  before_after_concept: "Before/After (concept)",
};

export const IMAGE_FORMAT_LABELS: Record<string, string> = {
  feed: "Feed",
  square: "Vuông",
  story: "Story",
  landscape: "Ngang",
  portrait: "Dọc",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pass: "Đạt",
  warn: "Cần xem",
  fail: "Bị chặn",
};

export const VIDEO_STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  rendering: "Đang render",
  rendered: "Đã render",
  published: "Đã đăng",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "Chờ",
  running: "Đang chạy",
  completed: "Hoàn thành",
  failed: "Lỗi",
};

export const CONSENT_STATUS_LABELS: Record<string, string> = {
  consented: "Đã đồng ý",
  granted: "Đã đồng ý",
  pending: "Chờ xác nhận",
  revoked: "Đã thu hồi",
};

/** Falls back to the raw key so an unmapped value is visible, never blank. */
export function label(map: Record<string, string>, key: string) {
  return map[key] ?? key;
}
