ALTER TABLE "CommentRule" ADD COLUMN "facebookPageId" TEXT;

CREATE INDEX "CommentRule_facebookPageId_createdAt_idx" ON "CommentRule"("facebookPageId", "createdAt");

ALTER TABLE "CommentRule" ADD CONSTRAINT "CommentRule_facebookPageId_fkey" FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "HumanVoiceProfile" profile
SET "facebookPageId" = NULL
WHERE profile."facebookPageId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "FacebookPage" page
    WHERE page."id" = profile."facebookPageId"
  );

ALTER TABLE "HumanVoiceProfile" ADD CONSTRAINT "HumanVoiceProfile_facebookPageId_fkey" FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
