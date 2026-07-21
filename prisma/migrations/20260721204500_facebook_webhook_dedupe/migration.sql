ALTER TABLE "InboxMessage"
ADD COLUMN "fbMessageId" TEXT;

WITH duplicates AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "fbCommentId" ORDER BY "createdAt", "id") AS row_number
  FROM "PostComment"
  WHERE "fbCommentId" IS NOT NULL
)
UPDATE "PostComment"
SET "fbCommentId" = NULL
FROM duplicates
WHERE "PostComment"."id" = duplicates."id" AND duplicates.row_number > 1;

CREATE UNIQUE INDEX "InboxMessage_fbMessageId_key" ON "InboxMessage"("fbMessageId");
CREATE UNIQUE INDEX "PostComment_fbCommentId_key" ON "PostComment"("fbCommentId");
