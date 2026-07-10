import type { FastifyInstance } from "fastify";
import { listUsageDaily } from "../db/repositories/usage.js";

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/usage/summary", async () => ({
    data: listUsageDaily(100)
  }));
}
