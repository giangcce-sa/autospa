import PQueue from "p-queue";
import { env } from "../config/env.js";
import { GatewayError } from "../errors/gateway-error.js";

export const kiroQueue = new PQueue({
  concurrency: env.KIRO_MAX_CONCURRENCY
});

export async function runInKiroQueue<T>(task: () => Promise<T>): Promise<T> {
  if (kiroQueue.size >= env.KIRO_QUEUE_MAX_PENDING) {
    throw new GatewayError("QUEUE_FULL", "Kiro provider queue is full", 429);
  }

  return kiroQueue.add(task);
}
