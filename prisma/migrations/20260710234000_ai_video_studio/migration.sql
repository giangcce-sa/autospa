ALTER TABLE "Settings"
ADD COLUMN "runwayApiKey" TEXT,
ADD COLUMN "runwayBaseUrl" TEXT NOT NULL DEFAULT 'https://api.dev.runwayml.com',
ADD COLUMN "runwayVideoModel" TEXT NOT NULL DEFAULT 'gen4.5',
ADD COLUMN "elevenLabsApiKey" TEXT,
ADD COLUMN "elevenLabsBaseUrl" TEXT NOT NULL DEFAULT 'https://api.elevenlabs.io',
ADD COLUMN "elevenLabsVoiceModel" TEXT NOT NULL DEFAULT 'eleven_multilingual_v2',
ADD COLUMN "syncLabsApiKey" TEXT,
ADD COLUMN "syncLabsBaseUrl" TEXT NOT NULL DEFAULT 'https://api.sync.so',
ADD COLUMN "syncLabsModel" TEXT NOT NULL DEFAULT 'sync-3',
ADD COLUMN "videoMockMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "videoBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 25;

CREATE TABLE "VideoProject" (
  "id" TEXT NOT NULL, "facebookPageId" TEXT, "name" TEXT NOT NULL, "brief" TEXT NOT NULL,
  "objective" TEXT NOT NULL DEFAULT 'awareness', "platform" TEXT NOT NULL DEFAULT 'tiktok',
  "aspectRatio" TEXT NOT NULL DEFAULT '9:16', "language" TEXT NOT NULL DEFAULT 'vi', "durationSec" INTEGER NOT NULL DEFAULT 30,
  "serviceId" TEXT, "staffProfileId" TEXT, "voiceProfileId" TEXT, "templateId" TEXT,
  "styleSkillIds" TEXT NOT NULL DEFAULT '[]', "styleStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "status" TEXT NOT NULL DEFAULT 'draft', "approvalStatus" TEXT NOT NULL DEFAULT 'draft', "storyboard" TEXT NOT NULL DEFAULT '{}',
  "caption" TEXT, "hashtags" TEXT, "thumbnailUrl" TEXT, "outputUrl" TEXT, "outputStorageKey" TEXT,
  "qualityScore" INTEGER, "qualityReport" TEXT, "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0, "publishedPostId" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoScene" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "position" INTEGER NOT NULL, "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'broll', "purpose" TEXT, "durationSec" INTEGER NOT NULL DEFAULT 5,
  "script" TEXT NOT NULL DEFAULT '', "visualPrompt" TEXT NOT NULL DEFAULT '', "negativePrompt" TEXT, "cameraDirection" TEXT,
  "staffProfileId" TEXT, "voiceProfileId" TEXT, "sourceImageUrl" TEXT, "sourceVideoUrl" TEXT,
  "generatedVideoUrl" TEXT, "audioUrl" TEXT, "lipSyncVideoUrl" TEXT, "subtitleData" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'draft', "locked" BOOLEAN NOT NULL DEFAULT false, "provider" TEXT, "providerTaskId" TEXT,
  "qaScore" INTEGER, "qaReport" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoAsset" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sceneId" TEXT, "type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'upload', "name" TEXT NOT NULL, "url" TEXT NOT NULL, "storageKey" TEXT,
  "mimeType" TEXT, "sizeBytes" INTEGER, "metadata" TEXT NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoJob" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sceneId" TEXT, "type" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "externalId" TEXT, "status" TEXT NOT NULL DEFAULT 'queued', "progress" INTEGER NOT NULL DEFAULT 0,
  "attempt" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3, "input" TEXT NOT NULL DEFAULT '{}',
  "output" TEXT, "error" TEXT, "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0, "actualCostUsd" DOUBLE PRECISION,
  "nextPollAt" TIMESTAMP(3), "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoVoiceProfile" (
  "id" TEXT NOT NULL, "facebookPageId" TEXT, "staffProfileId" TEXT, "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'elevenlabs', "providerVoiceId" TEXT, "description" TEXT, "language" TEXT NOT NULL DEFAULT 'vi',
  "sampleUrl" TEXT, "sampleStorageKey" TEXT, "settings" TEXT NOT NULL DEFAULT '{}', "pronunciation" TEXT NOT NULL DEFAULT '{}',
  "consentId" TEXT, "status" TEXT NOT NULL DEFAULT 'draft', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoVoiceProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoConsent" (
  "id" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "subjectName" TEXT NOT NULL,
  "scopes" TEXT NOT NULL DEFAULT '[]', "status" TEXT NOT NULL DEFAULT 'pending', "evidenceUrl" TEXT, "storageKey" TEXT,
  "grantedBy" TEXT, "grantedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoSkill" (
  "id" TEXT NOT NULL, "facebookPageId" TEXT, "brainSkillId" TEXT, "sourceProjectId" TEXT, "sourceAssetId" TEXT,
  "name" TEXT NOT NULL, "group" TEXT NOT NULL, "description" TEXT NOT NULL, "rules" TEXT NOT NULL DEFAULT '[]',
  "evidence" TEXT NOT NULL DEFAULT '[]', "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5, "status" TEXT NOT NULL DEFAULT 'pending',
  "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoTemplate" (
  "id" TEXT NOT NULL, "facebookPageId" TEXT, "name" TEXT NOT NULL, "description" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'tiktok', "aspectRatio" TEXT NOT NULL DEFAULT '9:16', "durationSec" INTEGER NOT NULL DEFAULT 30,
  "structure" TEXT NOT NULL DEFAULT '{}', "thumbnailUrl" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoVersion" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "version" INTEGER NOT NULL, "label" TEXT,
  "snapshot" TEXT NOT NULL, "outputUrl" TEXT, "storageKey" TEXT, "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "VideoVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoPerformance" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "platform" TEXT NOT NULL, "externalPostId" TEXT,
  "views" INTEGER NOT NULL DEFAULT 0, "impressions" INTEGER NOT NULL DEFAULT 0, "watchTimeSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "clicks" INTEGER NOT NULL DEFAULT 0, "leads" INTEGER NOT NULL DEFAULT 0,
  "bookings" INTEGER NOT NULL DEFAULT 0, "spend" DOUBLE PRECISION NOT NULL DEFAULT 0, "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "VideoPerformance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoProject_facebookPageId_createdAt_idx" ON "VideoProject"("facebookPageId", "createdAt");
CREATE INDEX "VideoProject_status_updatedAt_idx" ON "VideoProject"("status", "updatedAt");
CREATE INDEX "VideoProject_approvalStatus_updatedAt_idx" ON "VideoProject"("approvalStatus", "updatedAt");
CREATE UNIQUE INDEX "VideoScene_projectId_position_key" ON "VideoScene"("projectId", "position");
CREATE INDEX "VideoScene_projectId_status_idx" ON "VideoScene"("projectId", "status");
CREATE INDEX "VideoAsset_projectId_type_idx" ON "VideoAsset"("projectId", "type");
CREATE INDEX "VideoAsset_sceneId_type_idx" ON "VideoAsset"("sceneId", "type");
CREATE INDEX "VideoJob_status_nextPollAt_idx" ON "VideoJob"("status", "nextPollAt");
CREATE INDEX "VideoJob_projectId_createdAt_idx" ON "VideoJob"("projectId", "createdAt");
CREATE INDEX "VideoJob_externalId_provider_idx" ON "VideoJob"("externalId", "provider");
CREATE INDEX "VideoVoiceProfile_facebookPageId_isActive_idx" ON "VideoVoiceProfile"("facebookPageId", "isActive");
CREATE INDEX "VideoVoiceProfile_staffProfileId_status_idx" ON "VideoVoiceProfile"("staffProfileId", "status");
CREATE INDEX "VideoConsent_subjectType_subjectId_status_idx" ON "VideoConsent"("subjectType", "subjectId", "status");
CREATE INDEX "VideoSkill_facebookPageId_group_status_idx" ON "VideoSkill"("facebookPageId", "group", "status");
CREATE INDEX "VideoSkill_sourceProjectId_status_idx" ON "VideoSkill"("sourceProjectId", "status");
CREATE INDEX "VideoTemplate_facebookPageId_isActive_idx" ON "VideoTemplate"("facebookPageId", "isActive");
CREATE UNIQUE INDEX "VideoVersion_projectId_version_key" ON "VideoVersion"("projectId", "version");
CREATE INDEX "VideoPerformance_projectId_capturedAt_idx" ON "VideoPerformance"("projectId", "capturedAt");
CREATE INDEX "VideoPerformance_platform_capturedAt_idx" ON "VideoPerformance"("platform", "capturedAt");

ALTER TABLE "VideoScene" ADD CONSTRAINT "VideoScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "VideoScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "VideoScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoVersion" ADD CONSTRAINT "VideoVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoPerformance" ADD CONSTRAINT "VideoPerformance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
