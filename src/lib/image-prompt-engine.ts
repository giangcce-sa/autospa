export type VisualImageFormat = "feed" | "cover" | "story" | "thumbnail" | "zalo";

export type ImagePreset =
  | "organic"
  | "ads"
  | "story"
  | "flash_deal"
  | "testimonial"
  | "educational"
  | "service_hero"
  | "before_after_concept";

export interface VisualBrandContext {
  spaName?: string | null;
  tagline?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontStyle?: string | null;
}

export interface VisualProfileContext {
  promptRules?: string | null;
  preferredPalettes?: string[];
  preferredPresets?: string[];
  preferredSubjects?: string[];
  avoidedElements?: string[];
  confidence?: number;
  autoApply?: boolean;
}

export interface StaffVisualContext {
  name: string;
  role?: string | null;
  gender?: string | null;
  promptDescriptor: string;
  appearanceNotes?: string | null;
  uniformNotes?: string | null;
  usageNotes?: string | null;
  referenceImageUrl?: string | null;
  sampleCount?: number;
}

export interface ImagePromptInput {
  caption?: string | null;
  visualBrief?: string | null;
  serviceName?: string | null;
  serviceDescription?: string | null;
  postType?: string | null;
  tone?: string | null;
  preset?: ImagePreset | string | null;
  style?: string | null;
  character?: string | null;
  equipment?: string | null;
  referenceDesc?: string | null;
  format?: VisualImageFormat | string | null;
  brand?: VisualBrandContext | null;
  visualProfile?: VisualProfileContext | null;
  staffVisual?: StaffVisualContext | null;
  competitorInsight?: string | null;
}

export interface ImagePromptResult {
  preset: ImagePreset;
  format: VisualImageFormat;
  prompt: string;
  negativePrompt: string;
  finalPrompt: string;
  suggestedOverlay: {
    headline: string;
    subheadline: string;
    cta: string;
    badge: string;
  };
}

export interface ImagePromptQuality {
  score: number;
  issues: Array<{ type: string; message: string }>;
  dimensions: {
    specificity: number;
    brandFit: number;
    platformFit: number;
    realism: number;
    policySafety: number;
  };
}

const PRESET_RULES: Record<ImagePreset, string> = {
  organic: "natural social feed image, believable spa moment, editorial but not overproduced",
  ads: "performance ad visual, clear hero subject, strong contrast, generous empty area for copy overlay",
  story: "mobile-first story composition, vertical flow, clear subject in upper two thirds, quiet lower safe area",
  flash_deal: "promotional visual with clean product/service scene, high clarity, room for offer badge overlay",
  testimonial: "warm customer experience scene, adult Vietnamese customer, authentic expression, no exaggerated result claims",
  educational: "clean educational skincare visual, treatment tools or product details arranged clearly, calm clinical spa feel",
  service_hero: "premium service hero image, one main subject, polished commercial photography, exact service context",
  before_after_concept: "conceptual improvement journey visual, consultation or skincare routine scene, no literal before-after skin comparison",
};

const STYLE_RULES: Record<string, string> = {
  bright: "bright modern spa, soft daylight, clean white and pale green palette, airy professional feel",
  luxury: "quiet luxury spa, soft directional light, refined materials, deep green and warm neutral accents, premium but restrained",
  natural: "organic wellness spa, natural textures, plants, wood, soft diffused light, calm grounded atmosphere",
  clinical: "clean dermatologist-inspired spa room, precise equipment, hygienic surfaces, trustworthy and modern",
  editorial: "editorial beauty photography, controlled composition, realistic skin texture, tasteful color contrast",
};

const CHARACTER_RULES: Record<string, string> = {
  "female-vn": "adult Vietnamese woman as customer, natural realistic skin texture, relaxed confident expression",
  "male-vn": "adult Vietnamese man as customer, clean well-groomed appearance, natural expression",
  "staff-female": "professional adult female spa therapist in uniform, attentive and skilled, respectful distance",
  hands: "close-up of therapist hands performing a non-invasive spa treatment, precise and natural hand anatomy",
  none: "no visible face, focus on environment, tools, treatment setup or product still life",
};

const EQUIPMENT_RULES: Record<string, string> = {
  laser: "professional laser hair removal equipment in a clean treatment room, non-invasive presentation",
  "spa-bed": "premium spa treatment bed with clean linens and subtle brand color accents",
  "facial-machine": "modern facial care machine and skincare tools, clean and credible",
  "nail-tools": "professional nail care tools arranged neatly, elegant manicure setup",
  "massage-tools": "hot stones, towels and aromatic oils arranged naturally",
  "skincare-products": "premium skincare products and serum textures arranged with soft reflections",
};

