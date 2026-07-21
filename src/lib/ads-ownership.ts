export function normalizeMetaAdAccountId(value: string) {
  return value.replace(/^act_/, "");
}

export function campaignBelongsToAdAccount(
  campaign: { id?: string; account_id?: string },
  adAccountId: string,
) {
  return Boolean(
    campaign.id
    && normalizeMetaAdAccountId(campaign.account_id ?? "") === normalizeMetaAdAccountId(adAccountId),
  );
}

export function budgetTargetBelongsToCampaign(input: {
  campaignId: string;
  targetId: string;
  targetType: "campaign" | "adset";
  adSet?: { id?: string; account_id?: string; campaign_id?: string };
  adAccountId: string;
}) {
  if (input.targetType === "campaign") return input.targetId === input.campaignId;
  return Boolean(
    input.adSet?.id
    && input.adSet.campaign_id === input.campaignId
    && normalizeMetaAdAccountId(input.adSet.account_id ?? "") === normalizeMetaAdAccountId(input.adAccountId),
  );
}
