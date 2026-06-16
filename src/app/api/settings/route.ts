import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings) return NextResponse.json({ data: null, success: true });

    const safe = {
      ...settings,
      claudeApiKey: settings.claudeApiKey ? "••••••••" + settings.claudeApiKey.slice(-4) : null,
      openaiApiKey: settings.openaiApiKey ? "••••••••" + settings.openaiApiKey.slice(-4) : null,
      zaloToken: settings.zaloToken ? "••••••••" + settings.zaloToken.slice(-4) : null,
      spaApiKey: settings.spaApiKey ? "••••••••" + settings.spaApiKey.slice(-4) : null,
      openaiBaseUrl: settings.openaiBaseUrl,
      imageModel: settings.imageModel,
      hasSpaApiKey: !!settings.spaApiKey,
    };
    return NextResponse.json({ data: safe, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải cài đặt", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { service, apiKey, baseUrl, pageId } = body;
      // Use value passed from form; fall back to DB only if form field is masked/empty
      const settings = await prisma.settings.findFirst();
      const resolveKey = (formVal: string | undefined, dbVal: string | null | undefined) => {
        if (formVal && !formVal.includes("••")) return formVal;
        return dbVal || null;
      };

      if (service === "claude") {
        const key = resolveKey(apiKey, settings?.claudeApiKey);
        const url = (baseUrl && !baseUrl.includes("••")) ? baseUrl : (settings?.claudeBaseUrl || "https://api.anthropic.com");
        if (!key) return NextResponse.json({ success: false, message: "Chưa có API key — nhập key rồi test" });
        try {
          const res = await fetch(`${url}/v1/messages`, {
            method: "POST",
            headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
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
        if (!key) return NextResponse.json({ success: false, message: "Chưa có API key — nhập key rồi test" });
        try {
          const res = await fetch(`${oBaseUrl.replace(/\/$/, "")}/models`, {
            headers: { Authorization: `Bearer ${key}` },
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
    if (body.automationLevel) updateData.automationLevel = body.automationLevel;
    if (body.zaloApprovalRecipient !== undefined) updateData.zaloApprovalRecipient = body.zaloApprovalRecipient || null;
    if (body.adsOptimizePauseCtr !== undefined) updateData.adsOptimizePauseCtr = Number(body.adsOptimizePauseCtr);
    if (body.adsOptimizeScaleCtr !== undefined) updateData.adsOptimizeScaleCtr = Number(body.adsOptimizeScaleCtr);
    if (body.adsOptimizeFreqLimit !== undefined) updateData.adsOptimizeFreqLimit = Number(body.adsOptimizeFreqLimit);
    if (body.adsOptimizeScalePct !== undefined) updateData.adsOptimizeScalePct = Number(body.adsOptimizeScalePct);

    const settings = await prisma.settings.upsert({
      where: { id: "1" },
      update: updateData,
      create: { id: "1", ...updateData },
    });

    return NextResponse.json({
      data: {
        ...settings,
        claudeApiKey: settings.claudeApiKey ? true : null,
        openaiApiKey: settings.openaiApiKey ? true : null,
        zaloToken: settings.zaloToken ? true : null,
      },
      success: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
