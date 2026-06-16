export function normalizeItemName(itemName: string): string {
  return itemName.trim().replace(/\s+/g, " ");
}

export function isRoomOverviewItem(itemName: string): boolean {
  return normalizeItemName(itemName).toLowerCase() === "general overview";
}

const GENERAL_INVENTORY_RULES = `Use UK property inventory / check-out report tone. Be objective and factual, not conversational.

Output format:
- Plain prose only — no markdown, headings, or bullet points.
- Write short clauses in the pattern: colour/material + element + overall appearance.
- Separate clauses with periods or spaces, matching a professional inventory report.
- Describe only what is visible: type/style, material, colour, finish, and overall appearance.
- Use neutral condition vocabulary such as: "in good clean condition", "in good condition", "in good order", "in working order".
- Do NOT mention defects, damage, stains, dirt, dust, grease, wear, scuffs, malfunctions, maintenance needs, or cleanliness failures — those belong only in a separate issues report.
- Do NOT mention that you are an AI or that you are looking at images.
- If something is not clearly visible, do not guess — simply omit it.`;

const ROOM_OVERVIEW_GENERAL_RULES = `Use UK property inventory / check-out report tone. Be objective and factual, not conversational.

Output format:
- Plain prose only — no markdown, headings, or bullet points.
- Write one short clause per visible fixture, fitting, or surface.
- Pattern: colour/material + element + condition (+ brief inline defect note when visible).
- Separate clauses with periods or spaces.

Assess each element individually — do NOT default everything to "good clean condition":
- If no defects are visible: use "in good clean condition", "in good condition", or "in good order".
- If minor defects ARE visible: note them inline using phrases such as "with minor defects", "with surface defects", or "with minor defects as noted".
- For light fittings, include type where visible (e.g. "Light fitting pendant type") and note obvious faults inline (e.g. "with missing bulb").

Keep inline defect notes brief — do not write a detailed issue list here. Full defect reporting belongs in the separate issues report.
- Do NOT mention that you are an AI or that you are looking at images.
- If something is not clearly visible, do not guess — simply omit it.`;

const ROOM_OVERVIEW_ISSUES_INTRO = `This is an ISSUES-ONLY report for the general room overview. Your sole task is to identify and report visible defects — do not describe overall appearance or write condition summaries.

Look specifically for issues across every fixture, fitting, and surface visible in the room. Examine each area of the image(s) systematically before responding.`;

const ITEM_FOCUS_RULES = (itemName: string, roomName: string) => `Single-item job — this is critical:
- Room: "${roomName}" — location context only. Do not describe the whole room.
- Item: "${itemName}" — the ONLY subject. Every word must be about this item.
- All images show the SAME "${itemName}" (different angles or distances). This is NOT a general overview.
- Do NOT list or describe any other fixture, fitting, or surface (ceiling, walls, flooring, door, etc.) unless it is part of the "${itemName}" itself.
- If other room items appear in the background, ignore them completely.`;

const ROOM_OVERVIEW_ITEM_FOCUS = (itemName: string, roomName: string) => `General overview step — describe one item only:
- Room: "${roomName}"
- Item for this step: "${itemName}" — describe ONLY this item in your response.
- Images may show different room items across the set. Ignore every other item and write one clause for the "${itemName}" only.`;

const MOULD_LIMESCALE_GUIDANCE = `Mould and limescale — inspect these carefully before responding (they are often missed):

Limescale (hard water deposits):
- Looks like white, grey, off-white, or chalky crusty buildup
- Common on taps, shower heads, plug holes, drains, glass, tiles, toilet bowls, kettles, and around water outlets
- Can appear as cloudy haze, rough crust, or layered mineral rings
- Report even if light or patchy, e.g. "Limescale to tap", "Limescale build-up to shower head", "Limescale to plug hole"

Mould / mildew (fungal growth):
- Looks like black, dark green, grey, brown, or speckled patches — often fuzzy or spotty
- Common in grout lines, silicone sealant, corners, ceiling edges, window frames, tile edges, behind sanitaryware, and any damp/stained area
- Report even if small, faint, or only partial, e.g. "Mould to grout", "Black mould to sealant", "Mould spotting to ceiling corner"
- Do not confuse mould with dirt — if fungal spotting or discolouration in damp areas is visible, report it`;

