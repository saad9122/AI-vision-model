import { env } from "../../shared/config/env";
import { logger } from "../../shared/config/logger";
import { connection } from "../queue/connection";

const RATE_LIMIT_KEY = "ai-vision:vision-request-rate-limit";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquires a slot in the global vision API rate limit bucket (Redis-backed).
 * No-op when VISION_RATE_LIMIT_MAX is 0.
 */
export async function acquireVisionRateLimitSlot(): Promise<void> {
  const max = env.VISION_RATE_LIMIT_MAX;
  if (max <= 0) {
    return;
  }

  const durationMs = env.VISION_RATE_LIMIT_DURATION_MS;

  while (true) {
    const count = await connection.incr(RATE_LIMIT_KEY);

    if (count === 1) {
      await connection.pexpire(RATE_LIMIT_KEY, durationMs);
    }

    if (count <= max) {
      return;
    }

    await connection.decr(RATE_LIMIT_KEY);

    const ttlMs = await connection.pttl(RATE_LIMIT_KEY);
    const waitMs = ttlMs > 0 ? ttlMs : durationMs;

    logger.info(
      { waitMs, max, durationMs },
      "Waiting for vision API rate limit slot"
    );

    await sleep(waitMs);
  }
}
