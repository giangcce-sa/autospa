-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "openaiChatModel" TEXT NOT NULL DEFAULT 'gpt-5';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "abGroupId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "npsScore" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "npsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "fromPostId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "fromCampaignId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "fromAdId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hashedPwd" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "limit" INTEGER NOT NULL,
    "windowSec" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL DEFAULT 'ai_reviewer',
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRule" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "matchMode" TEXT NOT NULL DEFAULT 'contains',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL DEFAULT 'both',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "fbPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "accessToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPost" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "fbPostId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceSignal" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL DEFAULT 'stable',
    "details" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaStory" (
    "id" TEXT NOT NULL,
    "facebookPageId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'testimonial',
    "customerName" TEXT,
    "content" TEXT NOT NULL,
    "service" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestratorRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signals" TEXT NOT NULL,
    "priorities" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'recommend',

    CONSTRAINT "OrchestratorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CEODecision" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "synthesis" TEXT NOT NULL,
    "debate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'council',
    "outcomeCheckAt" TIMESTAMP(3),
    "outcomeMetric" TEXT,
    "outcomeBefore" DOUBLE PRECISION,
    "outcomeAfter" DOUBLE PRECISION,
    "outcomeStatus" TEXT,
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CEODecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueForecast" (
    "id" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizonDays" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL DEFAULT 'baseline',
    "forecast" TEXT NOT NULL,
    "totalPredicted" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "notes" TEXT,

    CONSTRAINT "RevenueForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MorningBrief" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "debate" TEXT,
    "subReports" TEXT,
    "assignments" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRevenue" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT,
    "service" TEXT,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "fromPostId" TEXT,
    "fromCampaignId" TEXT,
    "fromAdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReview_postId_key" ON "ContentReview"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_fbPageId_key" ON "Competitor"("fbPageId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPost_fbPostId_key" ON "CompetitorPost"("fbPostId");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_source_topic_idx" ON "IntelligenceSignal"("source", "topic");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_trend_fetchedAt_idx" ON "IntelligenceSignal"("trend", "fetchedAt");

-- CreateIndex
CREATE INDEX "RealtimeAlert_type_detectedAt_idx" ON "RealtimeAlert"("type", "detectedAt");

-- CreateIndex
CREATE INDEX "RealtimeAlert_acknowledged_idx" ON "RealtimeAlert"("acknowledged");

-- CreateIndex
CREATE INDEX "WorkflowRun_name_startedAt_idx" ON "WorkflowRun"("name", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "CEODecision_topicKey_idx" ON "CEODecision"("topicKey");

-- CreateIndex
CREATE INDEX "CEODecision_outcomeStatus_idx" ON "CEODecision"("outcomeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MorningBrief_date_key" ON "MorningBrief"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRevenue_bookingId_key" ON "BookingRevenue"("bookingId");

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPost" ADD CONSTRAINT "CompetitorPost_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRevenue" ADD CONSTRAINT "BookingRevenue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
