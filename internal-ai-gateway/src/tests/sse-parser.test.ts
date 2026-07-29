import { describe, expect, it } from "vitest";
import { parseSseJson, parseSseStream } from "../providers/sse-parser.js";

function fragmentedStream(parts: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    }
  });
}

describe("SSE parser", () => {
  it("handles fragmented UTF-8, CRLF, multiline data, comments and final events", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(": keepalive\r\nevent: delta\r\nid: 7\r\ndata: {\"text\":\"xin \r\ndata: chào\"}\r\n\r\ndata: [DONE]");
    const splitInsideVietnameseCharacter = bytes.findIndex((byte, index) => byte >= 0xc0 && index > 20) + 1;
    const events = [];
    for await (const event of parseSseStream(fragmentedStream([
      bytes.slice(0, splitInsideVietnameseCharacter),
      bytes.slice(splitInsideVietnameseCharacter, splitInsideVietnameseCharacter + 5),
      bytes.slice(splitInsideVietnameseCharacter + 5)
    ]))) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: "delta", id: "7", data: "{\"text\":\"xin \nchào\"}" },
      { event: undefined, id: "7", data: "[DONE]" }
    ]);
  });

  it("rejects malformed and non-object JSON payloads", () => {
    expect(() => parseSseJson("not json")).toThrow("malformed SSE JSON");
    expect(() => parseSseJson("[]")).toThrow("malformed SSE JSON");
    expect(parseSseJson('{"ok":true}')).toEqual({ ok: true });
  });
});
