import "server-only";

import { prisma } from "@/lib/db";
import { assertSafeSpaApiUrl, SpaUrlError } from "@/lib/spa-url-security";
import { decryptSecret } from "@/lib/secrets-crypto";
import { getSecretReplacement, resolveSecretInput } from "@/lib/settings-secrets";
import {
  parseCanonicalConnectionSettingsRequest,
  parseConnectionTestRequest,
  toConnectionSettingsDto,
  type ConnectionSettingsPatch,
} from "@/lib/settings/connections-policy";
import { persistSettingsPatch } from "@/lib/settings/persistence";
import { sameSpaOrigin } from "@/lib/spa-url-validation";
import { testSpaConnectionWithCredentials } from "@/lib/spa-client";

const connectionSelect = {
  spaApiUrl: true,
  spaApiKey: true,
  spaWebhookSecret: true,
} as const;

export async function getConnectionSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: "1" }, select: connectionSelect });
  return toConnectionSettingsDto(settings);
}

export async function prepareConnectionSettingsPatch(
  patch: ConnectionSettingsPatch,
  current: { spaApiUrl?: string | null; spaApiKey?: string | null } | null | undefined,
) {
  const update: ConnectionSettingsPatch = { ...patch };
  if (patch.spaApiUrl) {
    const safeUrl = await assertSafeSpaApiUrl(patch.spaApiUrl);
    if (current?.spaApiKey && !patch.spaApiKey && current.spaApiUrl && !sameSpaOrigin(safeUrl, current.spaApiUrl)) {
      throw new SpaUrlError("Khi đổi máy chủ Spa API, bạn phải nhập lại khóa truy cập");
    }
    update.spaApiUrl = safeUrl;
  }
  return update;
}

export async function saveConnectionSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseCanonicalConnectionSettingsRequest(input);
  const current = await prisma.settings.findUnique({ where: { id: "1" }, select: connectionSelect });
  const update = await prepareConnectionSettingsPatch(patch, current);
  const settings = await persistSettingsPatch(update, audit);
  return toConnectionSettingsDto(settings);
}

export async function testConnectionSettings(input: unknown) {
  const request = parseConnectionTestRequest(input);
  const settings = await prisma.settings.findUnique({ where: { id: "1" }, select: connectionSelect });
  const requestedUrl = request.spaApiUrl || settings?.spaApiUrl;
  if (!requestedUrl) throw new SpaUrlError("Chưa cấu hình Spa API URL");

  const url = await assertSafeSpaApiUrl(requestedUrl);
  if (
    settings?.spaApiKey
    && !getSecretReplacement(request.spaApiKey)
    && settings.spaApiUrl
    && !sameSpaOrigin(url, settings.spaApiUrl)
  ) {
    throw new SpaUrlError("Khi đổi máy chủ Spa API, bạn phải nhập lại khóa truy cập");
  }

  const key = resolveSecretInput(request.spaApiKey, decryptSecret(settings?.spaApiKey));
  if (!key) throw new Error("Chưa có Spa API key — nhập key rồi kiểm tra");
  return testSpaConnectionWithCredentials({ url, key });
}
