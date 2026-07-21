ALTER TABLE "FacebookPage"
ADD COLUMN "adsReadinessStatus" TEXT NOT NULL DEFAULT 'unchecked',
ADD COLUMN "adsReadinessError" TEXT,
ADD COLUMN "adsReadinessCheckedAt" TIMESTAMP(3),
ADD COLUMN "adsTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "adsDataAccessExpiresAt" TIMESTAMP(3),
ADD COLUMN "adsPermissions" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "adsMissingPermissions" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "adAccountStatus" INTEGER,
ADD COLUMN "adAccountDisableReason" INTEGER,
ADD COLUMN "adAccountCurrency" TEXT,
ADD COLUMN "adAccountTimezone" TEXT;
