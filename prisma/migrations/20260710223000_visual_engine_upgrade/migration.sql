ALTER TABLE "VisualProfile"
ADD COLUMN "trainingSamples" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastTrainedAt" TIMESTAMP(3);

ALTER TABLE "StaffVisualProfile"
ADD COLUMN "referenceStorageKey" TEXT;

ALTER TABLE "StaffVisualSample"
ADD COLUMN "storageKey" TEXT;

ALTER TABLE "ImageGeneration"
ADD COLUMN "parentGenerationId" TEXT,
ADD COLUMN "batchId" TEXT,
ADD COLUMN "variantIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "referenceMode" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "referenceSampleIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "originalImageUrl" TEXT,
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "promptScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "visionScore" INTEGER,
ADD COLUMN "visionDetails" TEXT,
ADD COLUMN "generationStatus" TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "latencyMs" INTEGER,
ADD COLUMN "estimatedCostUsd" DOUBLE PRECISION;

UPDATE "ImageGeneration" SET "promptScore" = "qualityScore";

ALTER TABLE "ImageGeneration"
ADD CONSTRAINT "ImageGeneration_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffVisualProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImageGeneration"
ADD CONSTRAINT "ImageGeneration_parentGenerationId_fkey"
FOREIGN KEY ("parentGenerationId") REFERENCES "ImageGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ImageGeneration_batchId_variantIndex_idx" ON "ImageGeneration"("batchId", "variantIndex");
CREATE INDEX "ImageGeneration_parentGenerationId_idx" ON "ImageGeneration"("parentGenerationId");
CREATE INDEX "ImageGeneration_staffProfileId_createdAt_idx" ON "ImageGeneration"("staffProfileId", "createdAt");
