import { Queue } from "bullmq";
import { connection } from "./connection";
import type { AgentJobQueuePayload } from "../../shared/types/agent-job";

export const QUEUE_NAME = "agent-jobs";

export const agentJobsQueue = new Queue<AgentJobQueuePayload>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});
