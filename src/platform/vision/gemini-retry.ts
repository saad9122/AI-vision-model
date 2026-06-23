import { APICallError } from "ai";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/config/logger";

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

function parseRetryDelayMs(error: unknown): number | null {
  if (!APICallError.isInstance(error) || !error.responseBody) {
    return null;
  }

  try {
    const body =
      typeof error.responseBody === "string"
        ? JSON.parse(error.responseBody)
        : error.responseBody;

    const retryInfo = body?.error?.details?.find((detail: { "@type"?: string }) =>
      detail["@type"]?.includes("RetryInfo")
    );

    const retryDelay = retryInfo?.retryDelay as string | undefined;
    if (!retryDelay) {
      return null;
    }

    const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
    if (!match) {
      return null;
    }

    return Math.ceil(Number(match[1]) * 1000);
  } catch {
    return null;
  }
}

async function throttleBeforeRequest(): Promise<void> {
  if (env.VISION_RATE_LIMIT_MAX > 0) {
    return;
  }

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

export async function generateWithGeminiRetry<T>(
  generate: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= env.GEMINI_MAX_RETRIES; attempt++) {
    try {
      await throttleBeforeRequest();
      const result = await generate();
      lastRequestAt = Date.now();
      return result;
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

  if (isRateLimitError(lastError)) {
    throw new Error(
      "Gemini rate limit exceeded. Free tier has low RPM/token limits — wait a minute, reduce image count, or enable billing on Google AI Studio."
    );
  }

  throw lastError;
}
