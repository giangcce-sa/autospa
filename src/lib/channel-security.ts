import { isPrivateAddress } from "./provider-url-validation.ts";

export const safeGoogleAccountSelect = {
  id: true,
  email: true,
  displayName: true,
  accountId: true,
  locationId: true,
  locationName: true,
  isActive: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function googleReviewResourceName(locationId: string | null | undefined, reviewId: string) {
  if (reviewId.includes("/reviews/")) return reviewId;
  if (!locationId) throw new Error("Google account chưa chọn location");
  return `${locationId.replace(/\/$/, "")}/reviews/${reviewId}`;
}

export function requiresOwnerForTikTokPublish(action: unknown, publishToTikTok: unknown) {
  return action === "publish-now" && Boolean(publishToTikTok);
}

export function trustedTelegramBaseUrl(input: {
  autospaBaseUrl?: string;
  authUrl?: string;
  requestOrigin?: string;
  production: boolean;
}) {
  const configured = input.autospaBaseUrl || input.authUrl;
  const value = configured || (input.production ? undefined : input.requestOrigin);
  if (!value) throw new Error("Webhook cần domain HTTPS công khai");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Webhook cần domain HTTPS công khai");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateAddress(hostname)) {
    throw new Error("Webhook cần domain HTTPS công khai");
  }
  return url.origin;
}
