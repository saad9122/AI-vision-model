import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../config/logger";

let client: GoogleGenerativeAI | null = null;
let lastRequestAt = 0;

function getClient(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!client) {
    client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiApiError {
  status?: number;
  statusText?: string;
  errorDetails?: Array<{ "@type"?: string; retryDelay?: string }>;
}

function isRateLimitError(error: unknown): boolean {
  const err = error as GeminiApiError;
  return err.status === 429;
}

function parseRetryDelayMs(error: unknown): number | null {
  const err = error as GeminiApiError;
  const retryInfo = err.errorDetails?.find((detail) =>
    detail["@type"]?.includes("RetryInfo")
  );

  if (!retryInfo?.retryDelay) {
    return null;
  }

  const match = retryInfo.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) {
    return null;
  }

  return Math.ceil(Number(match[1]) * 1000);
}

async function throttleBeforeRequest(): Promise<void> {
  const gapMs = env.GEMINI_REQUEST_GAP_MS;
  if (gapMs <= 0 || lastRequestAt === 0) {
    return;
  }

  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < gapMs) {
    const waitMs = gapMs - elapsed;
    logger.info({ waitMs }, "Waiting before next Gemini request to avoid rate limits");
    await sleep(waitMs);
  }
}

async function callGemini(prompt: string, images: string[]): Promise<string> {
  await throttleBeforeRequest();

  const model = getClient().getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
    },
  });

  const response = await model.generateContent(
    [
      prompt,
      ...images.map((image) => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      })),
    ],
    { timeout: env.GEMINI_TIMEOUT_MS }
  );

  lastRequestAt = Date.now();

  const content = response.response.text();
  if (!content) {
    throw new Error("Gemini returned an empty response");
  }

  return content.trim();
}

/**
 * Calls Google Gemini with a text prompt and one or more base64-encoded JPEG
 * images. Retries on 429 rate-limit responses using Google's suggested delay.
 */
export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= env.GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGemini(prompt, images);
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === env.GEMINI_MAX_RETRIES) {
        break;
      }

      const retryDelayMs =
        parseRetryDelayMs(error) ?? env.GEMINI_RETRY_BASE_DELAY_MS * attempt;

      logger.warn(
        { attempt, maxRetries: env.GEMINI_MAX_RETRIES, retryDelayMs },
        "Gemini rate limit hit, retrying after delay"
      );

      await sleep(retryDelayMs);
    }
  }

  logger.error({ error: lastError }, "Gemini request failed");

  if (isRateLimitError(lastError)) {
    throw new Error(
      "Gemini rate limit exceeded. Free tier has low RPM/token limits — wait a minute, reduce image count, or enable billing on Google AI Studio."
    );
  }

  throw new Error("Failed to generate description from the vision model");
}