const DOORS_AND_WOODWORK_GUIDANCE = `Doors, woodwork, and painted surfaces — inspect the full face, edges, frame, and hardware:
- Stains and marks: discolouration, dark patches, finger marks, scuff marks, water marks, or any marking that differs from the surrounding finish
- Damage: dents, chips, cracks, splits, holes, impact damage, warping, or broken panels
- Surface wear: scratches, scuffs, worn paint, rubbed areas, or paint loss
- Hardware faults: damaged, loose, missing, or faulty handles, hinges, locks, or latches
- Report even if light or localised — but describe each distinct defect once only`;

const ISSUES_INSPECTION_CATEGORIES = `Systematically scan the entire subject — full face, edges, corners, frame, hardware, joints, sealant, grout, fittings, and water-contact areas — then check for ALL of the following:

${MOULD_LIMESCALE_GUIDANCE}

Other issues to report:
- Damage: cracks, holes, dents, chips, scratches, scuffs, broken or missing parts
- Paint and surface finish: peeling, bubbling, flaking, discolouration, marks, drawn or scribble marks
- Attachments and alterations: stickers, stick-ons, labels, posters, tape, blu-tack, adhesive residue, pins, nails, hooks
- Stains, grease, dust build-up, rust, and water damage / damp staining
- Cleanliness failures: surfaces or items that are dirty or unclean
- Malfunctions: broken, missing, loose, or non-working fittings, bulbs, handles, hinges, or appliances

${DOORS_AND_WOODWORK_GUIDANCE}`;

function getIssuesOutputRules(itemName?: string): string {
  const subject = itemName ? normalizeItemName(itemName).toLowerCase() : null;
  const itemPhrase = subject ?? "door";
  const combineExample = subject
    ? `"Stains and scuff marks to ${subject}"`
    : `"Stains and scuff marks to door"`;
  const fallbackExample = subject
    ? `"Defects to ${subject}"`
    : `"Defects to door"`;

  return `Respond in plain prose only.

Writing style — follow strictly:
- Use short, natural UK inventory phrases that a property clerk would write.
- Report each distinct defect once only. Do NOT repeat the same issue in different words.
- If several similar surface marks are visible (stains, scuffs, marks), combine into ONE phrase — e.g. ${combineExample}.
- If you cannot tell what the defect is, use ONE fallback phrase only — e.g. ${fallbackExample}. Do not also list stains, scuffs, and marks separately.
- Separate different defects with a full stop and space — e.g. "${subject ? `Stains and scuff marks to ${subject}. Chip to ${subject} edge` : "Stains and scuff marks to door. Chip to door edge"}."
- Use lowercase for item names in phrases (e.g. "door", "wall", "flooring").
- Do NOT output run-on text without punctuation — e.g. "Scuff marks to door Stains to door" is WRONG.

Good examples:
- ${combineExample}
- ${subject ? `"Damage to ${subject}"` : `"Damage to door"`}
- ${fallbackExample} (only when the defect type is unclear)
- ${subject ? `"Chip to ${itemPhrase} edge. Loose handle"` : `"Chip to door edge. Loose handle"`}

Bad examples (never write like this):
- "Scuff marks to Door Stains to Door"
- "Stains to door. Scuff marks to door. Marks to door" (same issue repeated)

Rules:
- If ANY issue is visible, report it — but concisely and without duplication.
- Respond with "No visible issues were identified." ONLY when no visible defects remain after a full check.
- Do NOT invent issues that are not visible.
- Do NOT mention that you are an AI or that you are looking at images.
- Do NOT use markdown, headings, or bullet points.`;
}

function getDoorWoodworkIssueHints(itemName: string): string {
  const item = normalizeItemName(itemName).toLowerCase();
  if (!/\b(door|doors|woodwork|skirting|architrave|frame|cupboard door)\b/.test(item)) {
    return "";
  }

  return `Focus for "${itemName}":
- Inspect the full door face, edges, frame, and hardware for stains, marks, scuffs, chips, dents, cracks, and damage.
- Combine similar surface marks into one phrase (e.g. "Stains and scuff marks to door"). Use "Defects to door" only if the type is unclear — never list multiple vague phrases for the same area.`;
}

