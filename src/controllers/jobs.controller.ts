import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db";
import { logger } from "../config/logger";
import { descriptionQueue } from "../queue/queue";
import { createJobSchema } from "../validators/job.validator";

/**
 * POST /api/v1/jobs
 *
 * Creates a new description job and enqueues it for background processing.
 * Returns immediately with a jobId that the caller can poll.
 */
export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createJobSchema.parse(req.body);

    logger.info(
      {
        roomName: body.roomName,
        itemName: body.itemName,
        imageCount: body.imageKeys.length,
        descriptionTypes: body.descriptionTypes ?? ["GENERAL", "ISSUES"],
      },
      "Creating description job — agent processing will begin shortly"
    );

    const job = await prisma.descriptionJob.create({
      data: {
        roomName: body.roomName,
        itemName: body.itemName,
        imageKeys: body.imageKeys,
        descriptionTypes: body.descriptionTypes ?? ["GENERAL", "ISSUES"],
        status: "PENDING",
      },
    });

    await descriptionQueue.add("generate-description", { jobId: job.id });

    logger.info(
      { jobId: job.id, status: job.status },
      "Description job created and enqueued — agent in progress"
    );

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
    });
  } catch (err) {
    logger.error({ err, body: req.body }, "Failed to create description job");
    return next(err);
  }
}

/**
 * GET /api/v1/jobs/:id
 *
 * Returns the current status and (if completed) the generated descriptions.
 */
export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const job = await prisma.descriptionJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json({
      jobId: job.id,
      status: job.status,
      roomName: job.roomName,
      itemName: job.itemName,
      descriptionTypes: job.descriptionTypes,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    return next(err);
  }
}
