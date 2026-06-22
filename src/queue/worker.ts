import { Prisma } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { env } from "../config/env";
import { connectDb, prisma } from "../config/db";
import { logger } from "../config/logger";
import { connection } from "./connection";
import { QUEUE_NAME } from "./queue";
import { downloadImage } from "../services/s3.service";
import { prepareImageForModel, getAdaptiveMaxDimension, getAdaptiveJpegQuality } from "../services/image.service";
import { generateDescription, getActiveVisionProviderLabel } from "../services/vision.service";
import { buildPrompts, isRoomOverviewItem } from "../services/prompt.service";
import { generateRoomOverviewGeneral } from "../services/room-overview.service";
import type { DescriptionJobQueuePayload, DescriptionResult } from "../types";

async function processJob(job: Job<DescriptionJobQueuePayload>) {
  const { jobId } = job.data;

  const record = await prisma.descriptionJob.findUnique({ where: { id: jobId } });
  if (!record) {
    throw new Error(`DescriptionJob ${jobId} not found in database`);
  }

  await prisma.descriptionJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });

  const itemScope = isRoomOverviewItem(record.itemName) ? "ROOM_OVERVIEW" : "ITEM";

  logger.info(
    {
      jobId,
      roomName: record.roomName,
      itemName: record.itemName,
      itemScope,
      images: record.imageKeys.length,
    },
    "Processing description job"
  );

  const imageCount = record.imageKeys.length;
  const maxDimension = getAdaptiveMaxDimension(imageCount);
  const jpegQuality = getAdaptiveJpegQuality(imageCount);

  logger.info(
    { jobId, imageCount, maxDimension, jpegQuality },
    "Preparing images for vision model"
  );

  // 1. Download every image for this item and convert it to a base64 JPEG
  const images: string[] = [];
  for (const key of record.imageKeys) {
    const buffer = await downloadImage(key);
    images.push(await prepareImageForModel(buffer, { maxDimension, quality: jpegQuality }));
  }

  const result: DescriptionResult = {};

  // General Overview: multi-item flow (identify items across images, describe each, combine).
  // All other jobs: itemName defines the single item; roomName is location context only.
  if (record.descriptionTypes.includes("GENERAL")) {
    if (itemScope === "ROOM_OVERVIEW") {
      result.general = await generateRoomOverviewGeneral(record.roomName, images);
    } else {
      const prompt = buildPrompts(record.roomName, record.itemName, images.length).general;
      result.general = await generateDescription(prompt, images);
    }
  }

  // Issues: room overview scans all items; single-item jobs focus on itemName only.
  if (record.descriptionTypes.includes("ISSUES")) {
    const prompt = buildPrompts(record.roomName, record.itemName, images.length).issues;
    result.issues = await generateDescription(prompt, images);
  }

  await prisma.descriptionJob.update({
    where: { id: jobId },
    data: { status: "COMPLETED", result: result as Prisma.InputJsonValue, error: null },
  });

  logger.info({ jobId }, "Description job completed");
}

const worker = new Worker<DescriptionJobQueuePayload>(QUEUE_NAME, processJob, {
  connection,
  concurrency: env.WORKER_CONCURRENCY,
});

worker.on("failed", async (job, err) => {
  if (!job) return;

  logger.error({ jobId: job.data.jobId, err }, "Description job failed");

  // Only mark as FAILED in the DB once all retry attempts are exhausted
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.descriptionJob
      .update({
        where: { id: job.data.jobId },
        data: { status: "FAILED", error: err.message ?? "Unknown error" },
      })
      .catch((dbErr: unknown) => logger.error({ dbErr }, "Failed to persist job failure"));
  }
});

void connectDb().then(() => {
  logger.info("Worker database connection ready");
});

worker.on("ready", () => {
  logger.info(
    { visionProvider: getActiveVisionProviderLabel() },
    "Description worker is ready and listening for jobs"
  );
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});