function getWetAreaIssueHints(itemName: string, roomName: string): string {
  const item = normalizeItemName(itemName).toLowerCase();
  const room = roomName.trim().toLowerCase();
  const wetItemPattern =
    /\b(tap|taps|sink|bath|bathtub|shower|toilet|wc|basin|tile|tiles|grout|sealant|splashback|plug|drain|radiator|extractor|sanitary|sanitaryware)\b/;
  const wetRoomPattern =
    /\b(bathroom|toilet|en-?suite|ensuite|wet room|utility|kitchen|shower room)\b/;

  if (!wetItemPattern.test(item) && !wetRoomPattern.test(room)) {
    return "";
  }

  return `Wet-area focus for "${itemName}" in "${roomName}":
- Prioritise checking for limescale on metal fittings, glass, tiles, plugs, and drains.
- Prioritise checking for mould on grout, silicone sealant, corners, tile edges, and any damp-stained surfaces.
- These issues must be reported if visible anywhere on the "${itemName}".`;
}

/**
 * Builds the prompt used to generate a plain, factual description of a
 * room item based on one or more images of that exact item.
 */
export function buildGeneralPrompt(
  roomName: string,
  itemName: string,
  imageCount: number
): string {
  const normalizedItem = normalizeItemName(itemName);
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images, all of the SAME "${normalizedItem}" in the "${roomName}" from different angles or distances. Combine them to describe this one item only.`
      : `You are given 1 image of the "${normalizedItem}" in the "${roomName}".`;

  return `You are a professional property inspector writing a factual inventory description for one specific room item.

${imageNote}

${ITEM_FOCUS_RULES(normalizedItem, roomName)}

Write one or more short clauses describing the "${normalizedItem}" in the "${roomName}". Cover only the "${normalizedItem}" — its type/style, material, colour, and finish.

Example for itemName "Window" in "Living Room": "White UPVC window and sill in good clean condition"

${GENERAL_INVENTORY_RULES}`;
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
  const normalizedItem = normalizeItemName(itemName);
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images, all of the SAME "${normalizedItem}" in the "${roomName}" from different angles or distances. Report issues on this one item only — an issue only needs to be visible in one image.`
      : `You are given 1 image of the "${normalizedItem}" in the "${roomName}".`;

  const wetAreaHints = getWetAreaIssueHints(normalizedItem, roomName);
  const doorHints = getDoorWoodworkIssueHints(normalizedItem);
  const itemHints = [doorHints, wetAreaHints].filter(Boolean).join("\n\n");

  return `You are a professional property inspector performing a visual condition assessment for one specific room item.

${imageNote}

${ITEM_FOCUS_RULES(normalizedItem, roomName)}

Examine the "${normalizedItem}" in the "${roomName}" for visible defects only. Do not report issues on any other room item visible in the image.

${itemHints ? `${itemHints}\n\n` : ""}${ISSUES_INSPECTION_CATEGORIES}

${getIssuesOutputRules(normalizedItem)}`;
}

/**
 * Builds the prompt used to identify distinct items visible across general
 * overview images before describing each item individually.
 */
