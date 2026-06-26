import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "../../shared/config/env";
import { resolveVisionModelForProvider } from "./vision-models.constants";

function getLmStudioBaseUrl(): string {
  const base = env.LMSTUDIO_BASE_URL.replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function getAtxpConnectionString(): string {
  const connection = env.ATXP_CONNECTION ?? env.AXTP_TOKEN;
  if (!connection) {
    throw new Error("ATXP_CONNECTION or AXTP_TOKEN is not configured");
  }

  return connection;
}

export function getDefaultVisionModelSlug(): string {
  switch (env.VISION_PROVIDER) {
    case "openai":
      return env.OPENAI_MODEL;
    case "gemini":
      return env.GEMINI_MODEL;
    case "atxp":
      return env.ATXP_MODEL;
    case "openrouter":
      return env.OPENROUTER_MODEL;
    case "lmstudio":
    default:
      return env.LMSTUDIO_MODEL;
  }
}

function resolveModelSlug(modelOverride?: string): string {
  const slug = modelOverride?.trim() || getDefaultVisionModelSlug();
  return resolveVisionModelForProvider(env.VISION_PROVIDER, slug);
}

export function getVisionModel(modelOverride?: string): LanguageModel {
  const resolvedModel = resolveModelSlug(modelOverride);

  switch (env.VISION_PROVIDER) {
    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(resolvedModel);
    }

    case "gemini": {
      if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
      return google(resolvedModel);
    }

    case "atxp": {
      const atxp = createOpenAICompatible({
        name: "atxp",
        baseURL: "https://llm.atxp.ai/v1",
        apiKey: getAtxpConnectionString(),
      });
      return atxp(resolvedModel);
    }

    case "openrouter": {
      if (!env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not configured");
      }

      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        headers: {
          ...(env.OPENROUTER_HTTP_REFERER
            ? { "HTTP-Referer": env.OPENROUTER_HTTP_REFERER }
            : {}),
          ...(env.OPENROUTER_APP_TITLE
            ? { "X-OpenRouter-Title": env.OPENROUTER_APP_TITLE }
            : {}),
        },
      });
      return openrouter(resolvedModel);
    }

    case "lmstudio":
    default: {
      const lmstudio = createOpenAICompatible({
        name: "lmstudio",
        baseURL: getLmStudioBaseUrl(),
        apiKey: env.LMSTUDIO_API_KEY,
      });
      return lmstudio(resolvedModel);
    }
  }
}

export function getVisionTimeoutMs(): number {
  switch (env.VISION_PROVIDER) {
    case "openai":
      return env.OPENAI_TIMEOUT_MS;
    case "gemini":
      return env.GEMINI_TIMEOUT_MS;
    case "atxp":
      return env.ATXP_TIMEOUT_MS;
    case "openrouter":
      return env.OPENROUTER_TIMEOUT_MS;
    case "lmstudio":
    default:
      return env.LMSTUDIO_TIMEOUT_MS;
  }
}

export function usesImagesFirstContentOrder(): boolean {
  return (
    env.VISION_PROVIDER === "gemini" ||
    env.VISION_PROVIDER === "atxp" ||
    env.VISION_PROVIDER === "openrouter"
  );
}

export function getResolvedVisionModelLabel(modelOverride?: string): string {
  return `${env.VISION_PROVIDER} (${resolveModelSlug(modelOverride)})`;
}
