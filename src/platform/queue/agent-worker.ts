import { Prisma } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { env } from "../../shared/config/env";
import { connectDb, prisma } from "../../shared/config/db";
import { logger } from "../../shared/config/logger";
import type { AgentJobQueuePayload } from "../../shared/types/agent-job";
import { getActiveVisionProviderLabel } from "../vision/vision.service";
import { connection } from "./connection";
import { QUEUE_NAME } from "./agent-jobs.queue";
import { getCapabilityHandler } from "./capability-registry";
import { notifyJobStatusChange } from "./job-webhook.service";

async function processAgentJob(job: Job<AgentJobQueuePayload>) {
  const { jobId } = job.data;

  const record = await prisma.agentJob.findUnique({ where: { id: jobId } });
  if (!record) {
    throw new Error(`AgentJob ${jobId} not found in database`);
  }

  const processing = await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });
  await notifyJobStatusChange(processing);

  const handler = getCapabilityHandler(record.capability);
  const payload = handler.validatePayload(record.payload);

  try {
    const result = await handler.process(jobId, payload);

    const completed = await prisma.agentJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        result: result as Prisma.InputJsonValue,
        error: null,
      },
    });
    await notifyJobStatusChange(completed);
  } catch (err) {
    throw err;
  }
}

export function createAgentWorker(): Worker<AgentJobQueuePayload> {
  const worker = new Worker<AgentJobQueuePayload>(QUEUE_NAME, processAgentJob, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    stalledInterval: 30_000,
    maxStalledCount: 2,
    ...(env.WORKER_RATE_LIMIT_MAX > 0 && {
      limiter: {
        max: env.WORKER_RATE_LIMIT_MAX,
        duration: env.WORKER_RATE_LIMIT_DURATION_MS,
      },
    }),
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    logger.error(
      { jobId: job.data.jobId, err },
      "Agent job failed"
    );

    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await prisma.agentJob
        .update({
          where: { id: job.data.jobId },
          data: { status: "FAILED", error: err.message ?? "Unknown error" },
        })
        .then((updated) => notifyJobStatusChange(updated))
        .catch((dbErr: unknown) =>
          logger.error({ dbErr }, "Failed to persist agent job failure")
        );
    }
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Agent worker error");
  });

  worker.on("ready", () => {
    logger.info(
      {
        visionProvider: getActiveVisionProviderLabel(),
        concurrency: env.WORKER_CONCURRENCY,
        jobTimeoutMs: env.WORKER_JOB_TIMEOUT_MS,
        ...(env.WORKER_RATE_LIMIT_MAX > 0 && {
          workerRateLimit: {
            max: env.WORKER_RATE_LIMIT_MAX,
            durationMs: env.WORKER_RATE_LIMIT_DURATION_MS,
          },
        }),
        ...(env.VISION_RATE_LIMIT_MAX > 0 && {
          visionRateLimit: {
            max: env.VISION_RATE_LIMIT_MAX,
            durationMs: env.VISION_RATE_LIMIT_DURATION_MS,
          },
        }),
      },
      "Agent worker is ready and listening for jobs"
    );
  });

  return worker;
}

export async function startAgentWorker(): Promise<Worker<AgentJobQueuePayload>> {
  await connectDb();
  logger.info("Worker database connection ready");
  return createAgentWorker();
}
