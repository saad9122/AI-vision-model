import { env } from "../config/env";
import { generateDescription as atxpGenerateDescription } from "./atxp.service";
import { generateDescription as geminiGenerateDescription } from "./gemini.service";
import { generateDescription as lmstudioGenerateDescription } from "./lmstudio.service";
import { generateDescription as ollamaGenerateDescription } from "./ollama.service";
import { generateDescription as openaiGenerateDescription } from "./openai.service";

export async function generateDescription(
  prompt: string,
  images: string[]
): Promise<string> {
  switch (env.VISION_PROVIDER) {
    case "lmstudio":
      return lmstudioGenerateDescription(prompt, images);
    case "openai":
      return openaiGenerateDescription(prompt, images);
    case "gemini":
      return geminiGenerateDescription(prompt, images);
    case "atxp":
      return atxpGenerateDescription(prompt, images);
    case "ollama":
      return ollamaGenerateDescription(prompt, images);
    default:
      return lmstudioGenerateDescription(prompt, images);
  }
}

export function getActiveVisionProviderLabel(): string {
  switch (env.VISION_PROVIDER) {
    case "lmstudio":
      return `lmstudio (${env.LMSTUDIO_MODEL})`;
    case "openai":
      return `openai (${env.OPENAI_MODEL})`;
    case "gemini":
      return `gemini (${env.GEMINI_MODEL})`;
    case "atxp":
      return `atxp (${env.ATXP_MODEL})`;
    case "ollama":
      return `ollama (${env.OLLAMA_MODEL})`;
    default:
      return `lmstudio (${env.LMSTUDIO_MODEL})`;
  }
}
