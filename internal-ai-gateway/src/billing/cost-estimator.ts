import type { ProviderName } from "../config/models.js";

const perMillionTokenRatesUsd: Record<string, { input: number; output: number }> = {
  cheap: { input: 0.25, output: 1.0 },
  balanced: { input: 1.5, output: 6.0 },
  strong: { input: 5.0, output: 20.0 }
};

function tierForModel(provider: ProviderName | undefined, model: string | undefined, upstreamModel?: string | null): keyof typeof perMillionTokenRatesUsd {
  const target = `${provider ?? ""} ${model ?? ""} ${upstreamModel ?? ""}`.toLowerCase();
  if (/haiku|mini|flash|cheap|lite|turbo/.test(target)) return "cheap";
  if (/opus|sonnet|gpt-5|gpt-4|coder|pro|plus|max/.test(target)) return "strong";
  return "balanced";
}

export function estimateTokenCostUsd(input: {
  provider?: ProviderName;
  model?: string;
  upstreamModel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  if (input.inputTokens == null && input.outputTokens == null) return null;

  const tier = tierForModel(input.provider, input.model, input.upstreamModel);
  const rates = perMillionTokenRatesUsd[tier];
  const cost =
    ((input.inputTokens ?? 0) / 1_000_000) * rates.input + ((input.outputTokens ?? 0) / 1_000_000) * rates.output;

  return Number(cost.toFixed(8));
}

export function estimateMediaCostUsd(input: {
  taskType: "image-generation" | "image-edit" | "vision" | "embedding" | "speech-to-text" | "text-to-speech";
  units?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  if (input.taskType === "vision" || input.taskType === "embedding") {
    return estimateTokenCostUsd({
      provider: "9router",
      model: input.taskType,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens
    });
  }

  const unitCount = Math.max(input.units ?? 1, 1);
  const flatRatesUsd: Record<"image-generation" | "image-edit" | "speech-to-text" | "text-to-speech", number> = {
    "image-generation": 0.02,
    "image-edit": 0.025,
    "speech-to-text": 0.006,
    "text-to-speech": 0.015
  };

  return Number((flatRatesUsd[input.taskType] * unitCount).toFixed(8));
}
