import { z } from "zod";
import {
  fromAgentCapability,
  isKnownCapabilitySlug,
  toAgentCapability,
} from "../shared/types/capabilities";

export const agentJobContextSchema = z
  .object({
    tenant_id: z.string().trim().min(1).optional(),
    schema_name: z.string().trim().min(1).optional(),
    user_id: z.string().trim().min(1).optional(),
    user_name: z.string().trim().min(1).optional(),
  })
  .optional();

export const createAgentJobSchema = z.object({
  capability: z
    .string()
    .trim()
    .min(1, "capability is required")
    .refine(isKnownCapabilitySlug, {
      message: "Unknown capability",
    }),
  payload: z.unknown(),
  context: agentJobContextSchema,
});

export const submitAgentJobReviewSchema = z.object({
  review_liked: z.boolean().optional(),
  review_note: z.string().trim().max(2000).optional(),
});

export type CreateAgentJobBody = z.infer<typeof createAgentJobSchema>;
export type SubmitAgentJobReviewBody = z.infer<typeof submitAgentJobReviewSchema>;

export { toAgentCapability, fromAgentCapability, isKnownCapabilitySlug };
