CREATE TABLE "AdsCreateOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "fbPageId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStep" TEXT NOT NULL DEFAULT 'campaign',
    "campaignId" TEXT,
    "adSetId" TEXT,
    "imageHash" TEXT,
    "creativeId" TEXT,
    "adId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "completedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdsCreateOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdsCreateOperation_idempotencyKey_key" ON "AdsCreateOperation"("idempotencyKey");
CREATE INDEX "AdsCreateOperation_status_updatedAt_idx" ON "AdsCreateOperation"("status", "updatedAt");
CREATE INDEX "AdsCreateOperation_facebookPageId_createdAt_idx" ON "AdsCreateOperation"("facebookPageId", "createdAt");
CREATE INDEX "AdsCreateOperation_adAccountId_createdAt_idx" ON "AdsCreateOperation"("adAccountId", "createdAt");
CREATE INDEX "AdsCreateOperation_postId_createdAt_idx" ON "AdsCreateOperation"("postId", "createdAt");

ALTER TABLE "AdsCreateOperation" ADD CONSTRAINT "AdsCreateOperation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdsCreateOperation" ADD CONSTRAINT "AdsCreateOperation_facebookPageId_fkey" FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
