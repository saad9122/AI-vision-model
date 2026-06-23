export function normalizeItemName(itemName: string): string {
  return itemName.trim().replace(/\s+/g, " ");
}

export function isRoomOverviewItem(itemName: string): boolean {
  return normalizeItemName(itemName).toLowerCase() === "general overview";
}

// ---------------------------------------------------------------------------
// Vocabulary reference for issue detection (suggestions only — agent may use
// better wording as appropriate).
// ---------------------------------------------------------------------------
export const ITEM_NOTES_DICTIONARY = {
  cleanliness: ["Dirty", "Dusty", "Grimy", "Stained", "Marked", "Lightly soiled", "Heavily soiled"],
  surface_damage: ["Scratched", "Light scratches", "Heavy scratches", "Scuffed", "Scuff marks", "Dented", "Chipped", "Cracked", "Hairline crack", "Large crack", "Gouged", "Abraded", "Pitted", "Indented"],
  paint_finish_condition: ["Peeling", "Flaking", "Bubbling", "Blistering", "Faded", "Discoloured", "Yellowed", "Marked", "Scuffed paint", "Paint splashes", "Uneven coverage", "Touch-ups visible", "Patchy", "Chalking"],
  structural_issues: ["Broken", "Cracked", "Split", "Warped", "Bowed", "Sagging", "Twisted", "Misaligned", "Collapsed"],
  water_damage: ["Water stained", "Water marked", "Water damage", "Damp patch", "Damp staining", "Mould present", "Mildew", "Tide marks", "Condensation damage", "Leak staining"],
  wear_patterns: ["Worn", "Heavily worn", "Lightly worn", "Frayed", "Threadbare", "Balding", "Flattened", "Compressed", "Traffic wear", "High traffic wear", "Uneven wear", "Age-related wear"],
  holes_tears: ["Hole", "Small hole", "Large hole", "Pin holes", "Nail holes", "Screw holes", "Tear", "Small tear", "Large tear", "Rip", "Split seam", "Missing section"],
  stains_marks: ["Stained", "Light staining", "Heavy staining", "Ink stain", "Grease stain", "Oil stain", "Rust stain", "Food stain", "Beverage stain", "Paint marks", "Pen marks", "Scuff marks", "Burn mark", "Heat mark", "Ring mark"],
  adhesive_residue: ["Blu-tack marks", "Tape residue", "Adhesive residue", "Sticky residue", "Glue marks", "Poster marks", "Picture hooks", "Command strip residue"],
  missing_damaged_parts: ["Missing", "Incomplete", "Broken", "Snapped", "Bent", "Cracked", "Shattered", "Damaged"],
  fit_alignment: ["Poorly fitted", "Loose fit", "Gaps visible", "Uneven", "Misaligned", "Skewed", "Crooked", "Sloping", "Not flush", "Proud", "Recessed", "Out of level"],
  grout_sealant: ["Grout missing", "Grout cracked", "Grout discoloured", "Grout mouldy", "Sealant missing", "Sealant cracked", "Sealant peeling", "Sealant discoloured", "Sealant mouldy", "Poor grouting", "Poor sealing"],
  tile_condition: ["Tile cracked", "Tile chipped", "Tile loose", "Tile missing", "Tile stained", "Tile discoloured"],
  wood_specific: ["Rotten", "Decayed", "Insect damage", "Splintered", "Knot holes", "Veneer lifting", "Veneer bubbling", "Delaminating"],
  hardware_condition: ["Rusty", "Corroded", "Tarnished", "Oxidised", "Missing screws"],
};

// ---------------------------------------------------------------------------
// Shared style rules
// ---------------------------------------------------------------------------

const INVENTORY_TONE = `Tone: UK property inventory style — objective, factual, concise. No markdown, headings, or bullet points. Plain prose only.`;

const GENERAL_OUTPUT_RULES = `Output rules:
- Short factual clauses: colour/material + element (+ type, style, or finish where clearly visible).
- Separate clauses with full stops.
- Do NOT include condition or cleanliness summaries — never use phrases such as "in good condition", "in good clean condition", "in good order", "in working order", "it is in good condition", or similar. Condition and cleanliness are captured separately as ratings.
- Do NOT describe defects, damage, dirt, wear, or maintenance needs — those belong in the issues report only.
- Omit anything not clearly visible. Do not mention AI or images.`;

