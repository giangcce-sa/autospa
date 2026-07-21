import "server-only";

import { lookup } from "dns/promises";
import { isIP } from "net";
import {
  AiProvider,
  isPrivateAddress,
  ProviderUrlError,
  validateAiProviderUrl,
} from "@/lib/provider-url-validation";

export { ProviderUrlError, sameProviderOrigin, validateAiProviderUrl } from "@/lib/provider-url-validation";
export type { AiProvider } from "@/lib/provider-url-validation";

export async function assertSafeAiProviderUrl(value: string, provider: AiProvider, extraAllowedHosts: string[] = []) {
  const normalized = validateAiProviderUrl(value, provider, extraAllowedHosts);
  const url = new URL(normalized);
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new ProviderUrlError("Địa chỉ dịch vụ AI phân giải tới mạng riêng");
  }
  return normalized;
}
