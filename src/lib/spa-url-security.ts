import "server-only";

import { lookup } from "dns/promises";
import { isIP } from "net";
import { isPrivateAddress } from "@/lib/provider-url-validation";
import { SpaUrlError, validateSpaApiUrl } from "@/lib/spa-url-validation";

export { SpaUrlError } from "@/lib/spa-url-validation";

export async function assertSafeSpaApiUrl(value: string) {
  const normalized = validateSpaApiUrl(value);
  const url = new URL(normalized);
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new SpaUrlError("Địa chỉ Spa API phân giải tới mạng riêng");
  }
  return normalized;
}
