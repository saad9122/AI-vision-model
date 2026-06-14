import { Router } from "express";
import { createJob, getJob } from "../controllers/jobs.controller";

export const jobsRouter = Router();

jobsRouter.post("/", createJob);
jobsRouter.get("/:id", getJob);
