import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "../../shared/config/env";

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

export function getVisionModel(): LanguageModel {
  switch (env.VISION_PROVIDER) {
    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(env.OPENAI_MODEL);
    }

    case "gemini": {
      if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
      return google(env.GEMINI_MODEL);
    }

    case "atxp": {
      const atxp = createOpenAICompatible({
        name: "atxp",
        baseURL: "https://llm.atxp.ai/v1",
        apiKey: getAtxpConnectionString(),
      });
      return atxp(env.ATXP_MODEL);
    }

    case "lmstudio":
    default: {
      const lmstudio = createOpenAICompatible({
        name: "lmstudio",
        baseURL: getLmStudioBaseUrl(),
        apiKey: env.LMSTUDIO_API_KEY,
      });
      return lmstudio(env.LMSTUDIO_MODEL);
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
    case "lmstudio":
    default:
      return env.LMSTUDIO_TIMEOUT_MS;
  }
}

export function usesImagesFirstContentOrder(): boolean {
  return env.VISION_PROVIDER === "gemini" || env.VISION_PROVIDER === "atxp";
}
