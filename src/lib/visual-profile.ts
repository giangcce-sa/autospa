import { prisma } from "./db";

const NEGATIVE_HINTS: Record<string, string[]> = {
  too_ai: ["avoid plastic skin", "avoid overly perfect faces", "use natural skin texture"],
  wrong_service: ["make the exact service and equipment visible", "avoid generic spa room"],
  off_brand: ["follow brand colors more subtly", "avoid unrelated color palettes"],
  bad_layout: ["reserve clean safe areas for overlay", "avoid cluttered composition"],
  unsafe: ["avoid medical claims", "avoid literal before-after comparison"],
};

function safeParseArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function topValues(values: string[], limit = 8) {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function inferPaletteFromPrompt(prompt: string) {
  const text = prompt.toLowerCase();
  if (text.includes("deep green") || text.includes("green accent")) return "soft neutrals with fresh green accent";
  if (text.includes("warm neutral") || text.includes("golden")) return "warm neutral luxury spa palette";
  if (text.includes("white") || text.includes("clinical")) return "clean white clinical spa palette";
  if (text.includes("wood") || text.includes("organic")) return "natural wood and plant palette";
  return "";
}

function inferSubjectFromPrompt(prompt: string) {
  const text = prompt.toLowerCase();
  if (text.includes("laser")) return "laser treatment room";
  if (text.includes("facial")) return "facial skincare setup";
  if (text.includes("massage")) return "massage treatment scene";
  if (text.includes("skincare products")) return "skincare product still life";
  if (text.includes("therapist hands")) return "therapist hands close-up";
  if (text.includes("customer")) return "customer experience scene";
  return "";
}

export async function getVisualProfile(facebookPageId?: string | null) {
  return prisma.visualProfile.findFirst({
    where: { facebookPageId: facebookPageId ?? null },
  });
}

export async function rebuildVisualProfile(facebookPageId?: string | null) {
  const feedback = await prisma.imageFeedback.findMany({
    where: {
      generation: { facebookPageId: facebookPageId ?? null },
    },
    include: { generation: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const approved = feedback.filter((item) => item.rating === "approved" || item.rating === "right_style");
  const rejected = feedback.filter((item) => item.rating !== "approved" && item.rating !== "right_style");
  if (approved.length + rejected.length === 0) return null;

  const preferredPresets = topValues(approved.map((item) => item.generation.preset));
  const preferredSubjects = topValues(approved.map((item) => inferSubjectFromPrompt(item.generation.finalPrompt)));
  const preferredPalettes = topValues(approved.map((item) => inferPaletteFromPrompt(item.generation.finalPrompt)));
  const avoidedElements = Array.from(new Set(rejected.flatMap((item) => NEGATIVE_HINTS[item.rating] ?? [item.rating.replace(/_/g, " ")]))).slice(0, 12);

  const rules = [
    preferredPresets.length ? `Prefer presets: ${preferredPresets.slice(0, 4).join(", ")}.` : "",
    preferredSubjects.length ? `Prefer subjects: ${preferredSubjects.slice(0, 5).join(", ")}.` : "",
    preferredPalettes.length ? `Prefer palettes: ${preferredPalettes.slice(0, 4).join(", ")}.` : "",
    avoidedElements.length ? `Avoid: ${avoidedElements.slice(0, 8).join(", ")}.` : "",
    "Keep generated image free of text; use overlay template for copy.",
  ].filter(Boolean).join(" ");

  const existing = await getVisualProfile(facebookPageId);
  const data = {
    promptRules: rules,
    preferredPalettes: JSON.stringify(preferredPalettes),
    preferredPresets: JSON.stringify(preferredPresets),
    preferredSubjects: JSON.stringify(preferredSubjects),
    avoidedElements: JSON.stringify(avoidedElements),
    approvedImages: approved.length,
    rejectedImages: rejected.length,
    confidence: Math.min((approved.length + rejected.length) / 12, 1),
    autoApply: existing?.autoApply ?? true,
  };

  return existing
    ? prisma.visualProfile.update({ where: { id: existing.id }, data })
    : prisma.visualProfile.create({ data: { facebookPageId: facebookPageId ?? null, ...data } });
}

export function parseVisualProfile(profile: Awaited<ReturnType<typeof getVisualProfile>>) {
  if (!profile) return null;
  return {
    promptRules: profile.promptRules,
    preferredPalettes: safeParseArray(profile.preferredPalettes),
    preferredPresets: safeParseArray(profile.preferredPresets),
    preferredSubjects: safeParseArray(profile.preferredSubjects),
    avoidedElements: safeParseArray(profile.avoidedElements),
    confidence: profile.confidence,
    autoApply: profile.autoApply,
  };
}
