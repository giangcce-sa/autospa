import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { assertSafeAiProviderUrl, ProviderUrlError, sameProviderOrigin } from "@/lib/provider-url-security";
import { getSecretReplacement, maskSecret, resolveSecretInput } from "@/lib/settings-secrets";
import { SpaUrlError } from "@/lib/spa-url-security";
import { parseAutomationSettingsPatch } from "@/lib/settings/automation-policy";
import { assertAdsThresholdOrder, parseAdsSettingsPatch, toAdsOptimizationSettings } from "@/lib/settings/ads-policy";
import { prepareConnectionSettingsPatch, testConnectionSettings } from "@/lib/settings/connections";
import { parseConnectionSettingsPatch } from "@/lib/settings/connections-policy";
import { parseDataSettingsPatch } from "@/lib/settings/data-policy";
import { parseImageSettingsPatch, parseProviderSettingsPatch } from "@/lib/settings/providers-policy";
import { parseZaloSettingsPatch } from "@/lib/settings/channels-policy";
import { testZaloSettings } from "@/lib/settings/channels";
import { persistSettingsPatch, type SettingsScalarPatch } from "@/lib/settings/persistence";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const GATEWAY_CLAUDE_MODEL = "spa-assistant";
const DIRECT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isAnthropicBaseUrl(url: string) {
  return new URL(url).hostname.toLowerCase() === "api.anthropic.com";
}

function safeSettings(settings: NonNullable<Awaited<ReturnType<typeof prisma.settings.findFirst>>>) {
  return {
    ...settings,
    claudeApiKey: maskSecret(settings.claudeApiKey),
    openaiApiKey: maskSecret(settings.openaiApiKey),
    zaloToken: maskSecret(settings.zaloToken),
    spaApiKey: maskSecret(settings.spaApiKey),
    spaWebhookSecret: maskSecret(settings.spaWebhookSecret),
    webhookVerifyToken: maskSecret(settings.webhookVerifyToken),
    telegramBotToken: maskSecret(settings.telegramBotToken),
    telegramWebhookSecret: maskSecret(settings.telegramWebhookSecret, 0),
    runwayApiKey: maskSecret(settings.runwayApiKey, 0),
    elevenLabsApiKey: maskSecret(settings.elevenLabsApiKey, 0),
    syncLabsApiKey: maskSecret(settings.syncLabsApiKey, 0),
    hasSpaApiKey: !!settings.spaApiKey,
    hasSpaWebhookSecret: !!settings.spaWebhookSecret,
    hasWebhookVerifyToken: !!settings.webhookVerifyToken,
    hasTelegramBotToken: !!settings.telegramBotToken,
  };
}

