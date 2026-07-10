import type { FastifyInstance } from "fastify";
import { adminTokenAuth } from "../admin/admin-auth.js";
import { gatewayCapabilities } from "../config/capabilities.js";
import { listGatewayModels } from "../config/models.js";

const catalog = {
  name: "Internal AI Gateway",
  version: "2.0",
  auth: {
    headers: ["x-api-key", "authorization: Bearer <api-key>"],
    adminHeaders: ["x-admin-token", "x-admin-session"]
  },
  capabilities: gatewayCapabilities,
  endpoints: [
    {
      method: "POST",
      path: "/v1/chat",
      capability: "chat",
      description: "Native gateway chat endpoint with task_type routing.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/chat/completions",
      capability: "chat",
      description: "OpenAI-compatible chat completions endpoint.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/images/generations",
      capability: "image-generation",
      description: "OpenAI-compatible image generation endpoint routed through enabled media providers.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/embeddings",
      capability: "embedding",
      description: "OpenAI-compatible embeddings endpoint.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/audio/speech",
      capability: "text-to-speech",
      description: "Text-to-speech endpoint returning provider audio bytes.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/audio/transcriptions",
      capability: "speech-to-text",
      description: "Speech-to-text endpoint accepting file_url or audio_base64.",
      auth: "api-key"
    },
    {
      method: "POST",
      path: "/v1/vision/analyze",
      capability: "vision",
      description: "Vision endpoint accepting image_url or image_base64 plus prompt.",
      auth: "api-key"
    },
    {
      method: "GET",
      path: "/v1/models",
      capability: "metadata",
      description: "List gateway aliases and provider-backed model routes.",
      auth: "none"
    }
  ],
  examples: {
    chat: {
      model: "auto",
      task_type: "chat",
      messages: [{ role: "user", content: "Reply with ok only." }]
    },
    openaiChat: {
      model: "auto",
      messages: [{ role: "user", content: "Reply with ok only." }]
    },
    image: {
      model: "auto",
      prompt: "Clean modern spa treatment room",
      size: "1024x1024"
    },
    embedding: {
      model: "auto",
      input: "customer appointment note"
    }
  }
} as const;

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/catalog", async () => ({
    data: {
      ...catalog,
      models: listGatewayModels()
    }
  }));

  app.get("/admin/api/catalog", { preHandler: adminTokenAuth }, async () => ({
    data: {
      ...catalog,
      models: listGatewayModels()
    }
  }));
}
