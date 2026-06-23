-- AlterTable
ALTER TABLE "AgentJob" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "AgentJob" ADD COLUMN "schema_name" TEXT;
ALTER TABLE "AgentJob" ADD COLUMN "user_id" TEXT;
ALTER TABLE "AgentJob" ADD COLUMN "user_name" TEXT;
ALTER TABLE "AgentJob" ADD COLUMN "image_count" INTEGER;
ALTER TABLE "AgentJob" ADD COLUMN "images" JSONB;
ALTER TABLE "AgentJob" ADD COLUMN "review_submitted_at" TIMESTAMP(3);
ALTER TABLE "AgentJob" ADD COLUMN "review_note" TEXT;
ALTER TABLE "AgentJob" ADD COLUMN "review_liked" BOOLEAN;

-- CreateIndex
CREATE INDEX "AgentJob_tenant_id_idx" ON "AgentJob"("tenant_id");
CREATE INDEX "AgentJob_user_id_idx" ON "AgentJob"("user_id");
