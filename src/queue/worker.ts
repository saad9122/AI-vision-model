import { Prisma } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { env } from "../config/env";
import { prisma } from "../config/db";
import { logger } from "../config/logger";
import { connection } from "./connection";
import { QUEUE_NAME } from "./queue";
import { downloadImage } from "../services/s3.service";
import { prepareImageForModel } from "../services/image.service";
import { generateDescription } from "../services/ollama.service";
import { buildGeneralPrompt, buildIssuesPrompt } from "../services/prompt.service";
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

  logger.info(
    { jobId, roomName: record.roomName, itemName: record.itemName, images: record.imageKeys.length },
    "Processing description job"
  );

  // 1. Download every image for this item and convert it to a base64 JPEG
  const images: string[] = [];
  for (const key of record.imageKeys) {
    const buffer = await downloadImage(key);
    images.push(await prepareImageForModel(buffer));
  }

  const result: DescriptionResult = {};

  // 2. Generate the plain description
  if (record.descriptionTypes.includes("GENERAL")) {
    const prompt = buildGeneralPrompt(record.roomName, record.itemName, images.length);
    result.general = await generateDescription(prompt, images);
  }

  // 3. Generate the issue / defect report
  if (record.descriptionTypes.includes("ISSUES")) {
    const prompt = buildIssuesPrompt(record.roomName, record.itemName, images.length);
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

worker.on("ready", () => {
  logger.info("Description worker is ready and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});
