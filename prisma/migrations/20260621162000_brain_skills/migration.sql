-- CreateTable
CREATE TABLE "BrainSkill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "inputSignals" TEXT NOT NULL DEFAULT '[]',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerConfig" TEXT NOT NULL DEFAULT '{}',
    "playbook" TEXT NOT NULL,
    "tools" TEXT NOT NULL DEFAULT '[]',
    "successMetric" TEXT,
    "permissionLevel" TEXT NOT NULL DEFAULT 'suggest',
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "classificationConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "learnedFrom" TEXT NOT NULL DEFAULT 'manual',
    "councilNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainSkillVersion" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "playbook" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL DEFAULT '{}',
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainSkillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainSkillRun" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT '{}',
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BrainSkillRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainSkillOutcome" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "runId" TEXT,
    "metric" TEXT NOT NULL,
    "beforeValue" DOUBLE PRECISION,
    "afterValue" DOUBLE PRECISION,
    "deltaPct" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "confidenceDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainSkillOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainSkillFeedback" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainSkillFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrainSkill_domain_status_idx" ON "BrainSkill"("domain", "status");

-- CreateIndex
CREATE INDEX "BrainSkill_category_status_idx" ON "BrainSkill"("category", "status");

-- CreateIndex
CREATE INDEX "BrainSkill_riskLevel_status_idx" ON "BrainSkill"("riskLevel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrainSkillVersion_skillId_version_key" ON "BrainSkillVersion"("skillId", "version");

-- CreateIndex
CREATE INDEX "BrainSkillRun_skillId_startedAt_idx" ON "BrainSkillRun"("skillId", "startedAt");

-- CreateIndex
CREATE INDEX "BrainSkillRun_status_startedAt_idx" ON "BrainSkillRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "BrainSkillOutcome_skillId_createdAt_idx" ON "BrainSkillOutcome"("skillId", "createdAt");

-- CreateIndex
CREATE INDEX "BrainSkillOutcome_status_createdAt_idx" ON "BrainSkillOutcome"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrainSkillFeedback_skillId_createdAt_idx" ON "BrainSkillFeedback"("skillId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrainSkillVersion" ADD CONSTRAINT "BrainSkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "BrainSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainSkillRun" ADD CONSTRAINT "BrainSkillRun_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "BrainSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainSkillOutcome" ADD CONSTRAINT "BrainSkillOutcome_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "BrainSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainSkillOutcome" ADD CONSTRAINT "BrainSkillOutcome_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BrainSkillRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainSkillFeedback" ADD CONSTRAINT "BrainSkillFeedback_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "BrainSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
