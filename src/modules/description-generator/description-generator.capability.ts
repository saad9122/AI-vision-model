import { AgentCapability } from "@prisma/client";
import { logger } from "../../shared/config/logger";
import {
  getAdaptiveJpegQuality,
  getAdaptiveMaxDimension,
  prepareImageForModel,
} from "../../platform/media/image.service";
import { downloadImage } from "../../platform/media/s3.service";
import { generateDescription, generateDetectedItems, generateStructuredRatings } from "../../platform/vision/vision.service";
import {
  getCapabilityHandler,
  registerCapability,
  type AgentCapabilityHandler,
} from "../../platform/queue/capability-registry";
import { descriptionGeneratorPayloadSchema } from "./api/validator";
import { buildPrompts, isRoomOverviewItem } from "./domain/prompts.service";
import type {
  DescriptionGeneratorPayload,
  DescriptionGeneratorResult,
} from "./domain/types";
import { generateRoomOverviewGeneral } from "./services/room-overview.service";

async function processDescriptionGenerator(
  jobId: string,
  payload: DescriptionGeneratorPayload
): Promise<DescriptionGeneratorResult> {
  const itemScope = isRoomOverviewItem(payload.itemName) ? "ROOM_OVERVIEW" : "ITEM";

  logger.info(
    {
      jobId,
      capability: AgentCapability.DESCRIPTION_GENERATOR,
      roomName: payload.roomName,
      itemName: payload.itemName,
      itemScope,
      images: payload.imageKeys.length,
    },
    "Processing description-generator job"
  );

  const imageCount = payload.imageKeys.length;
  const maxDimension = getAdaptiveMaxDimension(imageCount);
  const jpegQuality = getAdaptiveJpegQuality(imageCount);

  logger.info(
    { jobId, imageCount, maxDimension, jpegQuality },
    "Preparing images for vision model"
  );

  const images = await Promise.all(
    payload.imageKeys.map(async (key) => {
      const buffer = await downloadImage(key);
      return prepareImageForModel(buffer, { maxDimension, quality: jpegQuality });
    })
  );

  const result: DescriptionGeneratorResult = {};
  const prompts = buildPrompts(payload.roomName, payload.itemName, images.length);
  const visionOptions = payload.model ? { model: payload.model } : undefined;

  if (payload.descriptionTypes.includes("GENERAL")) {
    const generalPromise =
      itemScope === "ROOM_OVERVIEW"
        ? generateRoomOverviewGeneral(payload.roomName, images, visionOptions)
        : generateDescription(prompts.general, images, visionOptions);

    const ratingsPromise = generateStructuredRatings(
      prompts.ratings,
      images,
      visionOptions
    );
    const detectedItemsPromise =
      itemScope === "ROOM_OVERVIEW" && prompts.detectedItems
        ? generateDetectedItems(prompts.detectedItems, images, visionOptions)
        : Promise.resolve(null);

    const [general, ratings, detectedItems] = await Promise.all([
      generalPromise,
      ratingsPromise,
      detectedItemsPromise,
    ]);

    result.general = general;

    if (ratings) {
      result.condition = ratings.condition;
      result.cleanliness = ratings.cleanliness;
    }

    if (detectedItems) {
      result.detectedItems = detectedItems;
    }
  }

  if (payload.descriptionTypes.includes("ISSUES")) {
    result.issues = await generateDescription(
      prompts.issues,
      images,
      visionOptions
    );
  }

  logger.info({ jobId }, "Description-generator job completed");
  return result;
}

const descriptionGeneratorHandler: AgentCapabilityHandler<
  DescriptionGeneratorPayload,
  DescriptionGeneratorResult
> = {
  capability: AgentCapability.DESCRIPTION_GENERATOR,
  validatePayload(raw: unknown): DescriptionGeneratorPayload {
    return descriptionGeneratorPayloadSchema.parse(raw);
  },
  process: processDescriptionGenerator,
};

registerCapability(descriptionGeneratorHandler);

export function getDescriptionGeneratorHandler() {
  return getCapabilityHandler(AgentCapability.DESCRIPTION_GENERATOR);
}
