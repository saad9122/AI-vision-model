import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";

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
  try {
    const { data } = await axios.post<OllamaGenerateResponse>(
      `${env.OLLAMA_BASE_URL}/api/generate`,
      {
        model: env.OLLAMA_MODEL,
        prompt,
        images,
        stream: false,
        options: {
          // Lower temperature -> more consistent, factual descriptions
          temperature: 0.2,
        },
      },
      { timeout: env.OLLAMA_TIMEOUT_MS }
    );

    return data.response.trim();
  } catch (error) {
    logger.error({ error }, "Ollama request failed");
    throw new Error("Failed to generate description from the vision model");
  }
}
