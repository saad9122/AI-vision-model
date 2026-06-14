import { z } from "zod";
import { normalizeS3Key } from "../services/s3.service";

export const createJobSchema = z.object({
  roomName: z.string().trim().min(1, "roomName is required"),
  itemName: z.string().trim().min(1, "itemName is required"),

  // S3 object keys for the images uploaded for this room item
  imageKeys: z
    .array(z.string().trim().min(1))
    .min(1, "At least one imageKey is required")
    .max(10, "A maximum of 10 images per job is supported")
    .transform((keys) => keys.map(normalizeS3Key)),

  // Defaults to generating both descriptions if not provided
  descriptionTypes: z
    .array(z.enum(["GENERAL", "ISSUES"]))
    .min(1)
    .max(2)
    .optional(),
});

export type CreateJobBody = z.infer<typeof createJobSchema>;
