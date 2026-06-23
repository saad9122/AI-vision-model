import { logger } from "../shared/config/logger";
import { startAgentWorker } from "../platform/queue/agent-worker";
import "./register-capabilities";

async function main() {
  const worker = await startAgentWorker();

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, closing worker...");
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start agent worker");
  process.exit(1);
});
