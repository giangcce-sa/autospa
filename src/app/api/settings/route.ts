import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const GATEWAY_CLAUDE_MODEL = "spa-assistant";
const DIRECT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isAnthropicBaseUrl(url: string) {
  return normalizeBaseUrl(url).includes("anthropic.com");
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
    claudeApiKey: settings.claudeApiKey ? "••••••••" + settings.claudeApiKey.slice(-4) : null,
    openaiApiKey: settings.openaiApiKey ? "••••••••" + settings.openaiApiKey.slice(-4) : null,
    zaloToken: settings.zaloToken ? "••••••••" + settings.zaloToken.slice(-4) : null,
    spaApiKey: settings.spaApiKey ? "••••••••" + settings.spaApiKey.slice(-4) : null,
    spaWebhookSecret: settings.spaWebhookSecret ? "••••••••" + settings.spaWebhookSecret.slice(-4) : null,
    telegramBotToken: settings.telegramBotToken ? "••••••••" + settings.telegramBotToken.slice(-4) : null,
    telegramWebhookSecret: settings.telegramWebhookSecret ? "••••••••" : null,
    hasSpaApiKey: !!settings.spaApiKey,
    hasSpaWebhookSecret: !!settings.spaWebhookSecret,
    hasTelegramBotToken: !!settings.telegramBotToken,
  };
}

export async function GET() {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings) return NextResponse.json({ data: null, success: true });

    return NextResponse.json({ data: safeSettings(settings), success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải cài đặt", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { service, apiKey, baseUrl } = body;
      // Use value passed from form; fall back to DB only if form field is masked/empty
      const settings = await prisma.settings.findFirst();
      const resolveKey = (formVal: string | undefined, dbVal: string | null | undefined) => {
        if (formVal && !formVal.includes("••")) return formVal;
        return dbVal || null;
      };

      if (service === "claude") {
        const key = resolveKey(apiKey, settings?.claudeApiKey);
        const url = normalizeBaseUrl((baseUrl && !baseUrl.includes("••")) ? baseUrl : (settings?.claudeBaseUrl || ANTHROPIC_BASE_URL));
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
        const key = resolveKey(apiKey, settings?.openaiApiKey);
        const oBaseUrl = (body.openaiBaseUrl && !body.openaiBaseUrl.includes("••"))
          ? body.openaiBaseUrl
          : (settings?.openaiBaseUrl || "https://api.openai.com/v1");
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
        const token = resolveKey(apiKey, settings?.zaloToken);
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

    const { claudeApiKey, claudeBaseUrl, openaiApiKey, openaiBaseUrl, imageModel, zaloToken, zaloOaId, draftRetentionDays, publishedRetentionDays, webhookVerifyToken, autoReplyComments, autoReplyMessages } = body;
    const updateData: Record<string, string | number | boolean | null> = {};
    // Secret fields: only update if a non-empty, non-masked value is provided
    if (claudeApiKey?.trim()) updateData.claudeApiKey = claudeApiKey.trim();
    if (openaiApiKey?.trim()) updateData.openaiApiKey = openaiApiKey.trim();
    if (zaloToken?.trim()) updateData.zaloToken = zaloToken.trim();
    if (body.spaApiKey?.trim()) updateData.spaApiKey = body.spaApiKey.trim();
    // Non-secret fields: always update
    if (claudeBaseUrl) updateData.claudeBaseUrl = claudeBaseUrl;
    if (openaiBaseUrl) updateData.openaiBaseUrl = openaiBaseUrl;
    if (imageModel) updateData.imageModel = imageModel;
    if (body.openaiChatModel) updateData.openaiChatModel = body.openaiChatModel;
    if (zaloOaId !== undefined) updateData.zaloOaId = zaloOaId;
    if (draftRetentionDays !== undefined) updateData.draftRetentionDays = Number(draftRetentionDays);
    if (publishedRetentionDays !== undefined) updateData.publishedRetentionDays = Number(publishedRetentionDays);
    if (webhookVerifyToken !== undefined) updateData.webhookVerifyToken = webhookVerifyToken;
    if (body.webhookMode) updateData.webhookMode = body.webhookMode;
    if (autoReplyComments !== undefined) updateData.autoReplyComments = Boolean(autoReplyComments);
    if (autoReplyMessages !== undefined) updateData.autoReplyMessages = Boolean(autoReplyMessages);
    // Autonomous marketing fields
    if (body.spaApiUrl !== undefined) updateData.spaApiUrl = body.spaApiUrl || null;
    if (body.spaWebhookSecret !== undefined) updateData.spaWebhookSecret = body.spaWebhookSecret || null;
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

    return NextResponse.json({
      data: safeSettings(settings),
      success: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, success: false }, { status: e instanceof RangeError ? 400 : 500 });
  }
}
