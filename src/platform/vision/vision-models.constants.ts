export const VISION_MODEL_OPTIONS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
] as const;

export type VisionModelId = (typeof VISION_MODEL_OPTIONS)[number]["id"];

const ALLOWED_MODEL_IDS = new Set<string>(
  VISION_MODEL_OPTIONS.map((option) => option.id)
);

/** Maps OpenRouter-style IDs to ATXP bare slugs when using VISION_PROVIDER=atxp */
const OPENROUTER_TO_ATXP_MODEL: Record<string, string> = {
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "openai/gpt-4o": "gpt-4o",
  "anthropic/claude-sonnet-4": "claude-sonnet-4",
};

export function isAllowedVisionModel(model: string): boolean {
  return ALLOWED_MODEL_IDS.has(model);
}

export function resolveVisionModelForProvider(
  provider: string,
  model: string
): string {
  if (provider === "atxp") {
    return OPENROUTER_TO_ATXP_MODEL[model] ?? model;
  }

  return model;
}
