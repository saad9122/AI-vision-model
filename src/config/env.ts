import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development"),
  API_KEY: z.string().min(1, "API_KEY must be set"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL must be set"),
  REDIS_URL: z.string().min(1, "REDIS_URL must be set"),

  OLLAMA_BASE_URL: z.string().min(1, "OLLAMA_BASE_URL must be set"),
  OLLAMA_MODEL: z.string().default("qwen2.5vl:3b"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().default(180000),

  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT must be set"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET must be set"),
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID must be set"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY must be set"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  MAX_IMAGE_DIMENSION: z.coerce.number().default(1024),
  WORKER_CONCURRENCY: z.coerce.number().default(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
