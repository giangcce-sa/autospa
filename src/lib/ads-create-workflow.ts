export type AdsCreateState = {
  campaignId?: string | null;
  adSetId?: string | null;
  imageHash?: string | null;
  creativeId?: string | null;
  adId?: string | null;
};

export type AdsCreateResult = {
  campaignId: string;
  adSetId: string;
  imageHash?: string;
  creativeId: string;
  adId: string;
};

type CheckpointField = keyof AdsCreateState;

export async function runAdsCreateWorkflow(input: {
  state: AdsCreateState;
  requiresImage: boolean;
  createCampaign: () => Promise<string>;
  createAdSet: (campaignId: string) => Promise<string>;
  uploadImage: () => Promise<string>;
  createCreative: (imageHash?: string) => Promise<string>;
  createAd: (adSetId: string, creativeId: string) => Promise<string>;
  checkpoint: (field: CheckpointField, value: string, nextStep: string) => Promise<void>;
}): Promise<AdsCreateResult> {
  const state = { ...input.state };

  if (!state.campaignId) {
    state.campaignId = await input.createCampaign();
    await input.checkpoint("campaignId", state.campaignId, "adset");
  }

  if (!state.adSetId) {
    state.adSetId = await input.createAdSet(state.campaignId);
    await input.checkpoint("adSetId", state.adSetId, input.requiresImage ? "image" : "creative");
  }

  if (input.requiresImage && !state.imageHash) {
    state.imageHash = await input.uploadImage();
    await input.checkpoint("imageHash", state.imageHash, "creative");
  }

  if (!state.creativeId) {
    state.creativeId = await input.createCreative(state.imageHash ?? undefined);
    await input.checkpoint("creativeId", state.creativeId, "ad");
  }

  if (!state.adId) {
    state.adId = await input.createAd(state.adSetId, state.creativeId);
    await input.checkpoint("adId", state.adId, "complete");
  }

  return {
    campaignId: state.campaignId,
    adSetId: state.adSetId,
    imageHash: state.imageHash ?? undefined,
    creativeId: state.creativeId,
    adId: state.adId,
  };
}
