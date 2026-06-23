import cors from "cors";
import express from "express";
import { connectDb, disconnectDb } from "../shared/config/db";
import { env } from "../shared/config/env";
import { logger } from "../shared/config/logger";
import { apiKeyAuth } from "../shared/middlewares/auth.middleware";
import { errorHandler } from "../shared/middlewares/error.middleware";
import { agentJobsRouter, capabilitiesRouter } from "../routes";
import "./register-capabilities";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const protectedRouter = express.Router();
protectedRouter.use("/agent-jobs", agentJobsRouter);
protectedRouter.use("/capabilities", capabilitiesRouter);

if (env.API_KEY_AUTH_ENABLED) {
  app.use("/api/v1", apiKeyAuth, protectedRouter);
} else {
  app.use("/api/v1", protectedRouter);
}

app.use(errorHandler);

async function main() {
  await connectDb();

  const server = app.listen(env.PORT, () => {
    logger.info(`AI agent service listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
