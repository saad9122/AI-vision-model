import { logger } from "../config/logger";
import {
  buildRoomOverviewGeneralPrompt,
  buildRoomOverviewIdentifyItemsPrompt,
  buildRoomOverviewItemGeneralPrompt,
  normalizeItemName,
} from "./prompt.service";
import { generateDescription } from "./vision.service";

const MAX_OVERVIEW_ITEMS = 20;

function parseIdentifiedItems(response: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const rawLine of response.split("\n")) {
    const line = rawLine
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!line || line.startsWith("{") || line.startsWith("[")) {
      continue;
    }

    const normalized = normalizeItemName(line);
    const key = normalized.toLowerCase();

    if (key === "general overview" || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(normalized);
  }

  return items;
}

function combineItemClauses(clauses: string[]): string {
  const cleaned = clauses
    .map((clause) => clause.trim().replace(/\.$/, ""))
    .filter(Boolean);

  if (cleaned.length === 0) {
    return "";
  }

  return `${cleaned.join(". ")}.`;
}

/**
 * Generates a general room overview by identifying visible items across all
 * images, describing each item individually, then combining the clauses.
 *
 * Only used when itemName is "General Overview". Regular jobs use itemName
 * directly and never call this function.
 */
export async function generateRoomOverviewGeneral(
  roomName: string,
  images: string[]
): Promise<string> {
  const imageCount = images.length;

  logger.info({ roomName, imageCount }, "Identifying items for room overview");

  const identifyResponse = await generateDescription(
    buildRoomOverviewIdentifyItemsPrompt(roomName, imageCount),
    images
  );

  const items = parseIdentifiedItems(identifyResponse).slice(0, MAX_OVERVIEW_ITEMS);

  logger.info(
    { roomName, itemCount: items.length, items },
    "Room overview items identified"
  );

  if (items.length === 0) {
    logger.warn({ roomName }, "No items identified — falling back to single-pass overview");
    return generateDescription(buildRoomOverviewGeneralPrompt(roomName, imageCount), images);
  }

  const clauses: string[] = [];

  for (const item of items) {
    logger.info({ roomName, item }, "Generating room overview clause for item");

    const clause = await generateDescription(
      buildRoomOverviewItemGeneralPrompt(roomName, item, imageCount),
      images
    );

    if (clause.trim()) {
      clauses.push(clause);
    }
  }

  const combined = combineItemClauses(clauses);

  if (!combined) {
    logger.warn({ roomName }, "No item clauses generated — falling back to single-pass overview");
    return generateDescription(buildRoomOverviewGeneralPrompt(roomName, imageCount), images);
  }

  return combined;
}
