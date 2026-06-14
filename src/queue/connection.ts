import IORedis from "ioredis";
import { env } from "../config/env";

// BullMQ requires this option to be null so it can manage retries itself.
export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
