import sharp from "sharp";
import { env } from "../config/env";

/**
 * Converts a raw image buffer into a base64-encoded JPEG string that is
 * ready to be sent to Ollama's vision model.
 *
 * - Auto-rotates based on EXIF orientation
 * - Resizes so the longest side does not exceed MAX_IMAGE_DIMENSION
 *   (keeps payload size and inference time reasonable, especially on CPU)
 * - Normalizes the format to JPEG regardless of input format (png, webp, etc.)
 */
export async function prepareImageForModel(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .rotate()
    .resize({
      width: env.MAX_IMAGE_DIMENSION,
      height: env.MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return processed.toString("base64");
}
