import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../config/logger";

const ATXP_LLM_BASE_URL = "https://llm.atxp.ai/v1";

let client: OpenAI | null = null;

function getConnectionString(): string {
  const connection = env.ATXP_CONNECTION ?? env.AXTP_TOKEN;
  if (!connection) {
    throw new Error("ATXP_CONNECTION or AXTP_TOKEN is not configured");
  }

  return connection;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: getConnectionString(),
      baseURL: ATXP_LLM_BASE_URL,
      timeout: env.ATXP_TIMEOUT_MS,
    });
  }

  return client;
}

function getAtxpErrorMessage(error: unknown): string | undefined {
  const err = error as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };

  return err.error?.message ?? err.message;
}

/**
 * Calls the ATXP LLM Gateway (OpenAI-compatible) with a text prompt and one or
 * more base64-encoded JPEG images. Model is selected via ATXP_MODEL in env.
 */
export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  try {
    const response = await getClient().chat.completions.create({
      model: env.ATXP_MODEL,
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
      throw new Error("ATXP LLM Gateway returned an empty response");
    }

    return content.trim();
  } catch (error) {
    const apiMessage = getAtxpErrorMessage(error);
    logger.error(
      { error, model: env.ATXP_MODEL, apiMessage },
      "ATXP LLM Gateway request failed"
    );

    if (apiMessage?.includes("no longer available")) {
      throw new Error(
        `ATXP model "${env.ATXP_MODEL}" is no longer available. Update ATXP_MODEL (e.g. gemini-2.5-flash or gpt-4o).`
      );
    }

    throw new Error(
      apiMessage
        ? `Failed to generate description from the vision model: ${apiMessage}`
        : "Failed to generate description from the vision model"
    );
  }
}