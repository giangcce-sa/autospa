ALTER TABLE "BulkPlan" ADD COLUMN "facebookPageId" TEXT;

WITH plan_ownership AS (
    SELECT
        bp."id",
        COUNT(p."id") AS "postCount",
        COUNT(p."facebookPageId") AS "ownedPostCount",
        COUNT(DISTINCT p."facebookPageId") AS "pageCount",
        MIN(p."facebookPageId") AS "facebookPageId"
    FROM "BulkPlan" bp
    LEFT JOIN "Post" p ON p."bulkPlanId" = bp."id"
    GROUP BY bp."id"
)
UPDATE "BulkPlan" bp
SET "facebookPageId" = ownership."facebookPageId"
FROM plan_ownership ownership
WHERE bp."id" = ownership."id"
  AND ownership."postCount" > 0
  AND ownership."ownedPostCount" = ownership."postCount"
  AND ownership."pageCount" = 1;

UPDATE "BulkPlan"
SET "status" = 'ownership_unknown'
WHERE "facebookPageId" IS NULL;

CREATE INDEX "BulkPlan_facebookPageId_createdAt_idx" ON "BulkPlan"("facebookPageId", "createdAt");

ALTER TABLE "BulkPlan" ADD CONSTRAINT "BulkPlan_facebookPageId_fkey" FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
