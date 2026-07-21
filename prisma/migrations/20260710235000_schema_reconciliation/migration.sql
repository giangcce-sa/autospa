-- Reconcile models that existed in Prisma schema but were missing from the
-- migration chain. IF NOT EXISTS keeps this safe for databases previously
-- aligned with prisma db push.
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "avgVisitDays" INTEGER,
ADD COLUMN IF NOT EXISTS "churnRisk" TEXT,
ADD COLUMN IF NOT EXISTS "clvTier" TEXT,
ADD COLUMN IF NOT EXISTS "clvTotal" INTEGER,
ADD COLUMN IF NOT EXISTS "clvUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastBookingAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rfmScore" INTEGER;

ALTER TABLE "FacebookPage"
ADD COLUMN IF NOT EXISTS "igAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "igUsername" TEXT;

ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "igPostId" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokVideoId" TEXT;

ALTER TABLE "PostAnalytics"
ADD COLUMN IF NOT EXISTS "igComments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "igImpressions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "igLikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "igReach" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "igSaved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tiktokComments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tiktokLikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tiktokShares" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tiktokViews" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Settings"
ADD COLUMN IF NOT EXISTS "telegramAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "telegramBotToken" TEXT,
ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
ADD COLUMN IF NOT EXISTS "weeklyReportDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "weeklyReportHour" INTEGER NOT NULL DEFAULT 8;

CREATE TABLE IF NOT EXISTS "TikTokAccount" (
  "id" TEXT NOT NULL, "openId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "avatarUrl" TEXT,
  "accessToken" TEXT NOT NULL, "refreshToken" TEXT, "expiresAt" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TikTokAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleAccount" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "displayName" TEXT, "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT, "expiresAt" TIMESTAMP(3), "accountId" TEXT, "locationId" TEXT, "locationName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleReview" (
  "id" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "authorName" TEXT NOT NULL, "authorPhotoUrl" TEXT,
  "rating" INTEGER NOT NULL, "comment" TEXT, "sentiment" TEXT, "reply" TEXT, "repliedAt" TIMESTAMP(3),
  "isReplied" BOOLEAN NOT NULL DEFAULT false, "isAlerted" BOOLEAN NOT NULL DEFAULT false, "googleAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updateTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GooglePost" (
  "id" TEXT NOT NULL, "googlePostId" TEXT, "summary" TEXT NOT NULL, "callToAction" TEXT,
  "callToActionUrl" TEXT, "mediaUrl" TEXT, "status" TEXT NOT NULL DEFAULT 'draft', "publishedAt" TIMESTAMP(3),
  "googleAccountId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GooglePost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContentMemory" (
  "id" TEXT NOT NULL, "tone" TEXT, "postType" TEXT, "topKeywords" TEXT NOT NULL, "topHashtags" TEXT,
  "avgEngagement" DOUBLE PRECISION NOT NULL DEFAULT 0, "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "bestHour" INTEGER, "bestDayOfWeek" INTEGER, "platform" TEXT NOT NULL DEFAULT 'facebook',
  "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadSourceWeight" (
  "id" TEXT NOT NULL, "source" TEXT NOT NULL, "totalLeads" INTEGER NOT NULL DEFAULT 0, "converted" INTEGER NOT NULL DEFAULT 0,
  "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "avgRevenue" INTEGER NOT NULL DEFAULT 0,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadSourceWeight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BookingPattern" (
  "id" TEXT NOT NULL, "patternType" TEXT NOT NULL, "key" TEXT NOT NULL, "value" DOUBLE PRECISION NOT NULL,
  "label" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BookingPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LearningInsight" (
  "id" TEXT NOT NULL, "loop" TEXT NOT NULL, "insight" TEXT NOT NULL, "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "appliedTo" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TikTokAccount_openId_key" ON "TikTokAccount"("openId");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleAccount_email_key" ON "GoogleAccount"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleReview_reviewId_key" ON "GoogleReview"("reviewId");
CREATE INDEX IF NOT EXISTS "GoogleReview_rating_idx" ON "GoogleReview"("rating");
CREATE INDEX IF NOT EXISTS "GoogleReview_isReplied_idx" ON "GoogleReview"("isReplied");
CREATE UNIQUE INDEX IF NOT EXISTS "GooglePost_googlePostId_key" ON "GooglePost"("googlePostId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadSourceWeight_source_key" ON "LeadSourceWeight"("source");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingPattern_patternType_key_key" ON "BookingPattern"("patternType", "key");