const ROOM_OVERVIEW_GENERAL_OUTPUT_RULES = `Output rules:
- One short clause per visible fixture/fitting/surface: colour/material + element (+ type, style, or finish where clearly visible).
- Separate clauses with full stops.
- Do NOT include condition or cleanliness summaries — never use phrases such as "in good condition", "in good clean condition", "in good order", "with minor defects", "with surface defects", or similar. Ratings and issues are captured separately.
- Light fittings: include type where visible (e.g. "pendant type light fitting").
- Omit anything not clearly visible. Do not mention AI or images.`;

const ITEM_FOCUS = (itemName: string, roomName: string) => `Scope:
- Room: "${roomName}" — context only. Do NOT describe the room.
- Item: "${itemName}" — the ONLY subject. All images show the SAME "${itemName}" from different angles.
- Ignore any other fixtures, fittings, or surfaces visible in the background.`;

// ---------------------------------------------------------------------------
// Issue detection — shared building blocks
// ---------------------------------------------------------------------------

const VOCABULARY_GUIDANCE = `Vocabulary guidance (suggestions — use better words if more accurate):
- Cleanliness: Dirty, Dusty, Grimy, Stained, Marked, Lightly/Heavily soiled
- Surface damage: Scratched, Scuffed, Dented, Chipped, Cracked (Hairline/Large), Gouged, Abraded
- Paint/finish: Peeling, Flaking, Bubbling, Faded, Discoloured, Scuffed paint, Paint splashes, Patchy
- Structural: Broken, Split, Warped, Bowed, Sagging, Misaligned
- Water damage: Water stained, Damp patch, Damp staining, Mould present, Tide marks, Leak staining
- Wear: Worn, Heavily worn, Frayed, Threadbare, Traffic wear, Uneven wear
- Holes/tears: Hole (Small/Large), Pin holes, Nail holes, Tear, Rip, Missing section
- Stains/marks: Light/Heavy staining, Grease stain, Rust stain, Burn mark, Ring mark, Pen marks
- Adhesive: Blu-tack marks, Tape residue, Adhesive residue, Command strip residue, Picture hooks
- Missing/broken parts: Missing, Incomplete, Snapped, Bent, Shattered
- Fit/alignment: Loose fit, Gaps visible, Misaligned, Crooked, Not flush, Out of level
- Grout/sealant: Grout missing/cracked/discoloured/mouldy, Sealant missing/cracked/peeling/mouldy
- Tiles: Tile cracked/chipped/loose/missing/stained
- Wood: Rotten, Splintered, Veneer lifting, Delaminating
- Hardware: Rusty, Corroded, Tarnished, Missing screws`;

const MOULD_LIMESCALE = `Mould and limescale — only report if clearly and unambiguously visible:
- Limescale: white/grey/chalky crusty buildup on taps, shower heads, plugs, drains, glass, tiles, toilet bowls. Must be distinctly visible as a physical deposit — do NOT report based on slight discolouration, lighting variation, or image artefacts.
- Mould/mildew: black/dark-green/grey/brown speckled or fuzzy patches in grout lines, silicone sealant, corners, ceiling edges, window frames, tile edges, damp areas. Must be clearly identifiable fungal growth — do NOT report shadows, normal surface variation, or ambiguous dark patches as mould. If uncertain, omit.`;

const DOORS_WOODWORK = `Doors, woodwork, and painted surfaces — inspect face, edges, frame, and hardware:
- Stains, marks, scuffs, chips, dents, cracks, splits, holes, impact damage
- Worn paint, paint loss, scratches
- Damaged, loose, missing, or faulty handles, hinges, locks, latches`;

const ISSUES_CHECKLIST = `Systematic inspection — only report defects that are clearly and confidently visible. If you cannot be certain a defect exists, omit it.

${MOULD_LIMESCALE}

Additional issues (report only if unambiguously present):
- Damage: cracks, holes, dents, chips, scratches, scuffs, broken or missing parts
- Paint/surface: peeling, bubbling, flaking, discolouration, marks, drawn/scribble marks
- Attachments: stickers, labels, tape, blu-tack, adhesive residue, pins, nails, hooks
- Stains, grease, dust build-up, rust, water/damp staining
- Cleanliness failures
- Malfunctions: broken, missing, loose, or non-working fittings, bulbs, handles, hinges, appliances
${DOORS_WOODWORK}`;

