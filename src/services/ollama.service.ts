import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { formatHttpError } from "../utils/http-error";

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

/**
 * Calls Ollama's /api/generate endpoint with a text prompt and one or more
 * base64-encoded images. Returns the trimmed text response from the model.
 */
export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  if (!env.OLLAMA_BASE_URL) {
    throw new Error("OLLAMA_BASE_URL is not configured");
  }

  const url = `${env.OLLAMA_BASE_URL}/api/generate`;

  logger.debug(
    {
      url,
      model: env.OLLAMA_MODEL,
      imageCount: images.length,
      promptLength: prompt.length,
      timeoutMs: env.OLLAMA_TIMEOUT_MS,
    },
    "Calling Ollama"
  );

  try {
    const { data } = await axios.post<OllamaGenerateResponse>(
      url,
      {
        model: env.OLLAMA_MODEL,
        prompt,
        images,
        stream: false,
        options: {
          // Lower temperature -> more consistent, factual descriptions
          temperature: 0.2,
          num_ctx: env.OLLAMA_NUM_CTX,
        },
      },
      { timeout: env.OLLAMA_TIMEOUT_MS }
    );

    return data.response.trim();
  } catch (error) {
    const httpError = formatHttpError(error);

    logger.error(
      {
        ...httpError,
        model: env.OLLAMA_MODEL,
        imageCount: images.length,
        promptLength: prompt.length,
        timeoutMs: env.OLLAMA_TIMEOUT_MS,
      },
      "Ollama request failed"
    );

    const responseHint =
      typeof httpError.responseBody === "string"
        ? httpError.responseBody
        : httpError.responseBody !== undefined
          ? JSON.stringify(httpError.responseBody)
          : undefined;

    const statusHint =
      httpError.status === 404
        ? "Ollama returned 404 — verify OLLAMA_BASE_URL and that the model is pulled (e.g. ollama pull <model>)"
        : httpError.status === 503 || httpError.code === "ECONNREFUSED"
          ? "Cannot reach Ollama — is the server running at OLLAMA_BASE_URL?"
          : undefined;

    const detail = responseHint ?? statusHint ?? httpError.message ?? "unknown error";
    throw new Error(`Failed to generate description from the vision model: ${detail}`);
  }
}
