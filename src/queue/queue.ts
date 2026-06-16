import { Queue } from "bullmq";
import { connection } from "./connection";
import type { DescriptionJobQueuePayload } from "../types";

export const QUEUE_NAME = "description-jobs";

export const descriptionQueue = new Queue<DescriptionJobQueuePayload>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});
