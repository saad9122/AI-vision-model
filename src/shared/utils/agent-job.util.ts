export interface AgentJobContext {
  tenant_id?: string;
  schema_name?: string;
  user_id?: string;
  user_name?: string;
}

export function extractImageKeysFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const imageKeys = (payload as { imageKeys?: unknown }).imageKeys;
  if (!Array.isArray(imageKeys)) return [];
  return imageKeys.filter((key): key is string => typeof key === "string" && key.trim().length > 0);
}

export function serializeAgentJob(job: {
  id: string;
  capability: string;
  status: string;
  payload: unknown;
  result: unknown;
  error: string | null;
  tenantId: string | null;
  schemaName: string | null;
  userId: string | null;
  userName: string | null;
  imageCount: number | null;
  images: unknown;
  reviewSubmittedAt: Date | null;
  reviewNote: string | null;
  reviewLiked: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    jobId: job.id,
    capability: job.capability,
    status: job.status,
    payload: job.payload,
    result: job.result,
    error: job.error,
    tenant_id: job.tenantId,
    schema_name: job.schemaName,
    user_id: job.userId,
    user_name: job.userName,
    image_count: job.imageCount,
    images: job.images,
    review_submitted_at: job.reviewSubmittedAt,
    review_note: job.reviewNote,
    review_liked: job.reviewLiked,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}
