const SENSITIVE_KEY = /(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key)/i;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(nested)]),
  );
}

export function redactSentryEvent<T extends {
  request?: { data?: unknown; cookies?: unknown; headers?: Record<string, unknown> };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
}>(event: T): T {
  if (event.request?.data !== undefined) event.request.data = "[redacted]";
  if (event.request?.cookies !== undefined) event.request.cookies = "[redacted]";
  if (event.request?.headers) event.request.headers = redactValue(event.request.headers) as Record<string, unknown>;
  if (event.extra) event.extra = redactValue(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = redactValue(event.contexts) as Record<string, unknown>;
  return event;
}
