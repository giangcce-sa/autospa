import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "../config/env.js";
import { GatewayError } from "../errors/gateway-error.js";

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8")
    || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return false;
}

export function isPrivateNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL is invalid", 400);
  }

  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL must use HTTPS", 400);
  }
  if (url.username || url.password) {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL must not contain credentials", 400);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL cannot target a local host", 400);
  }

  const literalFamily = isIP(hostname);
  if (literalFamily && isPrivateNetworkAddress(hostname)) {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL cannot target a private network", 400);
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = literalFamily ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new GatewayError("INVALID_REQUEST", "Webhook hostname could not be resolved", 400);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new GatewayError("INVALID_REQUEST", "Webhook URL cannot resolve to a private network", 400);
  }

  if (env.PUBLIC_BASE_URL) {
    const publicHostname = new URL(env.PUBLIC_BASE_URL).hostname.toLowerCase();
    if (hostname === publicHostname) {
      throw new GatewayError("INVALID_REQUEST", "Webhook URL cannot target this gateway", 400);
    }
  }

  return url;
}
