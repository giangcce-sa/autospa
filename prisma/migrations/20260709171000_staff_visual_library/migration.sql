CREATE TABLE "StaffVisualProfile" (
  "id" TEXT NOT NULL,
  "facebookPageId" TEXT,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "gender" TEXT NOT NULL DEFAULT 'female',
  "referenceImageUrl" TEXT,
  "promptDescriptor" TEXT NOT NULL,
  "appearanceNotes" TEXT,
  "uniformNotes" TEXT,
  "usageNotes" TEXT,
  "consentStatus" TEXT NOT NULL DEFAULT 'consented',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffVisualProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffVisualProfile_facebookPageId_isActive_idx" ON "StaffVisualProfile"("facebookPageId", "isActive");
CREATE INDEX "StaffVisualProfile_consentStatus_isActive_idx" ON "StaffVisualProfile"("consentStatus", "isActive");

CREATE TABLE "StaffVisualSample" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "angle" TEXT,
  "expression" TEXT,
  "outfit" TEXT,
  "notes" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffVisualSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffVisualSample_staffId_isPrimary_idx" ON "StaffVisualSample"("staffId", "isPrimary");

ALTER TABLE "ImageGeneration"
ADD COLUMN "staffProfileId" TEXT;

ALTER TABLE "StaffVisualProfile" ADD CONSTRAINT "StaffVisualProfile_facebookPageId_fkey"
FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffVisualSample" ADD CONSTRAINT "StaffVisualSample_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "StaffVisualProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
