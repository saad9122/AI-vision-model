import { APICallError, generateText } from "ai";
import {
  detectedItemsResultSchema,
  itemRatingsResultSchema,
  type DetectedItemsResult,
  type ItemRatingsResult,
} from "../../modules/description-generator/domain/rating.constants";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/config/logger";
import { generateWithGeminiRetry } from "./gemini-retry";
import { acquireVisionRateLimitSlot } from "./vision-rate-limit.service";
import {
  getResolvedVisionModelLabel,
  getVisionModel,
  getVisionTimeoutMs,
} from "./vision-model.factory";
import { buildVisionMessages } from "./vision-messages";

export interface VisionRequestOptions {
  model?: string;
}

function getVisionErrorMessage(error: unknown): string | undefined {
  if (APICallError.isInstance(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}

function formatVisionError(error: unknown): Error {
  const message = getVisionErrorMessage(error);

  if (
    env.VISION_PROVIDER === "atxp" &&
    message?.includes("no longer available")
  ) {
    return new Error(
      `ATXP model "${env.ATXP_MODEL}" is no longer available. Update ATXP_MODEL (e.g. gemini-2.5-flash or gpt-4o).`
    );
  }

  if (env.VISION_PROVIDER === "lmstudio") {
    if (APICallError.isInstance(error) && error.statusCode === 404) {
      return new Error(
        "Failed to generate description from the vision model: LM Studio returned 404 — verify LMSTUDIO_BASE_URL and that the model is loaded in LM Studio"
      );
    }

    if (
      APICallError.isInstance(error) &&
      (error.statusCode === 503 || error.message.includes("ECONNREFUSED"))
    ) {
      return new Error(
        "Failed to generate description from the vision model: Cannot reach LM Studio — is the server running at LMSTUDIO_BASE_URL?"
      );
    }
  }

  return new Error(
    message
      ? `Failed to generate description from the vision model: ${message}`
      : "Failed to generate description from the vision model"
  );
}

export async function generateDescription(
  prompt: string,
  images: string[],
  options?: VisionRequestOptions
): Promise<string> {
  await acquireVisionRateLimitSlot();

  const model = getVisionModel(options?.model);
  const messages = buildVisionMessages(prompt, images);
  const abortSignal = AbortSignal.timeout(getVisionTimeoutMs());

  const callGenerate = () =>
    generateText({
      model,
      temperature: 0.2,
      messages,
      abortSignal,
    });

  try {
    const { text } =
      env.VISION_PROVIDER === "gemini"
        ? await generateWithGeminiRetry(callGenerate)
        : await callGenerate();

    if (!text?.trim()) {
      throw new Error("Empty vision model response");
    }

    return text.trim();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Gemini rate limit exceeded")) {
      throw error;
    }

    logger.error(
      {
        error,
        provider: env.VISION_PROVIDER,
        model: getResolvedVisionModelLabel(options?.model),
      },
      "Vision model request failed"
    );

    throw formatVisionError(error);
  }
}

function parseRatingsJson(text: string): ItemRatingsResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    const result = itemRatingsResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function generateStructuredRatings(
  prompt: string,
  images: string[],
  options?: VisionRequestOptions
): Promise<ItemRatingsResult | null> {
  try {
    const text = await generateDescription(prompt, images, options);
    return parseRatingsJson(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Gemini rate limit exceeded")) {
      throw error;
    }

    logger.warn(
      { error, provider: env.VISION_PROVIDER },
      "Structured ratings generation failed; continuing without ratings"
    );

    return null;
  }
}

function parseDetectedItemsJson(text: string): DetectedItemsResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    const result = detectedItemsResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function generateDetectedItems(
  prompt: string,
  images: string[],
  options?: VisionRequestOptions
): Promise<string[] | null> {
  try {
    const text = await generateDescription(prompt, images, options);
    const parsed = parseDetectedItemsJson(text);
    if (!parsed) return null;

    const filtered = parsed.items.filter(
      (name) => name.trim().toLowerCase() !== "general overview"
    );

    return filtered.length > 0 ? filtered : null;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Gemini rate limit exceeded")) {
      throw error;
    }

    logger.warn(
      { error, provider: env.VISION_PROVIDER },
      "Detected items generation failed; continuing without detected items"
    );

    return null;
  }
}

export function getActiveVisionProviderLabel(modelOverride?: string): string {
  return getResolvedVisionModelLabel(modelOverride);
}
