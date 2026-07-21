import { isIP } from "net";

export type AiProvider = "claude" | "openai";

export class ProviderUrlError extends Error {}

const OFFICIAL_HOSTS: Record<AiProvider, string[]> = {
  claude: ["api.anthropic.com"],
  openai: ["api.openai.com"],
};

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19));
}

export function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return privateIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return privateIpv4(normalized.slice(7));
  return normalized === "::" || normalized === "::1"
    || normalized.startsWith("fc") || normalized.startsWith("fd")
    || normalized.startsWith("fe8") || normalized.startsWith("fe9")
    || normalized.startsWith("fea") || normalized.startsWith("feb");
}

function configuredHosts() {
  return (process.env.AI_PROVIDER_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

export function validateAiProviderUrl(value: string, provider: AiProvider, extraAllowedHosts: string[] = []) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderUrlError("Địa chỉ dịch vụ AI không hợp lệ");
  }
  if (url.protocol !== "https:") throw new ProviderUrlError("Địa chỉ dịch vụ AI bắt buộc dùng HTTPS");
  if (url.username || url.password) throw new ProviderUrlError("Địa chỉ dịch vụ AI không được chứa thông tin đăng nhập");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new ProviderUrlError("Địa chỉ dịch vụ AI không được trỏ tới máy chủ nội bộ");
  }
  const allowed = new Set([...OFFICIAL_HOSTS[provider], ...configuredHosts(), ...extraAllowedHosts.map((item) => item.toLowerCase())]);
  if (!allowed.has(host)) throw new ProviderUrlError(`Host ${host} chưa nằm trong AI_PROVIDER_ALLOWED_HOSTS`);
  return url.toString().replace(/\/$/, "");
}

export function sameProviderOrigin(left: string, right: string) {
  const a = new URL(left);
  const b = new URL(right);
  return a.protocol === b.protocol && a.hostname.toLowerCase() === b.hostname.toLowerCase() && a.port === b.port;
}
