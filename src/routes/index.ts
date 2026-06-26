import { Router } from "express";
import {
  createAgentJob,
  getAgentJob,
  submitAgentJobReview,
} from "../api/agent-jobs.controller";
import { listCapabilities } from "../api/capabilities.controller";
import { getVisionConfig } from "../api/vision-config.controller";

export const agentJobsRouter = Router();

agentJobsRouter.post("/", createAgentJob);
agentJobsRouter.patch("/:id/review", submitAgentJobReview);
agentJobsRouter.get("/:id", getAgentJob);

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/", listCapabilities);

export const visionRouter = Router();

visionRouter.get("/config", getVisionConfig);
