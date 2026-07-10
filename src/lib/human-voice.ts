import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";

export async function getHumanVoiceProfile(facebookPageId?: string | null) {
  return prisma.humanVoiceProfile.findFirst({
    where: { facebookPageId: facebookPageId ?? null },
  });
}

export async function rebuildHumanVoiceProfile(facebookPageId?: string | null) {
  const edits = await prisma.contentEdit.findMany({
    where: {
      acceptedVoice: true,
      generation: { facebookPageId: facebookPageId ?? null },
    },
    include: { generation: { select: { narrator: true, mode: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  if (edits.length < 3) return null;

  const examples = edits.map((edit, index) => [
    `Ví dụ ${index + 1} (${edit.generation.narrator}, ${edit.generation.mode})`,
    `AI: ${edit.originalContent.slice(0, 1_200)}`,
    `Người dùng sửa: ${edit.finalContent.slice(0, 1_200)}`,
  ].join("\n")).join("\n\n---\n\n");

  const raw = await generateContent(
    `Phân tích các cặp bản AI và bản người dùng đã sửa:\n\n${examples}\n\nTrả JSON:
{
  "rules": "5-10 quy tắc viết cụ thể, có thể áp dụng trực tiếp",
  "preferredWords": ["cụm từ/cách nói nên dùng"],
  "avoidedWords": ["cụm từ/cách nói người dùng thường xóa"]
}`,
    "Bạn là chuyên gia phân tích giọng viết tiếng Việt. Chỉ suy ra xu hướng lặp lại, không sao chép nội dung riêng tư. Trả JSON hợp lệ.",
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Không phân tích được Human Voice Profile");
  const parsed = JSON.parse(match[0]) as {
    rules?: string;
    preferredWords?: string[];
    avoidedWords?: string[];
  };
  if (!parsed.rules) throw new Error("Human Voice Profile thiếu quy tắc");

  const existing = await getHumanVoiceProfile(facebookPageId);
  const data = {
    rules: parsed.rules,
    preferredWords: JSON.stringify(parsed.preferredWords ?? []),
    avoidedWords: JSON.stringify(parsed.avoidedWords ?? []),
    approvedEdits: edits.length,
    confidence: Math.min(edits.length / 10, 1),
    autoApply: existing?.autoApply ?? false,
  };
  return existing
    ? prisma.humanVoiceProfile.update({ where: { id: existing.id }, data })
    : prisma.humanVoiceProfile.create({ data: { facebookPageId: facebookPageId ?? null, ...data } });
}
