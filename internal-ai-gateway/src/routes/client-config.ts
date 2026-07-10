import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { adminTokenAuth } from "../admin/admin-auth.js";
import { env } from "../config/env.js";

const clientConfigSchema = z.object({
  client: z.enum(["claude-code", "cursor", "n8n", "ai-spa"])
});

function publicBaseUrl(): string {
  return env.PUBLIC_BASE_URL || `http://localhost:${env.GATEWAY_PORT}`;
}

export function buildClientConfig(client: "claude-code" | "cursor" | "n8n" | "ai-spa") {
  const baseUrl = publicBaseUrl();
  const common = {
    baseUrl,
    apiKeyHeader: "x-api-key",
    authorizationHeader: "authorization: Bearer <api-key>",
    defaultModel: "auto",
    openAiCompatibleBaseUrl: `${baseUrl}/v1`,
    chatEndpoint: `${baseUrl}/v1/chat`,
    openAiChatEndpoint: `${baseUrl}/v1/chat/completions`,
    modelsEndpoint: `${baseUrl}/v1/models`,
    catalogEndpoint: `${baseUrl}/v1/catalog`
  };

  const configs = {
    "claude-code": {
      ...common,
      taskType: "coding",
      recommendedModels: ["auto", "strong-code", "kiro-pro"],
      env: {
        ANTHROPIC_BASE_URL: `${baseUrl}/v1`,
        ANTHROPIC_AUTH_TOKEN: "<gateway-api-key>"
      }
    },
    cursor: {
      ...common,
      taskType: "coding",
      recommendedModels: ["auto", "strong-code"],
      openAiProvider: {
        baseUrl: `${baseUrl}/v1`,
        apiKey: "<gateway-api-key>",
        model: "auto"
      }
    },
    n8n: {
      ...common,
      taskType: "workflow",
      recommendedModels: ["auto", "cheap-chat"],
      httpRequest: {
        method: "POST",
        url: `${baseUrl}/v1/chat/completions`,
        headers: {
          authorization: "Bearer <gateway-api-key>",
          "content-type": "application/json"
        },
        body: {
          model: "auto",
          messages: [{ role: "user", content: "={{$json.prompt}}" }]
        }
      }
    },
    "ai-spa": {
      ...common,
      taskType: "spa-chat",
      recommendedModels: ["auto", "spa-assistant", "cheap-chat"],
      endpoints: {
        chat: `${baseUrl}/v1/chat`,
        imageGeneration: `${baseUrl}/v1/images/generations`,
        vision: `${baseUrl}/v1/vision/analyze`
      }
    }
  };

  return configs[client];
}

export async function clientConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get("/client-config/:client", async (request) => {
    const params = clientConfigSchema.parse(request.params);
    return { data: buildClientConfig(params.client) };
  });

  app.get("/admin/api/client-config/:client", { preHandler: adminTokenAuth }, async (request) => {
    const params = clientConfigSchema.parse(request.params);
    return { data: buildClientConfig(params.client) };
  });
}