export async function GET() {
  try {
    await requireUser({ owner: true });
    const settings = await prisma.settings.findFirst();
    if (!settings) return NextResponse.json({ data: null, success: true });

    return NextResponse.json({ data: safeSettings(settings), success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Lỗi khi tải cài đặt", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { service, apiKey, baseUrl } = body;
      if (service === "spa") {
        const result = await testConnectionSettings({
          spaApiUrl: body.spaApiUrl,
          spaApiKey: apiKey,
        });
        return NextResponse.json(result, { status: result.success ? 200 : 502 });
      }

      // Use value passed from form; fall back to DB only if form field is masked/empty
      const settings = await prisma.settings.findFirst();

      if (service === "claude") {
        const key = resolveSecretInput(apiKey, settings?.claudeApiKey);
        const savedUrl = normalizeBaseUrl(settings?.claudeBaseUrl || ANTHROPIC_BASE_URL);
        const requestedUrl = normalizeBaseUrl((baseUrl && !baseUrl.includes("••")) ? baseUrl : savedUrl);
        const url = await assertSafeAiProviderUrl(requestedUrl, "claude");
        if ((!apiKey || apiKey.includes("••")) && !sameProviderOrigin(url, savedUrl)) {
          return NextResponse.json({ success: false, message: "Khi đổi gateway, bạn phải nhập lại khóa truy cập" }, { status: 400 });
        }
        if (!key) return NextResponse.json({ success: false, message: "Chưa có API key — nhập key rồi test" });
        try {
          const res = isAnthropicBaseUrl(url)
            ? await fetch(`${url}/v1/messages`, {
                method: "POST",
                headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
                body: JSON.stringify({ model: DIRECT_CLAUDE_MODEL, max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
              })
            : await fetch(`${url}/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                  model: GATEWAY_CLAUDE_MODEL,
                  max_tokens: 10,
                  messages: [{ role: "user", content: "hi" }],
                }),
              });
          if (res.ok) return NextResponse.json({ success: true, message: "Kết nối thành công!" });
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ success: false, message: err.error?.message || `Lỗi ${res.status}` });
        } catch (e) {
          return NextResponse.json({ success: false, message: "Không thể kết nối: " + String(e) });
        }
      }

      if (service === "openai") {
        const key = resolveSecretInput(apiKey, settings?.openaiApiKey);
        const savedOpenAiUrl = settings?.openaiBaseUrl || "https://api.openai.com/v1";
        const requestedOpenAiUrl = (body.openaiBaseUrl && !body.openaiBaseUrl.includes("••"))
          ? body.openaiBaseUrl
          : savedOpenAiUrl;
        const oBaseUrl = await assertSafeAiProviderUrl(requestedOpenAiUrl, "openai");
        if ((!apiKey || apiKey.includes("••")) && !sameProviderOrigin(oBaseUrl, savedOpenAiUrl)) {
          return NextResponse.json({ success: false, message: "Khi đổi gateway, bạn phải nhập lại khóa truy cập" }, { status: 400 });
        }
        const model = settings?.openaiChatModel || "auto";
        if (!key) return NextResponse.json({ success: false, message: "Chưa có API key — nhập key rồi test" });
        try {
          const res = await fetch(`${oBaseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              max_tokens: 10,
              messages: [{ role: "user", content: "hi" }],
            }),
          });
          if (res.ok) return NextResponse.json({ success: true, message: "Kết nối thành công!" });
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ success: false, message: err.error?.message || `Lỗi ${res.status}` });
        } catch (e) {
          return NextResponse.json({ success: false, message: "Không thể kết nối: " + String(e) });
        }
      }

      if (service === "zalo") {
        const result = await testZaloSettings({ zaloToken: apiKey });
        return NextResponse.json(result, { status: result.success ? 200 : 502 });
      }

      return NextResponse.json({ success: false, message: "Service không hợp lệ" });
    }

    const { claudeApiKey, claudeBaseUrl, openaiApiKey, openaiBaseUrl } = body;
    const updateData: SettingsScalarPatch = {};
    const providerPatch = parseProviderSettingsPatch(body);
    const imagePatch = parseImageSettingsPatch(body);
    const connectionPatch = parseConnectionSettingsPatch(body);
    const zaloPatch = parseZaloSettingsPatch(body);
    const claudeKeyReplacement = getSecretReplacement(claudeApiKey);
    const openaiKeyReplacement = getSecretReplacement(openaiApiKey);
    const secretReplacements = [
      ["claudeApiKey", claudeKeyReplacement],
      ["openaiApiKey", openaiKeyReplacement],
      ["webhookVerifyToken", getSecretReplacement(body.webhookVerifyToken)],
    ] as const;
    for (const [field, value] of secretReplacements) {
      if (value !== undefined) updateData[field] = value;
    }

    Object.assign(updateData, providerPatch, imagePatch);
    Object.assign(updateData, zaloPatch);
    const currentSettings = await prisma.settings.findFirst();
    Object.assign(updateData, await prepareConnectionSettingsPatch(connectionPatch, currentSettings));
    if (claudeBaseUrl) {
      const safeUrl = await assertSafeAiProviderUrl(claudeBaseUrl, "claude");
      if (currentSettings?.claudeApiKey && !claudeKeyReplacement && !sameProviderOrigin(safeUrl, currentSettings.claudeBaseUrl)) {
        return NextResponse.json({ error: "Khi đổi gateway Claude, bạn phải nhập lại khóa truy cập", success: false }, { status: 400 });
      }
      updateData.claudeBaseUrl = safeUrl;
    }
    if (openaiBaseUrl) {
      const safeUrl = await assertSafeAiProviderUrl(openaiBaseUrl, "openai");
      if (currentSettings?.openaiApiKey && !openaiKeyReplacement && !sameProviderOrigin(safeUrl, currentSettings.openaiBaseUrl)) {
        return NextResponse.json({ error: "Khi đổi gateway OpenAI, bạn phải nhập lại khóa truy cập", success: false }, { status: 400 });
      }
      updateData.openaiBaseUrl = safeUrl;
    }
    Object.assign(updateData, parseAutomationSettingsPatch(body));
    Object.assign(updateData, parseDataSettingsPatch(body));
    const adsPatch = parseAdsSettingsPatch(body);
    Object.assign(updateData, adsPatch);
    assertAdsThresholdOrder(toAdsOptimizationSettings({ ...currentSettings, ...adsPatch }));

    const settings = await persistSettingsPatch(updateData, {
      userId: user.id ?? user.email ?? "owner",
      href: "/settings",
      source: "settings_api",
    });

    return NextResponse.json({
      data: safeSettings(settings),
      success: true,
    });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, success: false }, { status: e instanceof RangeError || e instanceof ProviderUrlError || e instanceof SpaUrlError || e instanceof ZodError ? 400 : 500 });
  }
}