function getIssuesOutputRules(itemName?: string): string {
  const subject = itemName ? normalizeItemName(itemName).toLowerCase() : null;
  const itemPhrase = subject ?? "door";
  const combineExample = `"Stains and scuff marks to ${itemPhrase}"`;
  const fallbackExample = `"Defects to ${itemPhrase}"`;

  return `Issue detection process:
1. Identify each visible defect clearly. Ask yourself: is this defect unambiguously present, or could it be a shadow, lighting effect, or image artefact? If uncertain — omit it.
2. Select the most accurate description from the vocabulary guidance above (or use your own words if more precise).
3. Write a concise UK inventory phrase: defect + location (e.g. "Scuff marks to door face", "Mould to grout lines").

Output rules (plain prose only):
- Only report what you can see clearly and confidently. Do NOT speculate or infer defects from ambiguous visual information.
- Report each distinct defect once. Do NOT repeat the same issue in different words.
- Combine similar surface marks into ONE phrase — e.g. ${combineExample}.
- If defect type is unclear, use ONE fallback phrase — e.g. ${fallbackExample}. Do not also list vague marks separately.
- Separate DIFFERENT defects with a semicolon and space — e.g. "Stains and scuff marks to ${itemPhrase}; Chip to ${itemPhrase} edge."
- Each issue phrase starts with a capital letter. No run-on text without a semicolon between issues.
- Lowercase for item names within each phrase (e.g. "door", "wall", "flooring").
- If no visible defects: respond with "No visible issues were identified." only.
- Do NOT invent or assume issues. Do NOT use markdown, headings, or bullet points. Do NOT mention AI or images.`;
}

function getDoorWoodworkIssueHints(itemName: string): string {
  const item = normalizeItemName(itemName).toLowerCase();
  if (!/\b(door|doors|woodwork|skirting|architrave|frame|cupboard door)\b/.test(item)) return "";
  return `Focus for "${itemName}": inspect full face, edges, frame, and hardware for stains, marks, scuffs, chips, dents, cracks, and damage. Only report defects that are clearly present — do not report normal surface texture or shadows as damage. Combine similar surface marks into one phrase (e.g. "Stains and scuff marks to door"); separate distinct defects with a semicolon (e.g. "Stains and scuff marks to door; Chip to door edge"). Use "Defects to door" only if the defect type is unclear.`;
}

