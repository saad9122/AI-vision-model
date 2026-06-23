import type { UserModelMessage } from "ai";
import { buildVisionPrompt } from "./vision-content.service";
import { usesImagesFirstContentOrder } from "./vision-model.factory";

export function buildVisionMessages(
  prompt: string,
  images: string[]
): UserModelMessage[] {
  const imagesFirst = usesImagesFirstContentOrder();
  const finalPrompt = imagesFirst ? buildVisionPrompt(prompt, images.length) : prompt;

  const imageParts = images.map((image) => ({
    type: "image" as const,
    image: `data:image/jpeg;base64,${image}`,
  }));

  const textPart = { type: "text" as const, text: finalPrompt };
  const content = imagesFirst ? [...imageParts, textPart] : [textPart, ...imageParts];

  return [{ role: "user", content }];
}
