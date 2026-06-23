const MULTI_IMAGE_EVALUATOR_SUFFIX =
  "\n\nReview all images above together as an overall evaluator before responding. Combine information from every image; do not describe only the last image.";

export function buildVisionPrompt(prompt: string, imageCount: number): string {
  return imageCount > 1 ? `${prompt}${MULTI_IMAGE_EVALUATOR_SUFFIX}` : prompt;
}
