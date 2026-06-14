import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler } from "./middlewares/error.middleware";
import { apiKeyAuth } from "./middlewares/auth.middleware";
import { jobsRouter } from "./routes/jobs.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Public health check (used by Docker healthcheck / load balancer)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// All job endpoints require the shared API key
// app.use("/api/v1/jobs", apiKeyAuth, jobsRouter);
app.use("/api/v1/jobs", jobsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`AI description service listening on port ${env.PORT}`);
});
