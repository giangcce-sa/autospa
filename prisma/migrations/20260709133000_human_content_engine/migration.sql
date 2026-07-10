ALTER TABLE "StyleSample"
ADD COLUMN "learningStatus" TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE "HumanVoiceProfile" (
    "id" TEXT NOT NULL,
    "facebookPageId" TEXT,
    "rules" TEXT NOT NULL,
    "preferredWords" TEXT NOT NULL DEFAULT '[]',
    "avoidedWords" TEXT NOT NULL DEFAULT '[]',
    "approvedEdits" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HumanVoiceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HumanVoiceProfile_facebookPageId_key" ON "HumanVoiceProfile"("facebookPageId");

CREATE TABLE "ContentGeneration" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "facebookPageId" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'human-v1',
    "model" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'quick',
    "narrator" TEXT NOT NULL DEFAULT 'brand',
    "brief" TEXT NOT NULL,
    "strategy" TEXT,
    "draftCaption" TEXT NOT NULL,
    "editorCaption" TEXT NOT NULL,
    "finalCaption" TEXT NOT NULL,
    "hashtags" TEXT,
    "humanScore" INTEGER NOT NULL DEFAULT 0,
    "scoreDetails" TEXT NOT NULL,
    "userAccepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentGeneration_facebookPageId_createdAt_idx" ON "ContentGeneration"("facebookPageId", "createdAt");
CREATE INDEX "ContentGeneration_postId_idx" ON "ContentGeneration"("postId");

CREATE TABLE "ContentEdit" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "finalContent" TEXT NOT NULL,
    "changeRatio" DOUBLE PRECISION NOT NULL,
    "changeSummary" TEXT,
    "acceptedVoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentEdit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentEdit_generationId_key" ON "ContentEdit"("generationId");

ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentEdit" ADD CONSTRAINT "ContentEdit_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "ContentGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
