import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.string().default("development"),
    API_KEY: z.string().min(1, "API_KEY must be set"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL must be set"),
    REDIS_URL: z.string().min(1, "REDIS_URL must be set"),

    VISION_PROVIDER: z
      .enum(["lmstudio", "ollama", "openai", "gemini", "atxp"])
      .default("lmstudio"),

    LMSTUDIO_BASE_URL: z.string().default("http://192.168.100.18:1234"),
    LMSTUDIO_MODEL: z.string().default("qwen/qwen3-vl-8b"),
    LMSTUDIO_API_KEY: z.string().default("lm-studio"),
    LMSTUDIO_TIMEOUT_MS: z.coerce.number().default(180000),
    /** Used to scale images when many are sent; increase if you hit context errors */
    LMSTUDIO_NUM_CTX: z.coerce.number().default(8192),

    OLLAMA_BASE_URL: z.string().optional(),
    OLLAMA_MODEL: z.string().default("qwen2.5vl:3b"),
    OLLAMA_TIMEOUT_MS: z.coerce.number().default(180000),
    /** Context window passed to Ollama; increase if you hit exceed_context_size errors */
    OLLAMA_NUM_CTX: z.coerce.number().default(8192),

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

    S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT must be set"),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().min(1, "S3_BUCKET must be set"),
    S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID must be set"),
    S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY must be set"),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

    MAX_IMAGE_DIMENSION: z.coerce.number().default(1024),
    WORKER_CONCURRENCY: z.coerce.number().default(1),
  })
  .superRefine((data, ctx) => {
    if (data.VISION_PROVIDER === "ollama" && !data.OLLAMA_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OLLAMA_BASE_URL must be set when VISION_PROVIDER=ollama",
        path: ["OLLAMA_BASE_URL"],
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
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
