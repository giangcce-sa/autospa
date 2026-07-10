import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

export async function sdkRoutes(app: FastifyInstance): Promise<void> {
  app.get("/sdk/gateway-client.ts", { schema: { hide: true } }, async (_req, reply) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "../sdk/gateway-client.ts"),
      resolve(here, "../../src/sdk/gateway-client.ts")
    ];
    const found = candidates.find((p) => existsSync(p));
    if (!found) {
      return reply.status(404).send("SDK source not found");
    }
    const content = readFileSync(found, "utf-8");
    return reply.type("text/plain; charset=utf-8").send(content);
  });
}