export function buildRoomOverviewIdentifyItemsPrompt(
  roomName: string,
  imageCount: number
): string {
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images showing different areas or views of the "${roomName}". Each image may show different fixtures and fittings.`
      : `You are given 1 image of the "${roomName}".`;

  return `You are a professional property inspector preparing a GENERAL OVERVIEW inventory for the "${roomName}".

This job covers the whole room. Different images may show different fixtures and fittings.

${imageNote}

List every distinct fixture, fitting, and surface that is clearly visible across all images. Combine what you see in every image — different images may show different items.

Output rules:
- One item name per line only.
- Use short standard UK inventory names (e.g. Door, Ceiling, Walls, Flooring, Window, Light fitting, Radiator, Sockets and switches, Cupboards, Sink, Hob).
- Do NOT write descriptions — item names only.
- Do NOT repeat the same item type.
- Do NOT use bullets, numbers, markdown, or JSON.
- If the same item type appears in multiple images (e.g. walls in several photos), list it once.`;
}

/**
 * Builds the prompt used to describe a single item as part of a general
 * room overview inventory.
 */
export function buildRoomOverviewItemGeneralPrompt(
  roomName: string,
  itemName: string,
  imageCount: number
): string {
  const normalizedItem = normalizeItemName(itemName);
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images of the "${roomName}". The "${normalizedItem}" may appear in one or more images — use every image where it is visible.`
      : `You are given 1 image of the "${roomName}" showing the "${normalizedItem}".`;

  return `You are a professional property inspector writing one entry for a general room overview of the "${roomName}".

This is a GENERAL OVERVIEW job — images may show different room items. You are describing one item from that overview.

${ROOM_OVERVIEW_ITEM_FOCUS(normalizedItem, roomName)}

${imageNote}

Write one short clause for the "${normalizedItem}" only: colour/material + element + condition (+ brief inline defect note only if minor defects are visible on this item).

Example: "White painted walls in good clean condition with minor defects"

${ROOM_OVERVIEW_GENERAL_RULES}`;
}

/**
 * Builds the prompt used to generate a full-room inventory description from
 * one or more images that may show different areas of the room.
 * Used as a fallback when per-item identification fails.
 */
export function buildRoomOverviewGeneralPrompt(roomName: string, imageCount: number): string {
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images that may show different areas or views of the ${roomName}. Combine all images into one deduplicated room inventory — do not repeat the same element.`
      : `You are given 1 image of the ${roomName}.`;

  return `You are a professional property inspector writing a factual general overview inventory of the "${roomName}" in a residential or commercial property.

${imageNote}

Write a room inventory listing every visible fixture, fitting, and surface. Include, where visible: woodwork, ceiling, walls, flooring, doors, windows, blinds, light fittings, radiators, sockets and switches, sanitaryware, cupboards, worktops, splashbacks, appliances, and any other fixed elements. Omit anything not clearly visible.

Example style: "White painted wooden door in good condition with surface defects. White painted ceiling in good clean condition. Light fitting pendant type with missing bulb. UPVC window and sill in good clean condition. White painted walls in good clean condition with minor defects. Brown carpeted flooring good clean condition with minor defects as noted. White radiator in good clean condition. Sockets and switches in good order."

${ROOM_OVERVIEW_GENERAL_RULES}`;
}

/**
 * Builds the prompt used to generate a room-level issue / defect report from
 * one or more images that may show different areas of the room.
 */
export function buildRoomOverviewIssuesPrompt(roomName: string, imageCount: number): string {
  const imageNote =
    imageCount > 1
      ? `You are given ${imageCount} images that may show different areas or views of the ${roomName}. Use all of them together — an issue only needs to be visible in one of the images to be reported.`
      : `You are given 1 image of the ${roomName}.`;

  const wetAreaHints = getWetAreaIssueHints("General Overview", roomName);

  return `You are a professional property inspector performing a visual condition assessment of the "${roomName}" in a residential or commercial property.

${imageNote}

${ROOM_OVERVIEW_ISSUES_INTRO}

${wetAreaHints ? `${wetAreaHints}\n\n` : ""}${ISSUES_INSPECTION_CATEGORIES}

${getIssuesOutputRules()}`;
}

export function buildPrompts(roomName: string, itemName: string, imageCount: number) {
  // General Overview: multi-item inventory (handled separately in worker for GENERAL).
  // All other itemName values: single-item job — describe only that item in roomName.
  const overview = isRoomOverviewItem(itemName);

  return {
    general: overview
      ? buildRoomOverviewGeneralPrompt(roomName, imageCount) // fallback only; worker uses generateRoomOverviewGeneral
      : buildGeneralPrompt(roomName, itemName, imageCount),
    issues: overview
      ? buildRoomOverviewIssuesPrompt(roomName, imageCount)
      : buildIssuesPrompt(roomName, itemName, imageCount),
  };
}
