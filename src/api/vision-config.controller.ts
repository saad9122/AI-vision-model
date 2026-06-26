import type { Request, Response, NextFunction } from "express";
import { env } from "../shared/config/env";
import { getDefaultVisionModelSlug } from "../platform/vision/vision-model.factory";
import { VISION_MODEL_OPTIONS } from "../platform/vision/vision-models.constants";

export function getVisionConfig(
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  return res.json({
    provider: env.VISION_PROVIDER,
    defaultModel: getDefaultVisionModelSlug(),
    models: VISION_MODEL_OPTIONS,
  });
}
