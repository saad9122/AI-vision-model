import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../config/logger";

let client: OpenAI | null = null;

function getBaseUrl(): string {
  const base = env.LMSTUDIO_BASE_URL.replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.LMSTUDIO_API_KEY,
      baseURL: getBaseUrl(),
      timeout: env.LMSTUDIO_TIMEOUT_MS,
    });
  }

  return client;
}

function getLmStudioErrorMessage(error: unknown): string | undefined {
  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    error?: { message?: string };
  };

  if (err.status === 404) {
    return "LM Studio returned 404 — verify LMSTUDIO_BASE_URL and that the model is loaded in LM Studio";
  }

  if (err.status === 503 || err.code === "ECONNREFUSED") {
    return "Cannot reach LM Studio — is the server running at LMSTUDIO_BASE_URL?";
  }

  return err.error?.message ?? err.message;
}

/**
 * Calls LM Studio's OpenAI-compatible /v1/chat/completions endpoint with a text
 * prompt and one or more base64-encoded JPEG images.
 */
export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  logger.debug(
    {
      baseUrl: getBaseUrl(),
      model: env.LMSTUDIO_MODEL,
      imageCount: images.length,
      promptLength: prompt.length,
      timeoutMs: env.LMSTUDIO_TIMEOUT_MS,
    },
    "Calling LM Studio"
  );

  try {
    const response = await getClient().chat.completions.create({
      model: env.LMSTUDIO_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((image) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${image}` },
            })),
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LM Studio returned an empty response");
    }

    return content.trim();
  } catch (error) {
    const apiMessage = getLmStudioErrorMessage(error);

    logger.error(
      {
        error,
        model: env.LMSTUDIO_MODEL,
        imageCount: images.length,
        promptLength: prompt.length,
        timeoutMs: env.LMSTUDIO_TIMEOUT_MS,
        apiMessage,
      },
      "LM Studio request failed"
    );

    throw new Error(
      apiMessage
        ? `Failed to generate description from the vision model: ${apiMessage}`
        : "Failed to generate description from the vision model"
    );
  }
}
