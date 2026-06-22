import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const RETRIABLE_ERROR_CODES = new Set(["P1001", "P1002", "P1017"]);

function isRetriableDbError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  if (err.constructor.name === "PrismaClientInitializationError") {
    return true;
  }

  if (
    err.constructor.name === "PrismaClientKnownRequestError" &&
    "code" in err &&
    typeof err.code === "string"
  ) {
    return RETRIABLE_ERROR_CODES.has(err.code);
  }

  return /can't reach database server|connection timed out|server has closed the connection/i.test(
    err.message
  );
}

async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetriableDbError(err) || attempt === maxAttempts) {
        throw err;
      }

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
      logger.warn(
        { attempt, maxAttempts, delayMs },
        "Database unreachable (Neon may be waking up), retrying"
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

const baseClient = new PrismaClient();

// Retry transient connection failures on every query (common with Neon cold starts).
export const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return withDbRetry(() => query(args));
      },
    },
  },
});

/** Warm up the pool at startup so the first API request is not the cold-start victim. */
export async function connectDb(): Promise<void> {
  await withDbRetry(() => baseClient.$connect());
  logger.info("Database connected");
}

export async function disconnectDb(): Promise<void> {
  await baseClient.$disconnect();
}
