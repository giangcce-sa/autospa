export type SseEvent = {
  event?: string;
  data: string;
  id?: string;
};

export async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncIterable<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let event: string | undefined;
  let id: string | undefined;

  function dispatch(): SseEvent | null {
    if (dataLines.length === 0) {
      event = undefined;
      return null;
    }
    const parsed = { event, data: dataLines.join("\n"), id };
    dataLines = [];
    event = undefined;
    return parsed;
  }

  function processLine(line: string): void {
    if (line.startsWith(":")) return;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
    else if (field === "event") event = value;
    else if (field === "id" && !value.includes("\0")) id = value;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          const parsed = dispatch();
          if (parsed) yield parsed;
        } else {
          processLine(line);
        }
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer) processLine(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
    const parsed = dispatch();
    if (parsed) yield parsed;
  } finally {
    reader.releaseLock();
  }
}

export function parseSseJson(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Provider returned malformed SSE JSON");
  }
}
