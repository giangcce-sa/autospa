export type AdsPolicyInput = {
  ctrPercent: number;
  currentBudget?: number;
  pauseCtrPercent: number;
  scaleCtrPercent: number;
  scalePercent: number;
  maxDailyBudget: number;
  budgetIssue?: string;
  roas: number;
  minRoas: number;
};

export type AdsPolicyDecision =
  | { type: "pause"; reason: string }
  | { type: "scale"; nextBudget: number; reason: string }
  | { type: "skip"; reason: string }
  | { type: "none" };

export function evaluateAdsPolicy(input: AdsPolicyInput): AdsPolicyDecision {
  if (input.ctrPercent < input.pauseCtrPercent) {
    if (input.roas >= 1) return { type: "skip", reason: `Không pause vì ROAS ${input.roas.toFixed(2)}` };
    return { type: "pause", reason: `CTR dưới ngưỡng ${input.pauseCtrPercent}%` };
  }
  if (input.ctrPercent <= input.scaleCtrPercent) return { type: "none" };
  if (!input.currentBudget || input.currentBudget <= 0) {
    return { type: "skip", reason: input.budgetIssue ?? "Không xác định được ngân sách ngày" };
  }
  if (input.roas < input.minRoas) {
    return { type: "skip", reason: `ROAS ${input.roas.toFixed(2)} dưới ngưỡng ${input.minRoas}` };
  }
  if (input.currentBudget >= input.maxDailyBudget) {
    return { type: "skip", reason: `Đã đạt trần ${input.maxDailyBudget}đ/ngày` };
  }
  const proposed = Math.round(input.currentBudget * (1 + input.scalePercent / 100));
  const nextBudget = Math.min(proposed, input.maxDailyBudget);
  return nextBudget > input.currentBudget
    ? { type: "scale", nextBudget, reason: `CTR trên ngưỡng ${input.scaleCtrPercent}%` }
    : { type: "none" };
}
