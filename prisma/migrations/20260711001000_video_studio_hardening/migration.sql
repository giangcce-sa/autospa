CREATE TABLE IF NOT EXISTS "UserPageAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "facebookPageId" TEXT NOT NULL,
  "permission" TEXT NOT NULL DEFAULT 'editor',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPageAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPageAccess_userId_facebookPageId_key" ON "UserPageAccess"("userId", "facebookPageId");
CREATE INDEX IF NOT EXISTS "UserPageAccess_facebookPageId_permission_idx" ON "UserPageAccess"("facebookPageId", "permission");

DO $$ BEGIN
  ALTER TABLE "UserPageAccess" ADD CONSTRAINT "UserPageAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "VideoProject"
ADD COLUMN IF NOT EXISTS "reservedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "inputRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "renderedRevision" INTEGER,
ADD COLUMN IF NOT EXISTS "approvedRevision" INTEGER,
ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "VideoScene"
ADD COLUMN IF NOT EXISTS "inputRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "videoRevision" INTEGER,
ADD COLUMN IF NOT EXISTS "audioRevision" INTEGER,
ADD COLUMN IF NOT EXISTS "lipSyncRevision" INTEGER;

ALTER TABLE "VideoAsset"
ADD COLUMN IF NOT EXISTS "checksum" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

ALTER TABLE "VideoJob"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "leaseOwner" TEXT,
ADD COLUMN IF NOT EXISTS "leaseUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancelRequested" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoJob_idempotencyKey_key" ON "VideoJob"("idempotencyKey");

ALTER TABLE "VideoConsent"
ADD COLUMN IF NOT EXISTS "facebookPageId" TEXT,
ADD COLUMN IF NOT EXISTS "evidenceType" TEXT,
ADD COLUMN IF NOT EXISTS "evidenceHash" TEXT,
ADD COLUMN IF NOT EXISTS "termsVersion" TEXT NOT NULL DEFAULT 'video-consent-v1';

CREATE INDEX IF NOT EXISTS "VideoConsent_facebookPageId_status_idx" ON "VideoConsent"("facebookPageId", "status");

ALTER TABLE "VideoSkill"
ADD COLUMN IF NOT EXISTS "evidenceHash" TEXT,
ADD COLUMN IF NOT EXISTS "sampleCount" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "VideoSkill_evidenceHash_status_idx" ON "VideoSkill"("evidenceHash", "status");

ALTER TABLE "VideoVersion"
ADD COLUMN IF NOT EXISTS "inputRevision" INTEGER NOT NULL DEFAULT 1;
