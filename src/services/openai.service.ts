import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../config/logger";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
    });
  }

  return client;
}

/**
 * Calls OpenAI Chat Completions with a text prompt and one or more
 * base64-encoded JPEG images. Returns the trimmed text response from the model.
 */
export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  try {
    const response = await getClient().chat.completions.create({
      model: env.OPENAI_MODEL,
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
      throw new Error("OpenAI returned an empty response");
    }

    return content.trim();
  } catch (error) {
    logger.error({ error }, "OpenAI request failed");
    throw new Error("Failed to generate description from the vision model");
  }
}
