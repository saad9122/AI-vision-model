import sharp from "sharp";
import { env } from "../config/env";

/** Estimated vision tokens per image at MAX_IMAGE_DIMENSION for Ollama VL models */
const OLLAMA_TOKENS_PER_IMAGE_AT_BASE = 420;
/** Reserve tokens for long inventory prompts */
const OLLAMA_PROMPT_TOKEN_RESERVE = 1500;

export interface PrepareImageOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Computes a smaller max dimension when many images are sent to Ollama so the
 * total prompt stays within OLLAMA_NUM_CTX. Other providers use MAX_IMAGE_DIMENSION.
 */
export function getAdaptiveMaxDimension(imageCount: number): number {
  const base = env.MAX_IMAGE_DIMENSION;

  if (env.VISION_PROVIDER !== "ollama" || imageCount <= 1) {
    return base;
  }

  const ctx = env.OLLAMA_NUM_CTX;
  const availableForImages = ctx * 0.75 - OLLAMA_PROMPT_TOKEN_RESERVE;
  const tokensPerImage = availableForImages / imageCount;

  if (tokensPerImage >= OLLAMA_TOKENS_PER_IMAGE_AT_BASE) {
    return base;
  }

  const scale = Math.sqrt(tokensPerImage / OLLAMA_TOKENS_PER_IMAGE_AT_BASE);
  const dimension = Math.floor(base * scale);

  return Math.max(384, Math.min(base, dimension));
}

export function getAdaptiveJpegQuality(imageCount: number): number {
  if (imageCount >= 8) return 70;
  if (imageCount >= 5) return 75;
  if (imageCount >= 3) return 80;
  return 85;
}

/**
 * Converts a raw image buffer into a base64-encoded JPEG string that is
 * ready to be sent to Ollama's vision model.
 *
 * - Auto-rotates based on EXIF orientation
 * - Resizes so the longest side does not exceed maxDimension
 * - Normalizes the format to JPEG regardless of input format (png, webp, etc.)
 */
export async function prepareImageForModel(
  buffer: Buffer,
  options?: PrepareImageOptions
): Promise<string> {
  const maxDimension = options?.maxDimension ?? env.MAX_IMAGE_DIMENSION;
  const quality = options?.quality ?? 85;

  const processed = await sharp(buffer)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  return processed.toString("base64");
}
