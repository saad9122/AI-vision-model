export type AgentJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface AgentJobQueuePayload {
  jobId: string;
}
