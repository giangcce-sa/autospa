import type { FastifyInstance } from "fastify";
import { listGatewayModels } from "../config/models.js";

export async function modelRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/models", {
    schema: {
      tags: ["Models"],
      summary: "List available gateway model aliases",
      response: { 200: { type: "object", additionalProperties: true, properties: { data: { type: "array" } } } }
    }
  }, async () => ({
    data: listGatewayModels()
  }));
}
