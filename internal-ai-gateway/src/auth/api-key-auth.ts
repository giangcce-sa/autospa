import type { FastifyReply, FastifyRequest } from "fastify";
import { findApiKeyContext } from "../db/repositories/api-keys.js";
import type { ApiKeyContext } from "../db/repositories/types.js";
import { GatewayError } from "../errors/gateway-error.js";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyContext?: ApiKeyContext;
  }
}

export async function apiKeyAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers["x-api-key"] ?? request.headers.authorization;
  const rawValue = Array.isArray(header) ? header[0] : header;

  if (!rawValue) {
    throw new GatewayError("UNAUTHORIZED", "Missing API key", 401);
  }

  const apiKey = rawValue.startsWith("Bearer ") ? rawValue.slice("Bearer ".length) : rawValue;
  const context = findApiKeyContext(apiKey);

  if (!context) {
    throw new GatewayError("UNAUTHORIZED", "Invalid API key", 401);
  }

  request.apiKeyContext = context;
}
