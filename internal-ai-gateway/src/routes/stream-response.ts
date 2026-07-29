import type { FastifyReply } from "fastify";
import { GatewayError, toGatewayError } from "../errors/gateway-error.js";
import type { StreamChunk, TokenUsage } from "../providers/types.js";

export type StreamResponseOutcome =
  | { status: "ok"; usage: TokenUsage }
  | { status: "error"; error: GatewayError };

type StreamResponseOptions = {
  id: string;
  model: string;
  includeUsage?: boolean;
};

export async function writeOpenAiStreamResponse(
  reply: FastifyReply,
  stream: AsyncIterable<StreamChunk>,
  options: StreamResponseOptions,
): Promise<StreamResponseOutcome> {
  reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.hijack();

  let disconnected = false;
  const onClose = () => {
    if (!reply.raw.writableEnded) disconnected = true;
  };
  reply.raw.once("close", onClose);

  const send = (payload: unknown) => {
    if (disconnected || reply.raw.destroyed) {
      throw new GatewayError("CLIENT_DISCONNECTED", "Client disconnected during stream", 499);
    }
    reply.raw.write(`data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`);
  };

  const chunk = (delta: Record<string, unknown>, finishReason: string | null) => ({
    id: options.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: options.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

  const iterator = stream[Symbol.asyncIterator]();
  try {
    send(chunk({ role: "assistant" }, null));
    while (true) {
      const result = await iterator.next();
      if (result.done) throw new GatewayError("PROVIDER_ERROR", "Provider stream ended without usage");
      const part = result.value;
      if (part.done) {
        send(chunk({}, "stop"));
        if (options.includeUsage) {
          send({
            id: options.id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: options.model,
            choices: [],
            usage: {
              prompt_tokens: part.usage.input_tokens,
              completion_tokens: part.usage.output_tokens,
              total_tokens:
                part.usage.input_tokens === null || part.usage.output_tokens === null
                  ? null
                  : part.usage.input_tokens + part.usage.output_tokens,
            },
          });
        }
        send("[DONE]");
        reply.raw.end();
        return { status: "ok", usage: part.usage };
      }
      send(chunk({ content: part.content }, null));
    }
  } catch (error) {
    const gatewayError = toGatewayError(error);
    if (!disconnected && !reply.raw.destroyed) {
      try {
        send({ error: { code: gatewayError.code, message: gatewayError.message, request_id: options.id } });
        send("[DONE]");
        reply.raw.end();
      } catch {
        disconnected = true;
      }
    }
    if (disconnected && gatewayError.code !== "CLIENT_DISCONNECTED") {
      return { status: "error", error: new GatewayError("CLIENT_DISCONNECTED", "Client disconnected during stream", 499) };
    }
    return { status: "error", error: gatewayError };
  } finally {
    reply.raw.off("close", onClose);
    await iterator.return?.();
  }
}
