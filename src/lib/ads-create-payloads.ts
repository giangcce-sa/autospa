export const ADS_OBJECTIVE_CONTRACTS = {
  OUTCOME_AWARENESS: {
    optimizationGoal: "REACH",
    billingEvent: "IMPRESSIONS",
  },
} as const;

export type SupportedAdsObjective = keyof typeof ADS_OBJECTIVE_CONTRACTS;

export function buildCampaignPayload(name: string, objective: SupportedAdsObjective) {
  return {
    name,
    objective,
    status: "PAUSED",
    special_ad_categories: [] as string[],
  };
}

export function buildAdSetPayload(input: {
  name: string;
  campaignId: string;
  dailyBudgetVnd: number;
  targetCountry: "VN";
  targetAgeMin: number;
  targetAgeMax: number;
  targetGenders: Array<1 | 2>;
  objective: SupportedAdsObjective;
  startTime?: string;
  endTime?: string;
}) {
  const contract = ADS_OBJECTIVE_CONTRACTS[input.objective];
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: [input.targetCountry] },
    age_min: input.targetAgeMin,
    age_max: input.targetAgeMax,
  };
  if (input.targetGenders.length) targeting.genders = input.targetGenders;
  return {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: String(input.dailyBudgetVnd),
    billing_event: contract.billingEvent,
    optimization_goal: contract.optimizationGoal,
    targeting,
    status: "PAUSED",
    ...(input.startTime ? { start_time: input.startTime } : {}),
    ...(input.endTime ? { end_time: input.endTime } : {}),
  };
}

export function buildAdPayload(name: string, adSetId: string, creativeId: string) {
  return {
    name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  };
}
