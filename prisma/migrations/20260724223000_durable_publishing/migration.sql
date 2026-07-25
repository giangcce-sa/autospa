CREATE TABLE "PublishOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "facebookPageId" TEXT,
    "source" TEXT NOT NULL,
    "revision" INTEGER,
    "actorId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "completedAt" TIMESTAMP(3),
    "reconciliationAt" TIMESTAMP(3),
    "reconciliationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishChannelAttempt" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerCheckpoint" TEXT,
    "externalId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishChannelAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublishOperation_idempotencyKey_key" ON "PublishOperation"("idempotencyKey");
CREATE UNIQUE INDEX "PublishOperation_postId_requestHash_key" ON "PublishOperation"("postId", "requestHash");
CREATE INDEX "PublishOperation_status_leaseUntil_idx" ON "PublishOperation"("status", "leaseUntil");
CREATE INDEX "PublishOperation_postId_createdAt_idx" ON "PublishOperation"("postId", "createdAt");
CREATE INDEX "PublishOperation_facebookPageId_createdAt_idx" ON "PublishOperation"("facebookPageId", "createdAt");
CREATE UNIQUE INDEX "PublishChannelAttempt_operationId_channel_attempt_key" ON "PublishChannelAttempt"("operationId", "channel", "attempt");
CREATE INDEX "PublishChannelAttempt_operationId_channel_status_idx" ON "PublishChannelAttempt"("operationId", "channel", "status");
CREATE INDEX "PublishChannelAttempt_status_updatedAt_idx" ON "PublishChannelAttempt"("status", "updatedAt");

ALTER TABLE "PublishOperation"
ADD CONSTRAINT "PublishOperation_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishOperation"
ADD CONSTRAINT "PublishOperation_facebookPageId_fkey"
FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishChannelAttempt"
ADD CONSTRAINT "PublishChannelAttempt_operationId_fkey"
FOREIGN KEY ("operationId") REFERENCES "PublishOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
