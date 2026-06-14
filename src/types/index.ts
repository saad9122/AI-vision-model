export type DescriptionType = "GENERAL" | "ISSUES";

export interface DescriptionResult {
  general?: string;
  issues?: string;
}

export interface CreateJobInput {
  roomName: string;
  itemName: string;
  imageKeys: string[];
  descriptionTypes?: DescriptionType[];
}

export interface DescriptionJobQueuePayload {
  jobId: string;
}
