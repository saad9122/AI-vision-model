import { Router } from "express";
import {
  createAgentJob,
  getAgentJob,
  submitAgentJobReview,
} from "../api/agent-jobs.controller";
import { listCapabilities } from "../api/capabilities.controller";

export const agentJobsRouter = Router();

agentJobsRouter.post("/", createAgentJob);
agentJobsRouter.patch("/:id/review", submitAgentJobReview);
agentJobsRouter.get("/:id", getAgentJob);

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/", listCapabilities);
