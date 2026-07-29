import { z } from "zod";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const adCreativeRequestSchema = z.object({
  facebookPageId: boundedText(200),
  serviceId: boundedText(200).optional(),
  dailyBudget: z.number().int().min(20_000).max(2_000_000).optional(),
  objective: z.enum(["conversions", "engagement", "reach"]).default("conversions"),
  notes: boundedText(2_000).optional(),
}).strict();

export const generatedAdSpecSchema = z.object({
  captions: z.array(z.object({
    text: boundedText(2_000),
    hashtags: z.string().trim().max(500),
    tone: z.enum(["friendly", "professional", "luxury"]),
  }).strict()).min(1).max(3),
  audience: z.object({
    ageMin: z.number().int().min(18).max(65),
    ageMax: z.number().int().min(18).max(65),
    gender: z.enum(["all", "female", "male"]),
    locations: z.array(boundedText(100)).min(1).max(20),
    interests: z.array(boundedText(100)).min(1).max(30),
  }).strict().refine((value) => value.ageMin <= value.ageMax, {
    path: ["ageMax"],
    message: "Tuổi tối đa phải lớn hơn hoặc bằng tuổi tối thiểu",
  }),
  dailyBudget: z.number().int().min(20_000).max(2_000_000),
  durationDays: z.number().int().min(1).max(90),
  predictedCtr: z.number().finite().min(0).max(20),
  predictedRoas: z.number().finite().min(0).max(20),
}).strict();

export type AdCreativeRequest = z.infer<typeof adCreativeRequestSchema>;
export type GeneratedAdSpec = z.infer<typeof generatedAdSpecSchema>;
export type AdCreativeGenerationMode = "ai" | "deterministic_fallback";
export type AdCreativeEstimateSource = "historical" | "heuristic";

export function parseAdCreativeRequest(input: unknown): AdCreativeRequest {
  return adCreativeRequestSchema.parse(input);
}

export function parseGeneratedAdSpecText(input: string): GeneratedAdSpec | null {
  const match = input.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return generatedAdSpecSchema.parse(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

export function buildAdCreativeFallback(input: {
  serviceName?: string | null;
  dailyBudget?: number;
}): GeneratedAdSpec {
  return {
    captions: [{
      text: `${input.serviceName ?? "Dịch vụ spa"} cho làn da khỏe đẹp tự tin. Đặt lịch tư vấn để nhận ưu đãi phù hợp.`,
      hashtags: "#spa #lamdep #chamsocda",
      tone: "friendly",
    }],
    audience: {
      ageMin: 25,
      ageMax: 45,
      gender: "female",
      locations: ["TP.HCM"],
      interests: ["làm đẹp", "skincare", "spa"],
    },
    dailyBudget: input.dailyBudget ?? 200_000,
    durationDays: 7,
    predictedCtr: 1.5,
    predictedRoas: 1.8,
  };
}
