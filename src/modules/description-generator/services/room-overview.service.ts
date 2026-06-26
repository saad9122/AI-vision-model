import { logger } from "../../../shared/config/logger";
import {
  generateDescription,
  type VisionRequestOptions,
} from "../../../platform/vision/vision.service";
import { buildRoomOverviewGeneralPrompt } from "../domain/prompts.service";

export async function generateRoomOverviewGeneral(
  roomName: string,
  images: string[],
  options?: VisionRequestOptions
): Promise<string> {
  logger.info(
    { roomName, imageCount: images.length },
    "Generating room overview (single pass)"
  );

  return generateDescription(
    buildRoomOverviewGeneralPrompt(roomName, images.length),
    images,
    options
  );
}
