import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { GatewayError, toGatewayError } from "./errors/gateway-error.js";
import { logger } from "./observability/logger.js";
import { adminRoutes } from "./routes/admin.js";
import { catalogRoutes } from "./routes/catalog.js";
import { chatRoutes } from "./routes/chat.js";
import { clientConfigRoutes } from "./routes/client-config.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { imageRoutes } from "./routes/images.js";
import { landingRoutes } from "./routes/landing.js";
import { mediaRoutes } from "./routes/media.js";
import { modelRoutes } from "./routes/models.js";
import { openAiCompatibleRoutes } from "./routes/openai-compatible.js";
import { publicToolsRoutes } from "./routes/public-tools.js";
import { sdkRoutes } from "./routes/sdk.js";
import { usageRoutes } from "./routes/usage.js";

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: env.REQUEST_BODY_LIMIT_BYTES,
    trustProxy: env.TRUST_PROXY
  });

  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute"
  });

  app.setErrorHandler((error, _request, reply) => {
    const gatewayError = error instanceof GatewayError ? error : toGatewayError(error);
    reply.status(gatewayError.statusCode).send({
      error: {
        code: gatewayError.code,
        message: gatewayError.message
      }
    });
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Somail Gateway API",
        description: "Internal AI gateway — multi-provider routing, key management, policy enforcement.",
        version: "2.0.0"
      },
      servers: [{ url: env.PUBLIC_BASE_URL || `http://localhost:${env.GATEWAY_PORT}` }],
      components: {
        securitySchemes: {
          apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
          adminToken: { type: "apiKey", in: "header", name: "x-admin-token" }
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
    staticCSP: true,
    transformSpecificationClone: true
  });

  await app.register(landingRoutes);
  await app.register(publicToolsRoutes);
  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(clientConfigRoutes);
  await app.register(adminRoutes);
  await app.register(dashboardRoutes);
  await app.register(modelRoutes);
  await app.register(usageRoutes);
  await app.register(chatRoutes);
  await app.register(imageRoutes);
  await app.register(mediaRoutes);
  await app.register(openAiCompatibleRoutes);
  await app.register(sdkRoutes);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({
    host: env.GATEWAY_HOST,
    port: env.GATEWAY_PORT
  });
}
