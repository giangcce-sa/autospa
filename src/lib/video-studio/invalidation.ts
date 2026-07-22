export interface SceneInvalidation {
  clearVideo: boolean;
  clearAudio: boolean;
  clearLipSync: boolean;
  invalidatesProject: boolean;
}

const VIDEO_FIELDS = new Set(["kind", "durationSec", "visualPrompt", "negativePrompt", "cameraDirection", "staffProfileId", "sourceImageUrl", "sourceVideoUrl"]);
const AUDIO_FIELDS = new Set(["kind", "durationSec", "script", "voiceProfileId"]);

export function sceneInvalidationFor(fields: string[]): SceneInvalidation {
  const clearVideo = fields.some((field) => VIDEO_FIELDS.has(field));
  const clearAudio = fields.some((field) => AUDIO_FIELDS.has(field));
  return {
    clearVideo,
    clearAudio,
    clearLipSync: clearVideo || clearAudio,
    invalidatesProject: clearVideo || clearAudio,
  };
}

export const PROJECT_RENDER_FIELDS = new Set([
  "brief", "objective", "platform", "aspectRatio", "durationSec", "serviceId", "staffProfileId",
  "voiceProfileId", "styleSkillIds", "styleStrength", "caption", "hashtags",
]);

export function invalidatedProjectRenderData() {
  return {
    inputRevision: { increment: 1 },
    outputUrl: null,
    outputStorageKey: null,
    thumbnailUrl: null,
    renderedRevision: null,
    qualityScore: null,
    qualityReport: null,
    approvalStatus: "draft",
    approvedRevision: null,
    approvedAt: null,
    approvedBy: null,
    status: "storyboard",
  } as const;
}
