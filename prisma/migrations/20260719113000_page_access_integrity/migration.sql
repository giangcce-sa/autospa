-- Remove orphaned grants before enforcing referential integrity.
DELETE FROM "UserPageAccess"
WHERE NOT EXISTS (
  SELECT 1 FROM "FacebookPage"
  WHERE "FacebookPage"."id" = "UserPageAccess"."facebookPageId"
);

DO $$ BEGIN
  ALTER TABLE "UserPageAccess" ADD CONSTRAINT "UserPageAccess_facebookPageId_fkey"
  FOREIGN KEY ("facebookPageId") REFERENCES "FacebookPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
