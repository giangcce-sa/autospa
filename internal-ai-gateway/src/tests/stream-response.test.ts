import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { FastifyReply } from "fastify";
import type { StreamChunk } from "../providers/types.js";
import { writeOpenAiStreamResponse } from "../routes/stream-response.js";

class FakeResponse extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  headers = new Map<string, string>();
  writes: string[] = [];

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  write(value: string) {
    this.writes.push(value);
    if (this.writes.length === 1) this.emit("close");
    return true;
  }

  end() {
    this.writableEnded = true;
  }
}

describe("stream response writer", () => {
  it("reports client disconnect and closes the provider iterator", async () => {
    const raw = new FakeResponse();
    const iteratorReturn = vi.fn(async () => ({ done: true as const, value: undefined }));
    const stream: AsyncIterable<StreamChunk> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: false as const, value: { content: "never sent", done: false as const } }),
          return: iteratorReturn
        };
      }
    };
    const reply = {
      raw,
      hijack: vi.fn()
    } as unknown as FastifyReply;

    const outcome = await writeOpenAiStreamResponse(reply, stream, {
      id: "chatcmpl_disconnect",
      model: "gpt-4.1-mini"
    });

    expect(outcome.status).toBe("error");
    if (outcome.status === "error") expect(outcome.error.code).toBe("CLIENT_DISCONNECTED");
    expect(iteratorReturn).toHaveBeenCalledOnce();
    expect(raw.writes).toHaveLength(1);
  });
});
