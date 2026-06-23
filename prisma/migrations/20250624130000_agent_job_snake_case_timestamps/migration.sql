-- Rename timestamp columns to snake_case
ALTER TABLE "AgentJob" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "AgentJob" RENAME COLUMN "updatedAt" TO "updated_at";

-- Recreate created-at index with snake_case column name
DROP INDEX IF EXISTS "AgentJob_createdAt_idx";
CREATE INDEX "AgentJob_created_at_idx" ON "AgentJob"("created_at");
