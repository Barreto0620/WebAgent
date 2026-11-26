import { Queue } from "bullmq";
import { createRedis } from "./lib/redis";

export const connection = createRedis();

export interface OutboundJob {
  messageId: string;
}

export const outboundQueue = new Queue<OutboundJob>("outbound", {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 86_400, count: 5_000 },
    removeOnFail: { age: 7 * 86_400 },
  },
});

export const maintenanceQueue = new Queue("maintenance", {
  connection,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 60_000 }, removeOnComplete: 50, removeOnFail: 200 },
});

export async function enqueueOutbound(messageId: string, delayMs = 0) {
  await outboundQueue.add("send", { messageId }, { jobId: `msg-${messageId}`, delay: delayMs });
}
