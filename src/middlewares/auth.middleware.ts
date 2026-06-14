import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Simple shared-secret auth for service-to-service calls from the NestJS
 * backend. The AI service should not be publicly exposed - this is a
 * defense-in-depth measure on top of network-level restrictions.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-api-key");

  if (!provided || provided !== env.API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}