function getWetAreaIssueHints(itemName: string, roomName: string): string {
  const item = normalizeItemName(itemName).toLowerCase();
  const room = roomName.trim().toLowerCase();
  const wetItemPattern = /\b(tap|taps|sink|bath|bathtub|shower|toilet|wc|basin|tile|tiles|grout|sealant|splashback|plug|drain|radiator|extractor|sanitary|sanitaryware)\b/;
  const wetRoomPattern = /\b(bathroom|toilet|en-?suite|ensuite|wet room|utility|kitchen|shower room)\b/;
  if (!wetItemPattern.test(item) && !wetRoomPattern.test(room)) return "";
  return `Wet-area focus for "${itemName}" in "${roomName}": check for limescale on metal fittings, glass, tiles, plugs, and drains; and mould on grout, silicone sealant, corners, tile edges, and damp-stained surfaces. Only report if the defect is clearly and unambiguously visible — do not report discolouration or shadows as mould or limescale unless the evidence is definitive.`;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for a plain, factual description of a single room item.
 */
export function buildGeneralPrompt(roomName: string, itemName: string, imageCount: number): string {
  const normalizedItem = normalizeItemName(itemName);
  const imageNote = imageCount > 1
    ? `${imageCount} images showing the SAME "${normalizedItem}" from different angles — combine them to describe this one item.`
    : `1 image of the "${normalizedItem}" in the "${roomName}".`;

  return `You are a professional property inspector writing a factual inventory entry for one specific room item.

${imageNote}

${ITEM_FOCUS(normalizedItem, roomName)}

Describe the "${normalizedItem}": type/style, material, colour, and finish only — factual identification, not condition.
Example (Window, Living Room): "White UPVC window and sill."

${INVENTORY_TONE}
${GENERAL_OUTPUT_RULES}`;
}

/**
 * Builds the prompt for an issue/defect report for a single room item.
 */
export function buildIssuesPrompt(roomName: string, itemName: string, imageCount: number): string {
  const normalizedItem = normalizeItemName(itemName);
  const imageNote = imageCount > 1
    ? `${imageCount} images of the SAME "${normalizedItem}" from different angles — an issue only needs to be visible in one image.`
    : `1 image of the "${normalizedItem}" in the "${roomName}".`;

  const wetAreaHints = getWetAreaIssueHints(normalizedItem, roomName);
  const doorHints = getDoorWoodworkIssueHints(normalizedItem);
  const itemHints = [doorHints, wetAreaHints].filter(Boolean).join("\n\n");

  return `You are a professional property inspector performing a visual condition assessment for one specific room item.

${imageNote}

${ITEM_FOCUS(normalizedItem, roomName)}

Examine the "${normalizedItem}" in the "${roomName}" for visible defects only. Do not report issues on any other item visible in the image.

${itemHints ? `${itemHints}\n\n` : ""}${ISSUES_CHECKLIST}

${VOCABULARY_GUIDANCE}

${getIssuesOutputRules(normalizedItem)}`;
}

/**
 * Builds the prompt for a full-room inventory description.
 */
export function buildRoomOverviewGeneralPrompt(roomName: string, imageCount: number): string {
  const imageNote = imageCount > 1
    ? `${imageCount} images showing different areas or views of the "${roomName}" — inspect every image holistically and combine into one deduplicated inventory.`
    : `1 image of the "${roomName}".`;

  return `You are a professional property inspector writing a general overview inventory of the "${roomName}".

${imageNote}

Act as an overall evaluator: review all images together before writing. Deduplicate items seen from multiple angles — describe each fixture, fitting, or surface only once.

List every visible fixture, fitting, and surface. Include where visible: woodwork, ceiling, walls, flooring, doors, windows, blinds, light fittings, radiators, sockets and switches, sanitaryware, cupboards, worktops, splashbacks, appliances, and any other fixed elements. Omit anything not clearly visible.

Example: "White painted wooden door. White painted ceiling. Pendant type light fitting. UPVC window and sill. White painted walls. Brown carpeted flooring. White radiator. White sockets and switches."

${INVENTORY_TONE}
${ROOM_OVERVIEW_GENERAL_OUTPUT_RULES}`;
}

/**
 * Builds the prompt for a room-level issue/defect report.
 */
export function buildRoomOverviewIssuesPrompt(roomName: string, imageCount: number): string {
  const imageNote = imageCount > 1
    ? `${imageCount} images showing different areas or views of the "${roomName}" — an issue only needs to be visible in one image.`
    : `1 image of the "${roomName}".`;

  const wetAreaHints = getWetAreaIssueHints("General Overview", roomName);

  return `You are a professional property inspector performing a visual condition assessment of the "${roomName}".

${imageNote}

This is an ISSUES-ONLY report. Identify and report visible defects only — do not describe overall appearance or write condition summaries. Examine every fixture, fitting, and surface visible across all images systematically.

${wetAreaHints ? `${wetAreaHints}\n\n` : ""}${ISSUES_CHECKLIST}

${VOCABULARY_GUIDANCE}

${getIssuesOutputRules()}`;
}

const RATING_BAND_GUIDANCE = `Rating bands (use the exact string value):
- "excellent": Like new — no visible wear, damage, or soiling
- "good": Minor wear or light soiling from normal use; fully serviceable
- "fair": Visible wear, minor damage, or noticeable soiling — still serviceable but attention may be needed
- "poor": Significant damage, wear, or soiling affecting appearance or function
- "unacceptable": Severe damage, broken, or heavily soiled — requires immediate attention
- "N/A": Cannot be assessed from the images provided

Condition and cleanliness are independent:
- Condition = physical state (damage, wear, functionality, defects)
- Cleanliness = dirt, dust, stains, grime, soiling`;

const RATINGS_JSON_OUTPUT_RULES = `Output rules:
- Respond with JSON only — no markdown, prose, or explanation
- Use exactly this shape: {"condition":{"rating":"<value>"},"cleanliness":{"rating":"<value>"}}
- Each rating must be one of: "excellent", "good", "fair", "poor", "unacceptable", "N/A"`;

/**
 * Builds the prompt for structured condition and cleanliness ratings of a single room item.
 */
export function buildItemRatingsPrompt(
  roomName: string,
  itemName: string,
  imageCount: number
): string {
  const normalizedItem = normalizeItemName(itemName);
  const imageNote =
    imageCount > 1
      ? `${imageCount} images showing the SAME "${normalizedItem}" from different angles — combine them to assess this one item.`
      : `1 image of the "${normalizedItem}" in the "${roomName}".`;

  return `You are a professional property inspector rating the general condition and cleanliness of one specific room item for a UK property inventory.

${imageNote}

${ITEM_FOCUS(normalizedItem, roomName)}

Assess the "${normalizedItem}" only. Ignore any other fixtures or surfaces visible in the background.

${RATING_BAND_GUIDANCE}

${RATINGS_JSON_OUTPUT_RULES}`;
}

/**
 * Builds the prompt for structured whole-room condition and cleanliness ratings.
 */
export function buildRoomOverviewRatingsPrompt(
  roomName: string,
  imageCount: number
): string {
  const imageNote =
    imageCount > 1
      ? `${imageCount} images showing different areas or views of the "${roomName}" — inspect every image holistically before rating.`
      : `1 image of the "${roomName}".`;

  return `You are a professional property inspector rating the overall general condition and cleanliness of the "${roomName}" for a UK property inventory.

${imageNote}

Act as an overall evaluator: review all images together before rating. Deduplicate views of the same area.

Produce ONE overall room condition rating and ONE overall room cleanliness rating synthesised across all visible fixtures, fittings, and surfaces (walls, ceiling, flooring, doors, windows, sanitaryware, appliances, etc.).

Guidance:
- Weigh the worst clearly visible areas, but minor localised issues should not automatically downgrade the whole room unless they materially affect the overall impression
- Do not rate individual items separately — give a single holistic room assessment

${RATING_BAND_GUIDANCE}

${RATINGS_JSON_OUTPUT_RULES}`;
}

const INVENTORY_ITEM_VOCABULARY = `Standard UK inventory room-item labels (use these exact names where applicable):
Doors, Walls, Flooring, Ceiling, Lighting, Windows, Curtains/Blinds, Switches/Sockets, Skirting/Architrave, Radiator/Heating, Kitchen Units, Worktop, Oven/Hob/Extractor, Fridge/Freezer, Sink/Taps, Washing Machine, Bath/Shower, Shower Screen/Curtain, Toilet, Cupboards, Splashback, Appliances, Blinds, Woodwork`;

const DETECTED_ITEMS_JSON_OUTPUT_RULES = `Output rules:
- Respond with JSON only — no markdown, prose, or explanation
- Use exactly this shape: {"items":["Doors","Walls","Flooring"]}
- Each entry must be a standard inventory room-item label from the vocabulary above
- Do NOT include "General Overview"
- Deduplicate — list each distinct item type once
- Only include items clearly visible in the images`;

/**
 * Builds the prompt for detecting standard inventory room items visible in a room overview.
 */
export function buildRoomOverviewDetectedItemsPrompt(
  roomName: string,
  imageCount: number
): string {
  const imageNote =
    imageCount > 1
      ? `${imageCount} images showing different areas or views of the "${roomName}" — inspect every image holistically before listing items.`
      : `1 image of the "${roomName}".`;

  return `You are a professional property inspector identifying fixed fixtures, fittings, and surfaces visible in the "${roomName}" for a UK property inventory.

${imageNote}

Act as an overall evaluator: review all images together before listing. Deduplicate items seen from multiple angles.

List every visible inventory room-item type using standard template labels. Include where clearly visible: woodwork, ceiling, walls, flooring, doors, windows, blinds, light fittings, radiators, sockets and switches, sanitaryware, cupboards, worktops, splashbacks, appliances, and other fixed elements.

${INVENTORY_ITEM_VOCABULARY}

${DETECTED_ITEMS_JSON_OUTPUT_RULES}`;
}

export function buildPrompts(roomName: string, itemName: string, imageCount: number) {
  const overview = isRoomOverviewItem(itemName);

  return {
    general: overview
      ? buildRoomOverviewGeneralPrompt(roomName, imageCount)
      : buildGeneralPrompt(roomName, itemName, imageCount),
    issues: overview
      ? buildRoomOverviewIssuesPrompt(roomName, imageCount)
      : buildIssuesPrompt(roomName, itemName, imageCount),
    ratings: overview
      ? buildRoomOverviewRatingsPrompt(roomName, imageCount)
      : buildItemRatingsPrompt(roomName, itemName, imageCount),
    detectedItems: overview
      ? buildRoomOverviewDetectedItemsPrompt(roomName, imageCount)
      : null,
  };
}