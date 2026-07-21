import "server-only";

export async function providerFetch(url: string, init: RequestInit, timeoutMs = 180_000) {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (response.ok) return response;
  const body = await response.text().catch(() => "");
  throw new Error(`Provider lỗi ${response.status}: ${body.slice(0, 400) || response.statusText}`);
}

export function normalizeProviderStatus(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (["succeeded", "success", "completed", "complete", "done"].includes(value)) return "completed" as const;
  if (["failed", "error", "cancelled", "canceled"].includes(value)) return "failed" as const;
  if (["pending", "queued", "throttled"].includes(value)) return "queued" as const;
  return "processing" as const;
}
