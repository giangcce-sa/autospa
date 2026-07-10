ALTER TABLE "CompetitorPost"
ADD COLUMN "engagementScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "viralLevel" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN "detectedTopic" TEXT,
ADD COLUMN "contentFormat" TEXT,
ADD COLUMN "detectedService" TEXT,
ADD COLUMN "hookType" TEXT,
ADD COLUMN "offerType" TEXT,
ADD COLUMN "ctaType" TEXT,
ADD COLUMN "aiSummary" TEXT,
ADD COLUMN "learningStatus" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN "analyzedAt" TIMESTAMP(3);

UPDATE "CompetitorPost"
SET "engagementScore" = "likes" + ("comments" * 2) + ("shares" * 3),
    "viralLevel" = CASE
      WHEN "likes" + ("comments" * 2) + ("shares" * 3) >= 500 THEN 'high'
      WHEN "likes" + ("comments" * 2) + ("shares" * 3) >= 120 THEN 'medium'
      ELSE 'low'
    END;

CREATE INDEX "CompetitorPost_learningStatus_publishedAt_idx" ON "CompetitorPost"("learningStatus", "publishedAt");
CREATE INDEX "CompetitorPost_viralLevel_publishedAt_idx" ON "CompetitorPost"("viralLevel", "publishedAt");
CREATE INDEX "CompetitorPost_detectedTopic_idx" ON "CompetitorPost"("detectedTopic");

CREATE TABLE "CompetitorMemory" (
  "id" TEXT NOT NULL,
  "windowDays" INTEGER NOT NULL DEFAULT 30,
  "topTopics" TEXT NOT NULL DEFAULT '[]',
  "topServices" TEXT NOT NULL DEFAULT '[]',
  "topFormats" TEXT NOT NULL DEFAULT '[]',
  "topHooks" TEXT NOT NULL DEFAULT '[]',
  "commonOffers" TEXT NOT NULL DEFAULT '[]',
  "competitorMomentum" TEXT NOT NULL DEFAULT '[]',
  "counterPositioning" TEXT,
  "recommendations" TEXT NOT NULL DEFAULT '[]',
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastAnalyzedPostAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitorMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitorMemory_updatedAt_idx" ON "CompetitorMemory"("updatedAt");
