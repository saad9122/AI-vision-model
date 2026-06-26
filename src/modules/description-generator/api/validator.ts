import { z } from "zod";
import { normalizeS3Key } from "../../../platform/media/s3.service";
import { isAllowedVisionModel } from "../../../platform/vision/vision-models.constants";

export const descriptionGeneratorPayloadSchema = z.object({
  reportId: z.string().uuid("reportId must be a valid UUID"),
  roomId: z.string().uuid("roomId must be a valid UUID").optional(),
  itemId: z.string().uuid("itemId must be a valid UUID").optional(),
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
  model: z
    .string()
    .trim()
    .min(1)
    .optional()
    .refine((value) => value === undefined || isAllowedVisionModel(value), {
      message: "model must be one of the supported vision models",
    }),
});
export type DescriptionGeneratorPayloadInput = z.infer<
  typeof descriptionGeneratorPayloadSchema
>;
