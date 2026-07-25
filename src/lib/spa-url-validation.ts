import { isIP } from "net";
import { isPrivateAddress } from "./provider-url-validation.ts";

export class SpaUrlError extends Error {}

function configuredHosts() {
  return (process.env.SPA_API_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

export function validateSpaApiUrl(value: string, allowedHosts = configuredHosts()) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SpaUrlError("Địa chỉ Spa API không hợp lệ");
  }

  if (url.protocol !== "https:") throw new SpaUrlError("Địa chỉ Spa API bắt buộc dùng HTTPS");
  if (url.username || url.password) throw new SpaUrlError("Địa chỉ Spa API không được chứa thông tin đăng nhập");
  if (url.search || url.hash) throw new SpaUrlError("Địa chỉ Spa API không được chứa query hoặc fragment");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || (isIP(host) > 0 && isPrivateAddress(host))
  ) {
    throw new SpaUrlError("Địa chỉ Spa API không được trỏ tới máy chủ nội bộ");
  }

  const allowed = new Set(allowedHosts.map((item) => item.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean));
  if (allowed.size && !allowed.has(host)) {
    throw new SpaUrlError(`Host ${host} chưa nằm trong SPA_API_ALLOWED_HOSTS`);
  }

  return url.toString().replace(/\/$/, "");
}

export function sameSpaOrigin(left: string, right: string) {
  const a = new URL(left);
  const b = new URL(right);
  return a.protocol === b.protocol && a.hostname.toLowerCase() === b.hostname.toLowerCase() && a.port === b.port;
}
