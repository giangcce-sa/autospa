import { z } from "zod";

export const BULK_TONES = ["friendly", "professional", "luxury"] as const;
export const BULK_POST_TYPES = ["service", "tip", "promotion"] as const;

export const bulkPlanInputSchema = z.object({
  facebookPageId: z.string().trim().min(1, "Hãy chọn Facebook Page"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  postsPerWeek: z.coerce.number().int().min(1).max(7).default(3),
  tone: z.enum(BULK_TONES).default("friendly"),
  postTypes: z.array(z.enum(BULK_POST_TYPES)).min(1).max(3).default(["service", "tip", "promotion"]),
});

export const bulkDeleteInputSchema = z.object({
  id: z.string().trim().min(1, "Thiếu kế hoạch cần xóa"),
});

const generatedPostSchema = z.object({
  day: z.coerce.number().int().min(1),
  postType: z.enum(["service", "tip", "promotion"]).default("service"),
  caption: z.string().trim().min(1).max(10_000),
  hashtags: z.string().trim().max(2_000).default(""),
});

export type BulkPlanInput = z.infer<typeof bulkPlanInputSchema>;
export type GeneratedBulkPost = z.infer<typeof generatedPostSchema>;

export function bulkPlanPostCount(year: number, month: number, postsPerWeek: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(1, Math.min(31, Math.round((daysInMonth / 7) * postsPerWeek)));
}

export function parseGeneratedBulkPosts(raw: string, input: BulkPlanInput): GeneratedBulkPost[] {
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) throw new RangeError("AI không trả về danh sách bài viết hợp lệ");

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new RangeError("AI trả về JSON không hợp lệ");
  }

  const maxDay = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
  const expected = bulkPlanPostCount(input.year, input.month, input.postsPerWeek);
  const result = z.array(generatedPostSchema).min(expected).max(expected).safeParse(parsed);
  if (!result.success) throw new RangeError("Kế hoạch AI có cấu trúc không hợp lệ");
  if (result.data.some((post) => post.day > maxDay)) throw new RangeError("Kế hoạch AI chứa ngày ngoài tháng đã chọn");

  return result.data;
}
