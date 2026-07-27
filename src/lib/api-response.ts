// Shared error-to-response mapping for API routes — pure (no prisma, no server-only)
// so tests can import it. Typed, deliberate errors keep their user-facing message;
// anything unrecognized is logged server-side and answered with a generic message
// so internal details (Prisma/provider/stack text) never reach the client.

import { ZodError } from "zod";
import { accessErrorResponse } from "./access-error.ts";
import { adsMutationErrorResponse } from "./ads-safety.ts";
import { ProviderUrlError } from "./provider-url-validation.ts";
import { SpaUrlError } from "./spa-url-validation.ts";

const GENERIC_MESSAGE = "Đã xảy ra lỗi, thử lại sau";

function knownErrorResponse(error: unknown) {
  const access = accessErrorResponse(error);
  if (access) return access;
  const ads = adsMutationErrorResponse(error);
  if (ads) return ads;
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
    return Response.json({ success: false, error: message, message }, { status: 400 });
  }
  if (error instanceof ProviderUrlError || error instanceof SpaUrlError || error instanceof RangeError) {
    const message = error.message || "Dữ liệu không hợp lệ";
    return Response.json({ success: false, error: message, message }, { status: 400 });
  }
  return null;
}

/**
 * Default catch-all for API routes: typed errors answer with their own message
 * and status; everything else logs and returns a generic response (500 unless
 * a status override is given).
 */
export function routeErrorResponse(error: unknown, fallback = GENERIC_MESSAGE, status = 500): Response {
  const known = knownErrorResponse(error);
  if (known) return known;
  console.error("route error:", error);
  return Response.json({ success: false, error: fallback }, { status });
}

/**
 * Variant for owner-only settings/video routes, where services deliberately
 * throw Error with user-facing Vietnamese messages (e.g. "RUNWAY_API_KEY chưa
 * được cấu hình"). Exposes Error.message to the owner; never stringifies
 * non-Error values.
 */
export function settingsErrorResponse(error: unknown, fallback = GENERIC_MESSAGE, status = 500): Response {
  const known = knownErrorResponse(error);
  if (known) return known;
  console.error("settings route error:", error);
  const message = error instanceof Error && error.message ? error.message : fallback;
  return Response.json({ success: false, error: message, message }, { status });
}
