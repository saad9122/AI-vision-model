import "dotenv/config";
import { z } from "zod";

function envFlag(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.string().default("development"),
    /** When true, job routes require x-api-key matching API_KEY */
    API_KEY_AUTH_ENABLED: z.preprocess(
      (val) => envFlag(val, false),
      z.boolean(),
    ),    API_KEY: z.string().optional(),

    DATABASE_URL: z.string().min(1, "DATABASE_URL must be set"),
    REDIS_URL: z.string().min(1, "REDIS_URL must be set"),

    VISION_PROVIDER: z
      .enum(["lmstudio", "openai", "gemini", "atxp", "openrouter"])
      .default("lmstudio"),

    LMSTUDIO_BASE_URL: z.string().default("http://192.168.100.18:1234"),
    LMSTUDIO_MODEL: z.string().default("qwen/qwen3-vl-8b"),
    LMSTUDIO_API_KEY: z.string().default("lm-studio"),
    LMSTUDIO_TIMEOUT_MS: z.coerce.number().default(180000),
    /** Used to scale images when many are sent; increase if you hit context errors */
    LMSTUDIO_NUM_CTX: z.coerce.number().default(8192),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o"),
    OPENAI_TIMEOUT_MS: z.coerce.number().default(120000),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
    GEMINI_TIMEOUT_MS: z.coerce.number().default(120000),
    GEMINI_MAX_RETRIES: z.coerce.number().default(4),
    GEMINI_RETRY_BASE_DELAY_MS: z.coerce.number().default(5000),
    GEMINI_REQUEST_GAP_MS: z.coerce.number().default(10000),

    /** ATXP connection string from https://accounts.atxp.ai */
    ATXP_CONNECTION: z.string().optional(),
    /** Alias for ATXP_CONNECTION (common typo) */
    AXTP_TOKEN: z.string().optional(),
    ATXP_MODEL: z.string().default("gemini-2.5-flash"),
    ATXP_TIMEOUT_MS: z.coerce.number().default(120000),

    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default("google/gemini-2.5-flash"),
    OPENROUTER_TIMEOUT_MS: z.coerce.number().default(120000),
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    OPENROUTER_APP_TITLE: z.string().default("Wooma"),

    S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT must be set"),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().min(1, "S3_BUCKET must be set"),
    S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID must be set"),
    S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY must be set"),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

    MAX_IMAGE_DIMENSION: z.coerce.number().default(1024),
    WORKER_CONCURRENCY: z.coerce.number().default(1),
    /** BullMQ job timeout in ms (0 = disabled) */
    WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(180000),
    /** wooma-backend webhook for job status push (optional) */
    WOOMA_BACKEND_WEBHOOK_URL: z.string().optional(),
    WOOMA_BACKEND_WEBHOOK_SECRET: z.string().optional(),
    /** Max queue jobs started per window (0 = disabled) */
    WORKER_RATE_LIMIT_MAX: z.coerce.number().default(0),
    WORKER_RATE_LIMIT_DURATION_MS: z.coerce.number().default(60000),
    /** Max vision API calls per window, shared across workers (0 = disabled) */
    VISION_RATE_LIMIT_MAX: z.coerce.number().default(0),
    VISION_RATE_LIMIT_DURATION_MS: z.coerce.number().default(60000),
  })
  .superRefine((data, ctx) => {
    if (data.API_KEY_AUTH_ENABLED && !data.API_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API_KEY must be set when API_KEY_AUTH_ENABLED=true",
        path: ["API_KEY"],
      });
    }

    if (data.VISION_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENAI_API_KEY must be set when VISION_PROVIDER=openai",
        path: ["OPENAI_API_KEY"],
      });
    }

    if (data.VISION_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GEMINI_API_KEY must be set when VISION_PROVIDER=gemini",
        path: ["GEMINI_API_KEY"],
      });
    }

    if (
      data.VISION_PROVIDER === "atxp" &&
      !data.ATXP_CONNECTION &&
      !data.AXTP_TOKEN
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ATXP_CONNECTION or AXTP_TOKEN must be set when VISION_PROVIDER=atxp",
        path: ["ATXP_CONNECTION"],
      });
    }

    if (data.VISION_PROVIDER === "openrouter" && !data.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "OPENROUTER_API_KEY must be set when VISION_PROVIDER=openrouter",
        path: ["OPENROUTER_API_KEY"],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
