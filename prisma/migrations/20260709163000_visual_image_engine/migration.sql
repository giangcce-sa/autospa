CREATE TABLE "VisualProfile" (
  "id" TEXT NOT NULL,
  "facebookPageId" TEXT,
  "promptRules" TEXT,
  "preferredPalettes" TEXT NOT NULL DEFAULT '[]',
  "preferredPresets" TEXT NOT NULL DEFAULT '[]',
  "preferredSubjects" TEXT NOT NULL DEFAULT '[]',
  "avoidedElements" TEXT NOT NULL DEFAULT '[]',
  "approvedImages" INTEGER NOT NULL DEFAULT 0,
  "rejectedImages" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "autoApply" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisualProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisualProfile_facebookPageId_key" ON "VisualProfile"("facebookPageId");

CREATE TABLE "ImageGeneration" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "facebookPageId" TEXT,
  "serviceId" TEXT,
  "promptVersion" TEXT NOT NULL DEFAULT 'visual-v1',
  "model" TEXT,
  "preset" TEXT NOT NULL DEFAULT 'organic',
  "format" TEXT NOT NULL DEFAULT 'feed',
  "sourceCaption" TEXT,
  "visualBrief" TEXT,
  "prompt" TEXT NOT NULL,
  "negativePrompt" TEXT,
  "finalPrompt" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "overlayTemplate" TEXT NOT NULL DEFAULT 'none',
  "qualityScore" INTEGER NOT NULL DEFAULT 0,
  "scoreDetails" TEXT NOT NULL,
  "userAccepted" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImageGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImageGeneration_facebookPageId_createdAt_idx" ON "ImageGeneration"("facebookPageId", "createdAt");
CREATE INDEX "ImageGeneration_postId_idx" ON "ImageGeneration"("postId");
CREATE INDEX "ImageGeneration_preset_format_idx" ON "ImageGeneration"("preset", "format");

CREATE TABLE "ImageFeedback" (
  "id" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "rating" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImageFeedback_generationId_createdAt_idx" ON "ImageFeedback"("generationId", "createdAt");
CREATE INDEX "ImageFeedback_rating_createdAt_idx" ON "ImageFeedback"("rating", "createdAt");

ALTER TABLE "VisualProfile" ADD CONSTRAINT "VisualProfile_facebookPageId_fkey"
FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImageFeedback" ADD CONSTRAINT "ImageFeedback_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "ImageGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
