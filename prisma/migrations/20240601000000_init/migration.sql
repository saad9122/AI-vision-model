-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DescriptionType" AS ENUM ('GENERAL', 'ISSUES');

-- CreateTable
CREATE TABLE "DescriptionJob" (
    "id" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "imageKeys" TEXT[],
    "descriptionTypes" "DescriptionType"[],
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DescriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DescriptionJob_status_idx" ON "DescriptionJob"("status");

-- CreateIndex
CREATE INDEX "DescriptionJob_createdAt_idx" ON "DescriptionJob"("createdAt");
