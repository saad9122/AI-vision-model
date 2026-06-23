import type { RoomItemConditionValue } from "./rating.constants";

export type DescriptionType = "GENERAL" | "ISSUES";

export interface DescriptionGeneratorPayload {
  roomName: string;
  itemName: string;
  imageKeys: string[];
  descriptionTypes: DescriptionType[];
}

export interface RatingSuggestion {
  rating: RoomItemConditionValue;
}

export interface DescriptionGeneratorResult {
  general?: string;
  issues?: string;
  condition?: RatingSuggestion;
  cleanliness?: RatingSuggestion;
  detectedItems?: string[];
}
