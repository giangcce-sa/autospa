ALTER TABLE "LeadConversation"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

WITH ranked_active AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "facebookPageId", "senderId"
            ORDER BY "createdAt" DESC, "id" DESC
        ) AS rank
    FROM "LeadConversation"
    WHERE "facebookPageId" IS NOT NULL
      AND "isComplete" = false
)
UPDATE "LeadConversation" AS conversation
SET "isComplete" = true
FROM ranked_active
WHERE conversation."id" = ranked_active."id"
  AND ranked_active.rank > 1;

CREATE INDEX "LeadConversation_facebookPageId_senderId_isComplete_idx"
ON "LeadConversation"("facebookPageId", "senderId", "isComplete");

CREATE UNIQUE INDEX "LeadConversation_active_page_sender_key"
ON "LeadConversation"("facebookPageId", "senderId")
WHERE "facebookPageId" IS NOT NULL
  AND "isComplete" = false;