const FORMAT_RULES: Record<VisualImageFormat, string> = {
  feed: "square 1:1 composition, centered subject, safe margins on all sides",
  cover: "wide landscape composition, subject off-center, clear negative space on one side for headline overlay",
  story: "vertical 9:16 mobile composition, subject upper or middle, lower 30 percent clean for text overlay",
  thumbnail: "wide thumbnail composition, large readable subject, high visual contrast, no tiny details",
  zalo: "square composition with generous top and bottom safe areas for Zalo caption overlay",
};

const BAD_AI_MARKERS = [
  "perfect skin",
  "flawless skin",
  "young forever",
  "dramatic transformation",
  "before and after",
  "text overlay",
  "words on image",
];

function normalizePreset(value?: string | null): ImagePreset {
  return value === "ads" ||
    value === "story" ||
    value === "flash_deal" ||
    value === "testimonial" ||
    value === "educational" ||
    value === "service_hero" ||
    value === "before_after_concept"
    ? value
    : "organic";
}

function normalizeFormat(value?: string | null): VisualImageFormat {
  return value === "cover" || value === "story" || value === "thumbnail" || value === "zalo" ? value : "feed";
}

function compactText(text?: string | null, limit = 420) {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function inferServiceFromText(text: string) {
  if (/(triệt lông|laser|diode|ipl|bikini)/i.test(text)) return "laser hair removal";
  if (/(mụn|thâm|nám|sắc tố|điều trị da)/i.test(text)) return "skin treatment";
  if (/(trẻ hoá|trẻ hóa|nâng cơ|hifu|căng bóng)/i.test(text)) return "facial rejuvenation";
  if (/(gội đầu|dưỡng sinh)/i.test(text)) return "head spa wellness";
  if (/(massage|body|đá nóng)/i.test(text)) return "body massage";
  if (/(facial|chăm sóc da|da mặt|skincare)/i.test(text)) return "facial skincare";
  return "";
}

function inferHeadline(input: ImagePromptInput) {
  const service = compactText(input.serviceName, 44);
  if (service) return service;
  const inferred = inferServiceFromText(`${input.caption ?? ""} ${input.visualBrief ?? ""}`);
  if (inferred) return inferred.replace(/\b\w/g, (c) => c.toUpperCase());
  return "Cham soc spa";
}

function paletteText(brand?: VisualBrandContext | null, visualProfile?: VisualProfileContext | null) {
  const profilePalette = visualProfile?.autoApply !== false ? visualProfile?.preferredPalettes?.slice(0, 2).join(", ") : "";
  const brandColors = [brand?.primaryColor, brand?.accentColor].filter(Boolean).join(" and ");
  if (profilePalette && brandColors) return `${profilePalette}, subtly aligned with brand colors ${brandColors}`;
  if (profilePalette) return profilePalette;
  if (brandColors) return `subtle accents inspired by brand colors ${brandColors}`;
  return "clean spa palette with soft neutrals and one fresh green accent";
}

export function buildImagePrompt(input: ImagePromptInput): ImagePromptResult {
  const preset = normalizePreset(input.preset);
  const format = normalizeFormat(input.format);
  const caption = compactText(input.caption, 650);
  const visualBrief = compactText(input.visualBrief, 500);
  const serviceName = compactText(input.serviceName, 120);
  const inferredService = serviceName || inferServiceFromText(`${caption} ${visualBrief}`);
  const character = input.character || (preset === "testimonial" ? "female-vn" : input.character);
  const style = input.style || "bright";
  const profile = input.visualProfile?.autoApply === false ? null : input.visualProfile;
  const staff = input.staffVisual;

  const subject = [
    inferredService
      ? `Main subject: ${inferredService} spa service for Vietnamese market`
      : "Main subject: premium Vietnamese spa service visual",
    input.serviceDescription ? `Service context: ${compactText(input.serviceDescription, 180)}` : "",
    staff
      ? `Use staff visual reference: ${staff.promptDescriptor}. Role: ${staff.role ?? "spa therapist"}. ${staff.appearanceNotes ? `Appearance notes: ${staff.appearanceNotes}.` : ""} ${staff.uniformNotes ? `Uniform: ${staff.uniformNotes}.` : ""} Keep the person consistent with the approved staff sample while generating a natural marketing photo.`
      : CHARACTER_RULES[character || ""] || CHARACTER_RULES.none,
    EQUIPMENT_RULES[input.equipment || ""] || "",
  ].filter(Boolean).join(". ");

  const concept = [
    `Creative preset: ${PRESET_RULES[preset]}`,
    visualBrief ? `User visual brief: ${visualBrief}` : "",
    caption ? `Post context to match visually, do not render text: ${caption}` : "",
    input.competitorInsight ? `Market radar to differentiate from, do not copy competitor creatives: ${compactText(input.competitorInsight, 260)}` : "",
  ].filter(Boolean).join(". ");

  const scene = [
    STYLE_RULES[style] ?? STYLE_RULES.bright,
    `Composition: ${FORMAT_RULES[format]}`,
    `Palette: ${paletteText(input.brand, profile)}`,
    input.brand?.spaName ? `Brand feel: ${input.brand.spaName}${input.brand.tagline ? `, ${input.brand.tagline}` : ""}` : "",
    input.referenceDesc ? `Reference direction: ${compactText(input.referenceDesc, 220)}` : "",
    staff?.referenceImageUrl ? `Approved staff reference images are attached separately (${staff.sampleCount ?? 1} sample${(staff.sampleCount ?? 1) > 1 ? "s" : ""}); preserve identity according to the selected reference mode` : "",
    staff?.usageNotes ? `Staff usage rule: ${compactText(staff.usageNotes, 260)}` : "",
    profile?.promptRules ? `Learned visual preference: ${compactText(profile.promptRules, 360)}` : "",
  ].filter(Boolean).join(". ");

  const realism = [
    "Realistic commercial photography, not illustration, not 3D render",
    "natural human anatomy, realistic hands, realistic Vietnamese spa environment",
    "skin texture should be healthy and believable, not plastic or over-retouched",
    "no AI-generated text, no watermark, no fake logo, no readable words inside the generated image",
  ].join(". ");

  const negativeParts = [
    "deformed hands",
    "extra fingers",
    "distorted face",
    "plastic skin",
    "over-smoothed skin",
    "medical needles",
    "surgery",
    "blood",
    "literal before-after comparison",
    "unrealistic body claims",
    "text artifacts",
    "watermark",
    "fake brand logo",
    staff ? "do not change staff age drastically" : "",
    staff ? "do not sexualize staff" : "",
    ...(profile?.avoidedElements ?? []),
  ];

  const prompt = [subject, concept, scene, realism].filter(Boolean).join("\n\n");
  const negativePrompt = Array.from(new Set(negativeParts.map((item) => item.trim()).filter(Boolean))).join(", ");
  const finalPrompt = `${prompt}\n\nAvoid: ${negativePrompt}.`;

  return {
    preset,
    format,
    prompt,
    negativePrompt,
    finalPrompt,
    suggestedOverlay: {
      headline: inferHeadline(input),
      subheadline: preset === "flash_deal" ? "Uu dai trong ngay" : input.brand?.tagline ?? "",
      cta: preset === "ads" || preset === "flash_deal" ? "Dat lich" : "",
      badge: preset === "flash_deal" ? "Uu dai" : "",
    },
  };
}

export function scoreImagePrompt(result: ImagePromptResult, input: ImagePromptInput): ImagePromptQuality {
  const issues: ImagePromptQuality["issues"] = [];
  const text = result.finalPrompt.toLowerCase();
  let specificity = 100;
  let brandFit = 100;
  let platformFit = 100;
  let realism = 100;
  let policySafety = 100;

  if (!input.serviceName && !input.visualBrief && !input.caption) {
    specificity -= 28;
    issues.push({ type: "generic_brief", message: "Prompt lacks service, caption or user brief context." });
  }
  if (!input.serviceName && !inferServiceFromText(`${input.caption ?? ""} ${input.visualBrief ?? ""}`)) {
    specificity -= 12;
    issues.push({ type: "unclear_service", message: "Service is not explicit, image may look generic." });
  }
  if (!input.brand?.spaName && !input.brand?.primaryColor && !input.visualProfile?.promptRules) {
    brandFit -= 18;
    issues.push({ type: "weak_brand", message: "No brand kit or visual profile was available." });
  }
  if (!FORMAT_RULES[result.format]) {
    platformFit -= 20;
    issues.push({ type: "missing_format", message: "Image format constraints are missing." });
  }
  if (!result.negativePrompt) {
    realism -= 20;
    policySafety -= 12;
    issues.push({ type: "missing_negative_prompt", message: "Negative prompt is missing." });
  }
  for (const marker of BAD_AI_MARKERS) {
    if (text.includes(marker)) {
      realism -= 8;
      policySafety -= marker.includes("before") ? 10 : 0;
      issues.push({ type: "risky_phrase", message: `Prompt contains risky/generic image phrase: ${marker}` });
    }
  }
  if (text.length < 500) {
    specificity -= 12;
    issues.push({ type: "short_prompt", message: "Prompt is short; image model may improvise too much." });
  }
  if (result.preset === "before_after_concept" && !text.includes("no literal before-after")) {
    policySafety -= 18;
    issues.push({ type: "before_after_risk", message: "Before/after concept must avoid literal result comparison." });
  }

  const dimensions = {
    specificity: Math.max(0, specificity),
    brandFit: Math.max(0, brandFit),
    platformFit: Math.max(0, platformFit),
    realism: Math.max(0, realism),
    policySafety: Math.max(0, policySafety),
  };
  const score = Math.round(
    dimensions.specificity * 0.28 +
    dimensions.brandFit * 0.18 +
    dimensions.platformFit * 0.18 +
    dimensions.realism * 0.2 +
    dimensions.policySafety * 0.16,
  );

  return { score, issues, dimensions };
}
