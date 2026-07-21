import "server-only";

import { generateChatCompletion } from "@/lib/openai";
import { getVideoProviderConfig } from "./config";
import type { StoryboardResult, StoryboardSceneInput } from "./types";

function fallbackStoryboard(input: { name: string; brief: string; durationSec: number }): StoryboardResult {
  const durations = input.durationSec <= 20 ? [4, 6, 6, 4] : [4, 7, 7, 7, 5];
  const purposes = ["hook", "problem", "process", "proof", "cta"];
  const kinds: StoryboardSceneInput["kind"][] = ["talking", "broll", "broll", "talking", "cta"];
  const scenes = durations.map((durationSec, index) => ({
    title: index === 0 ? "Mở đầu" : index === durations.length - 1 ? "Kêu gọi đặt lịch" : `Cảnh ${index + 1}`,
    kind: kinds[index] || "broll",
    purpose: purposes[index] || "process",
    durationSec,
    script: index === 0
      ? `Bạn đang quan tâm đến ${input.name.toLowerCase()}? Đây là điều nên biết trước khi lựa chọn.`
      : index === durations.length - 1
        ? "Nhắn tin để được tư vấn tình trạng và lịch phù hợp."
        : input.brief,
    visualPrompt: `Video spa chân thực, ánh sáng tự nhiên, ${input.brief}, không khí chuyên nghiệp, hình ảnh sạch và đáng tin cậy`,
    cameraDirection: index % 2 === 0 ? "Cận cảnh ổn định, chuyển động máy nhẹ" : "Trung cảnh, thao tác thật, không nhìn thẳng máy",
  }));
  return {
    title: input.name,
    strategy: "Hook rõ ràng, quy trình thật, kết thúc bằng lời mời tư vấn nhẹ nhàng.",
    hook: scenes[0]?.script || input.name,
    caption: `${input.name}: quy trình được tư vấn theo tình trạng thực tế.`,
    hashtags: ["#chamsocda", "#spa", "#lamdepantoan"],
    scenes,
  };
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1);
  return JSON.parse(source) as StoryboardResult;
}

export async function generateStoryboard(input: {
  name: string;
  brief: string;
  objective: string;
  platform: string;
  aspectRatio: string;
  durationSec: number;
  serviceName?: string;
  skillContext?: string[];
}) {
  const config = await getVideoProviderConfig();
  if (config.mockMode) return fallbackStoryboard(input);
  const result = await generateChatCompletion(
    `Tạo storyboard video bằng tiếng Việt từ brief sau:\n${JSON.stringify(input)}\nTrả về JSON hợp lệ, tổng durationSec của scenes xấp xỉ ${input.durationSec}.`,
    `Bạn là đạo diễn nội dung cho spa Việt Nam. Nội dung phải tự nhiên, không hứa hẹn kết quả y khoa, không dùng lời quảng cáo cường điệu. JSON schema: {title,strategy,hook,caption,hashtags:string[],scenes:[{title,kind:"talking"|"broll"|"title"|"cta",purpose,durationSec,script,visualPrompt,cameraDirection}]}. Không trả thêm giải thích.`,
  );
  try {
    const parsed = extractJson(result);
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) throw new Error("Storyboard không có cảnh");
    return parsed;
  } catch {
    return fallbackStoryboard(input);
  }
}
