import { Redis } from "ioredis";
import { config } from "../config";

export function createRedis() {
  // BullMQ exige maxRetriesPerRequest = null nas conexões de worker
  return new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
}
