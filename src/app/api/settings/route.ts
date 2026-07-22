import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { assertSafeAiProviderUrl, ProviderUrlError, sameProviderOrigin } from "@/lib/provider-url-security";
import { getSecretReplacement, maskSecret, resolveSecretInput } from "@/lib/settings-secrets";
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const GATEWAY_CLAUDE_MODEL = "spa-assistant";
const DIRECT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isAnthropicBaseUrl(url: string) {
  return new URL(url).hostname.toLowerCase() === "api.anthropic.com";
}

function boundedNumber(value: unknown, min: number, max: number, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new RangeError(`${field} phải nằm trong khoảng ${min}-${max}`);
  }
  return number;
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

      if (service === "spa") {
        const { testSpaConnection } = await import("@/lib/spa-client");
        const result = await testSpaConnection();
        return NextResponse.json(result);
      }

      if (service === "zalo") {
        const token = resolveSecretInput(apiKey, settings?.zaloToken);
        if (!token) return NextResponse.json({ success: false, message: "Chưa có Zalo Token — nhập rồi test" });
        try {
          const res = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
            headers: { access_token: token },
          });
          const data = await res.json();
          if (data.error === 0) return NextResponse.json({ success: true, message: `Kết nối thành công! OA: ${data.data?.name || "OK"}` });
          return NextResponse.json({ success: false, message: data.message || "Token không hợp lệ" });
        } catch (e) {
          return NextResponse.json({ success: false, message: "Không thể kết nối: " + String(e) });
        }
      }

      return NextResponse.json({ success: false, message: "Service không hợp lệ" });
    }

    const { claudeApiKey, claudeBaseUrl, openaiApiKey, openaiBaseUrl, imageModel, zaloToken, zaloOaId, draftRetentionDays, publishedRetentionDays, autoReplyComments, autoReplyMessages } = body;
    const updateData: Record<string, string | number | boolean | null> = {};
    const claudeKeyReplacement = getSecretReplacement(claudeApiKey);
    const openaiKeyReplacement = getSecretReplacement(openaiApiKey);
    const secretReplacements = {
      claudeApiKey: claudeKeyReplacement,
      openaiApiKey: openaiKeyReplacement,
      zaloToken: getSecretReplacement(zaloToken),
      spaApiKey: getSecretReplacement(body.spaApiKey),
      spaWebhookSecret: getSecretReplacement(body.spaWebhookSecret),
      webhookVerifyToken: getSecretReplacement(body.webhookVerifyToken),
    };
    for (const [field, value] of Object.entries(secretReplacements)) {
      if (value !== undefined) updateData[field] = value;
    }

    const currentSettings = await prisma.settings.findFirst();
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
    if (imageModel) updateData.imageModel = imageModel;
    if (body.openaiChatModel) updateData.openaiChatModel = body.openaiChatModel;
    if (zaloOaId !== undefined) updateData.zaloOaId = zaloOaId;
    if (draftRetentionDays !== undefined) updateData.draftRetentionDays = Number(draftRetentionDays);
    if (publishedRetentionDays !== undefined) updateData.publishedRetentionDays = Number(publishedRetentionDays);
    if (body.webhookMode) updateData.webhookMode = body.webhookMode;
    if (autoReplyComments !== undefined) updateData.autoReplyComments = Boolean(autoReplyComments);
    if (autoReplyMessages !== undefined) updateData.autoReplyMessages = Boolean(autoReplyMessages);
    // Autonomous marketing fields
    if (body.spaApiUrl !== undefined) updateData.spaApiUrl = body.spaApiUrl || null;
    if (body.leadHandoffMode) updateData.leadHandoffMode = body.leadHandoffMode;
    if (body.leadHandoffLink !== undefined) updateData.leadHandoffLink = body.leadHandoffLink || null;
    if (body.automationLevel) {
      if (!["supervised", "semi", "full"].includes(body.automationLevel)) {
        return NextResponse.json({ error: "Chế độ tự động không hợp lệ", success: false }, { status: 400 });
      }
      updateData.automationLevel = body.automationLevel;
    }
    if (body.zaloApprovalRecipient !== undefined) updateData.zaloApprovalRecipient = body.zaloApprovalRecipient || null;
    if (body.adsOptimizePauseCtr !== undefined) updateData.adsOptimizePauseCtr = boundedNumber(body.adsOptimizePauseCtr, 0.1, 10, "Pause CTR");
    if (body.adsOptimizeScaleCtr !== undefined) updateData.adsOptimizeScaleCtr = boundedNumber(body.adsOptimizeScaleCtr, 0.2, 20, "Scale CTR");
    if (body.adsOptimizeFreqLimit !== undefined) updateData.adsOptimizeFreqLimit = boundedNumber(body.adsOptimizeFreqLimit, 1, 10, "Frequency");
    if (body.adsOptimizeScalePct !== undefined) updateData.adsOptimizeScalePct = boundedNumber(body.adsOptimizeScalePct, 5, 50, "Phần trăm scale");
    if (body.adsOptimizeMinSpend !== undefined) updateData.adsOptimizeMinSpend = boundedNumber(body.adsOptimizeMinSpend, 50_000, 100_000_000, "Chi tiêu tối thiểu");
    if (body.adsOptimizeMaxBudget !== undefined) updateData.adsOptimizeMaxBudget = boundedNumber(body.adsOptimizeMaxBudget, 100_000, 1_000_000_000, "Trần ngân sách");
    if (body.adsOptimizeCooldownHrs !== undefined) updateData.adsOptimizeCooldownHrs = boundedNumber(body.adsOptimizeCooldownHrs, 4, 168, "Cooldown");
    if (body.adsOptimizeMinRoas !== undefined) updateData.adsOptimizeMinRoas = boundedNumber(body.adsOptimizeMinRoas, 0.5, 20, "ROAS tối thiểu");
    if (
      Number(updateData.adsOptimizePauseCtr ?? body.adsOptimizePauseCtr ?? 0.5)
      >= Number(updateData.adsOptimizeScaleCtr ?? body.adsOptimizeScaleCtr ?? 2)
    ) {
      return NextResponse.json({ error: "Ngưỡng pause phải thấp hơn ngưỡng scale", success: false }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "1" },
      update: updateData,
      create: { id: "1", ...updateData },
    });

    await logActivity({
      type: "settings_change",
      title: "Đã cập nhật cấu hình hệ thống",
      detail: `Thay đổi ${Object.keys(updateData).length} trường cấu hình`,
      href: "/settings",
      severity: "info",
      source: "settings_api",
      metadata: { userId: user.id, fields: Object.keys(updateData).filter((key) => !key.toLowerCase().includes("key") && !key.toLowerCase().includes("secret") && !key.toLowerCase().includes("token")) },
    }).catch(() => null);

    return NextResponse.json({
      data: safeSettings(settings),
      success: true,
    });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, success: false }, { status: e instanceof RangeError || e instanceof ProviderUrlError ? 400 : 500 });
  }
}
