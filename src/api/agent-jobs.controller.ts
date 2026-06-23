import type { NextFunction, Request, Response } from "express";
import { prisma } from "../shared/config/db";
import { logger } from "../shared/config/logger";
import { agentJobsQueue } from "../platform/queue/agent-jobs.queue";
import { getCapabilityHandler } from "../platform/queue/capability-registry";
import {
  extractImageKeysFromPayload,
  serializeAgentJob,
} from "../shared/utils/agent-job.util";
import {
  createAgentJobSchema,
  fromAgentCapability,
  submitAgentJobReviewSchema,
  toAgentCapability,
} from "./agent-jobs.validator";

export async function createAgentJob(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = createAgentJobSchema.parse(req.body);
    const capability = toAgentCapability(body.capability);
    const handler = getCapabilityHandler(capability);
    const validatedPayload = handler.validatePayload(body.payload);
    const imageKeys = extractImageKeysFromPayload(validatedPayload);
    const context = body.context;

    logger.info(
      { capability: body.capability, imageCount: imageKeys.length },
      "Creating agent job — processing will begin shortly"
    );

    const job = await prisma.agentJob.create({
      data: {
        capability,
        payload: validatedPayload as object,
        status: "PENDING",
        tenantId: context?.tenant_id ?? null,
        schemaName: context?.schema_name ?? null,
        userId: context?.user_id ?? null,
        userName: context?.user_name ?? null,
        imageCount: imageKeys.length,
        images: imageKeys,
      },
    });

    await agentJobsQueue.add("process-agent-job", { jobId: job.id });

    logger.info(
      { jobId: job.id, capability: body.capability, status: job.status },
      "Agent job created and enqueued"
    );

    return res.status(202).json({
      jobId: job.id,
      capability: body.capability,
      status: job.status,
    });
  } catch (err) {
    logger.error({ err, body: req.body }, "Failed to create agent job");
    return next(err);
  }
}

export async function getAgentJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const job = await prisma.agentJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json({
      ...serializeAgentJob({
        ...job,
        capability: fromAgentCapability(job.capability),
      }),
    });
  } catch (err) {
    return next(err);
  }
}

export async function submitAgentJobReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const body = submitAgentJobReviewSchema.parse(req.body);

    const job = await prisma.agentJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const updated = await prisma.agentJob.update({
      where: { id },
      data: {
        reviewSubmittedAt: new Date(),
        reviewNote: body.review_note?.trim() || null,
        reviewLiked: body.review_liked ?? null,
      },
    });

    return res.json({
      ...serializeAgentJob({
        ...updated,
        capability: fromAgentCapability(updated.capability),
      }),
    });
  } catch (err) {
    logger.error({ err, jobId: req.params.id }, "Failed to submit agent job review");
    return next(err);
  }
}
