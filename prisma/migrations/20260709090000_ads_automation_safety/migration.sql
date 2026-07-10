ALTER TABLE "Settings"
ADD COLUMN "adsOptimizeMinSpend" INTEGER NOT NULL DEFAULT 100000,
ADD COLUMN "adsOptimizeMaxBudget" INTEGER NOT NULL DEFAULT 2000000,
ADD COLUMN "adsOptimizeCooldownHrs" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "adsOptimizeMinRoas" DOUBLE PRECISION NOT NULL DEFAULT 1.5;

ALTER TABLE "PendingApproval"
ADD COLUMN "executedAt" TIMESTAMP(3),
ADD COLUMN "executionError" TEXT;

CREATE INDEX "AdOptimizationLog_campaignId_action_createdAt_idx"
ON "AdOptimizationLog"("campaignId", "action", "createdAt");

CREATE TABLE "AutomationLock" (
    "id" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("id")
);
