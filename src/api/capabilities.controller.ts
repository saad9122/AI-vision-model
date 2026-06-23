import type { Request, Response } from "express";
import {
  CAPABILITY_SLUGS,
  fromAgentCapability,
} from "../shared/types/capabilities";
import { getRegisteredCapabilities } from "../platform/queue/capability-registry";

export function listCapabilities(_req: Request, res: Response) {
  const capabilities = getRegisteredCapabilities().map(fromAgentCapability);

  return res.json({
    capabilities: capabilities.length > 0 ? capabilities : Object.values(CAPABILITY_SLUGS),
  });
}
