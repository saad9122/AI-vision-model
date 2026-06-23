import { z } from "zod";

export const ROOM_ITEM_CONDITION_VALUES = [
  "excellent",
  "good",
  "fair",
  "poor",
  "unacceptable",
  "N/A",
] as const;

export type RoomItemConditionValue = (typeof ROOM_ITEM_CONDITION_VALUES)[number];

export const roomItemConditionSchema = z.enum(ROOM_ITEM_CONDITION_VALUES);

export const itemRatingsResultSchema = z.object({
  condition: z.object({ rating: roomItemConditionSchema }),
  cleanliness: z.object({ rating: roomItemConditionSchema }),
});

export type ItemRatingsResult = z.infer<typeof itemRatingsResultSchema>;

export const detectedItemsResultSchema = z.object({
  items: z.array(z.string().trim().min(1)),
});

export type DetectedItemsResult = z.infer<typeof detectedItemsResultSchema>;
