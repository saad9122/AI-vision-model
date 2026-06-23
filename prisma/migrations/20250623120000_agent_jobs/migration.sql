-- CreateEnum
CREATE TYPE "AgentCapability" AS ENUM ('DESCRIPTION_GENERATOR');

-- DropTable
DROP TABLE "DescriptionJob";

-- DropEnum
DROP TYPE "DescriptionType";

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "capability" "AgentCapability" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentJob_capability_status_idx" ON "AgentJob"("capability", "status");

-- CreateIndex
CREATE INDEX "AgentJob_createdAt_idx" ON "AgentJob"("createdAt");
