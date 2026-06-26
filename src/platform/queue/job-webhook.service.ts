import type { AgentCapability, JobStatus } from "@prisma/client";
import { fromAgentCapability } from "../../api/agent-jobs.validator";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/config/logger";

export interface JobWebhookPayload {
  jobId: string;
  status: JobStatus;
  capability: string;
  reportId: string;
  userId: string;
  tenantId?: string | null;
  result?: unknown;
  error?: string | null;
  timestamp: number;
}

function extractReportId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const reportId = (payload as { reportId?: unknown }).reportId;
  return typeof reportId === "string" && reportId.trim().length > 0
    ? reportId
    : undefined;
}

async function postWebhook(body: JobWebhookPayload, attempt = 1): Promise<void> {
  const url = env.WOOMA_BACKEND_WEBHOOK_URL?.trim();
  if (!url) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = env.WOOMA_BACKEND_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers["x-webhook-secret"] = secret;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }
  } catch (err) {
    const maxAttempts = 3;
    if (attempt < maxAttempts) {
      const delayMs = 1000 * 2 ** (attempt - 1);
      logger.warn(
        { err, jobId: body.jobId, attempt, delayMs },
        "Job webhook failed — retrying"
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return postWebhook(body, attempt + 1);
    }
    logger.error({ err, jobId: body.jobId }, "Job webhook failed after retries");
  }
}

export async function notifyJobStatusChange(job: {
  id: string;
  capability: AgentCapability;
  status: JobStatus;
  payload: unknown;
  result?: unknown;
  error?: string | null;
  tenantId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const reportId = extractReportId(job.payload);
  if (!reportId) {
    logger.warn({ jobId: job.id }, "Skipping job webhook: missing reportId in payload");
    return;
  }

  if (!job.userId) {
    logger.warn({ jobId: job.id }, "Skipping job webhook: missing userId on job");
    return;
  }

  const body: JobWebhookPayload = {
    jobId: job.id,
    status: job.status,
    capability: fromAgentCapability(job.capability),
    reportId,
    userId: job.userId,
    tenantId: job.tenantId ?? null,
    result: job.result ?? null,
    error: job.error ?? null,
    timestamp: Date.now(),
  };

  void postWebhook(body);
}
