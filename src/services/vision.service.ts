import { env } from "../config/env";
import { generateDescription as geminiGenerateDescription } from "./gemini.service";
import { generateDescription as ollamaGenerateDescription } from "./ollama.service";
import { generateDescription as openaiGenerateDescription } from "./openai.service";

export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  switch (env.VISION_PROVIDER) {
    case "openai":
      return openaiGenerateDescription(prompt, images);
    case "gemini":
      return geminiGenerateDescription(prompt, images);
    default:
      return ollamaGenerateDescription(prompt, images);
  }
}

export function getActiveVisionProviderLabel(): string {
  switch (env.VISION_PROVIDER) {
    case "openai":
      return `openai (${env.OPENAI_MODEL})`;
    case "gemini":
      return `gemini (${env.GEMINI_MODEL})`;
    default:
      return `ollama (${env.OLLAMA_MODEL})`;
  }
}
