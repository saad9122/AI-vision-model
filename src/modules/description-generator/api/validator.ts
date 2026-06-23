import { z } from "zod";
import { normalizeS3Key } from "../../../platform/media/s3.service";

export const descriptionGeneratorPayloadSchema = z.object({
  roomName: z.string().trim().min(1, "roomName is required"),
  itemName: z.string().trim().min(1, "itemName is required"),
  imageKeys: z
    .array(z.string().trim().min(1))
    .min(1, "At least one imageKey is required")
    .max(10, "A maximum of 10 images per job is supported")
    .transform((keys) => keys.map(normalizeS3Key)),
  descriptionTypes: z
    .array(z.enum(["GENERAL", "ISSUES"]))
    .min(1)
    .max(2)
    .default(["GENERAL", "ISSUES"]),
});

export type DescriptionGeneratorPayloadInput = z.infer<
  typeof descriptionGeneratorPayloadSchema
>;
