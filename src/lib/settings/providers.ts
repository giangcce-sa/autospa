import "server-only";

import { prisma } from "@/lib/db";
import { assertSafeAiProviderUrl, ProviderUrlError, sameProviderOrigin } from "@/lib/provider-url-security";
import { getSecretReplacement, resolveSecretInput } from "@/lib/settings-secrets";
import {
  parseCanonicalImageSettingsRequest,
  parseCanonicalProviderSettingsRequest,
  parseProviderTestRequest,
  PROVIDER_SETTINGS_DEFAULTS,
  toImageSettingsDto,
  toProviderSettingsDto,
  type ProviderSettingsPatch,
} from "@/lib/settings/providers-policy";
import { persistSettingsPatch } from "@/lib/settings/persistence";

const DIRECT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const GATEWAY_CLAUDE_MODEL = "spa-assistant";

const providerSelect = {
  claudeApiKey: true,
  claudeBaseUrl: true,
  openaiApiKey: true,
  openaiBaseUrl: true,
  openaiChatModel: true,
  imageModel: true,
} as const;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isAnthropicBaseUrl(url: string) {
  return new URL(url).hostname.toLowerCase() === "api.anthropic.com";
}

export async function getProviderSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: "1" }, select: providerSelect });
  return toProviderSettingsDto(settings);
}

export async function getImageSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: "1" }, select: { imageModel: true } });
  return toImageSettingsDto(settings);
}

export async function saveImageSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseCanonicalImageSettingsRequest(input);
  const settings = await persistSettingsPatch(patch, audit);
  return toImageSettingsDto(settings);
}

export async function saveProviderSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseCanonicalProviderSettingsRequest(input);
  const current = await prisma.settings.findUnique({ where: { id: "1" }, select: providerSelect });
  const update: ProviderSettingsPatch = { ...patch };

  if (patch.claudeBaseUrl) {
    const safeUrl = await assertSafeAiProviderUrl(patch.claudeBaseUrl, "claude");
    if (current?.claudeApiKey && !patch.claudeApiKey && !sameProviderOrigin(safeUrl, current.claudeBaseUrl)) {
      throw new ProviderUrlError("Khi đổi gateway Claude, bạn phải nhập lại khóa truy cập");
    }
    update.claudeBaseUrl = safeUrl;
  }
  if (patch.openaiBaseUrl) {
    const safeUrl = await assertSafeAiProviderUrl(patch.openaiBaseUrl, "openai");
    if (current?.openaiApiKey && !patch.openaiApiKey && !sameProviderOrigin(safeUrl, current.openaiBaseUrl)) {
      throw new ProviderUrlError("Khi đổi gateway OpenAI, bạn phải nhập lại khóa truy cập");
    }
    update.openaiBaseUrl = safeUrl;
  }

  const settings = await persistSettingsPatch(update, audit);
  return toProviderSettingsDto(settings);
}

export async function testProviderSettings(input: unknown) {
  const request = parseProviderTestRequest(input);
  const settings = await prisma.settings.findUnique({ where: { id: "1" }, select: providerSelect });

  if (request.provider === "claude") {
    const key = resolveSecretInput(request.apiKey, settings?.claudeApiKey);
    const savedUrl = normalizeBaseUrl(settings?.claudeBaseUrl || PROVIDER_SETTINGS_DEFAULTS.claudeBaseUrl);
    const requestedUrl = normalizeBaseUrl(request.baseUrl || savedUrl);
    const url = await assertSafeAiProviderUrl(requestedUrl, "claude");
    if (!getSecretReplacement(request.apiKey) && !sameProviderOrigin(url, savedUrl)) {
      throw new ProviderUrlError("Khi đổi gateway, bạn phải nhập lại khóa truy cập");
    }
    if (!key) throw new Error("Chưa có API key — nhập key rồi kiểm tra");

    const response = isAnthropicBaseUrl(url)
      ? await fetch(`${url}/v1/messages`, {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: DIRECT_CLAUDE_MODEL, max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
          signal: AbortSignal.timeout(30_000),
        })
      : await fetch(`${url}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: GATEWAY_CLAUDE_MODEL, max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
          signal: AbortSignal.timeout(30_000),
        });
    return providerTestResult(response);
  }

  const key = resolveSecretInput(request.apiKey, settings?.openaiApiKey);
  const savedUrl = normalizeBaseUrl(settings?.openaiBaseUrl || PROVIDER_SETTINGS_DEFAULTS.openaiBaseUrl);
  const requestedUrl = normalizeBaseUrl(request.baseUrl || savedUrl);
  const url = await assertSafeAiProviderUrl(requestedUrl, "openai");
  if (!request.apiKey && !sameProviderOrigin(url, savedUrl)) {
    throw new Error("Khi đổi gateway, bạn phải nhập lại khóa truy cập");
  }
  if (!key) throw new Error("Chưa có API key — nhập key rồi kiểm tra");

  const endpoint = url.endsWith("/chat/completions") ? url : `${url}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: request.chatModel || settings?.openaiChatModel || PROVIDER_SETTINGS_DEFAULTS.openaiChatModel,
      max_tokens: 10,
      messages: [{ role: "user", content: "hi" }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  return providerTestResult(response);
}

async function providerTestResult(response: Response) {
  if (response.ok) return { success: true, message: "Kết nối thành công!" };
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return { success: false, message: data?.error?.message ?? `Lỗi ${response.status}` };
}
