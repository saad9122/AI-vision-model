import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Optional shared-secret auth for service-to-service calls.
 * Enable with API_KEY_AUTH_ENABLED=true on the AI vision service.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-api-key");
  const expected = env.API_KEY?.trim();

  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}
