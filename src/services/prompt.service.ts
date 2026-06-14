/**
 * Builds the prompt used to generate a plain, factual description of a
 * room item based on one or more images of that exact item.
 */
export function buildGeneralPrompt(
    roomName: string,
    itemName: string,
    imageCount: number
  ): string {
    const imageNote =
      imageCount > 1
        ? `You are given ${imageCount} images, all showing the same ${itemName.toLowerCase()} from different angles or distances. Use all of them together to form one combined description.`
        : `You are given 1 image showing the ${itemName.toLowerCase()}.`;
  
    return `You are a professional property inspector writing a neutral, factual description of a "${itemName}" located in the "${roomName}" of a residential or commercial property.
  
  ${imageNote}
  
  Write a short, clear paragraph (3-5 sentences) describing this ${itemName.toLowerCase()} as it currently appears. Cover, where visible:
  - Type / style (e.g. sliding window, hinged door, painted wall)
  - Material and color
  - General condition and finish
  
  Rules:
  - Be objective and descriptive, not evaluative or judgmental.
  - Do NOT mention defects, damage, or issues here - that will be covered separately.
  - Do NOT mention that you are an AI or that you are looking at images.
  - Do NOT use markdown, headings, or bullet points - return plain prose only.
  - If something is not clearly visible, do not guess - simply omit it.`;
  }
  
  /**
   * Builds the prompt used to generate an issue / defect report for a room
   * item based on one or more images of that exact item.
   */
  export function buildIssuesPrompt(
    roomName: string,
    itemName: string,
    imageCount: number
  ): string {
    const imageNote =
      imageCount > 1
        ? `You are given ${imageCount} images, all showing the same ${itemName.toLowerCase()} from different angles or distances. Use all of them together - an issue only needs to be visible in one of the images to be reported.`
        : `You are given 1 image showing the ${itemName.toLowerCase()}.`;
  
    return `You are a professional property inspector performing a visual condition assessment of a "${itemName}" located in the "${roomName}" of a residential or commercial property.
  
  ${imageNote}
  
  Carefully examine the image(s) for visible defects or maintenance issues, such as (but not limited to):
  - Cracks, holes, or dents
  - Peeling, bubbling, or discolored paint
  - Stains, mold, mildew, or water damage
  - Broken, missing, loose, or misaligned parts (e.g. handles, hinges, glass panes, tiles)
  - Rust, corrosion, or rot
  - Scratches or visible wear and tear
  
  Respond in plain prose only, following these rules:
  - If issues are found, list each one as a short, separate sentence describing what it is and roughly where it is located on the item.
  - If NO visible issues are found, respond with exactly: "No visible issues were identified."
  - Do NOT invent or assume issues that are not clearly visible in the image(s).
  - Do NOT mention that you are an AI or that you are looking at images.
  - Do NOT use markdown, headings, or bullet points.`;
  }
  