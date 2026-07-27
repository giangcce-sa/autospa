import { probeAdsReadiness } from "@/lib/ads-readiness";
import { prisma } from "@/lib/db";
import { safeFacebookPage } from "@/lib/facebook-page-response";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { encryptSecret } from "@/lib/secrets-crypto";
import { NextRequest, NextResponse } from "next/server";

function normalizeAdAccountId(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/^act_/, "");
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) throw new RangeError("Ad Account ID không hợp lệ");
  return normalized;
}

const resetReadiness = {
  adsReadinessStatus: "unchecked",
  adsReadinessError: null,
  adsReadinessCheckedAt: null,
  adsTokenExpiresAt: null,
  adsDataAccessExpiresAt: null,
  adsPermissions: "[]",
  adsMissingPermissions: "[]",
  adAccountStatus: null,
  adAccountDisableReason: null,
  adAccountCurrency: null,
  adAccountTimezone: null,
} as const;

export async function GET() {
  try {
    const user = await requireUser();
    const allowedPageIds = user.role === "owner" ? null : (await prisma.userPageAccess.findMany({
      where: { userId: user.id },
      select: { facebookPageId: true },
    })).map((item) => item.facebookPageId);
    const pages = await prisma.facebookPage.findMany({
      where: user.role === "owner" ? {} : { isActive: true, id: { in: allowedPageIds || [] } },
      orderBy: { createdAt: "asc" },
    });
    const safe = pages.map(safeFacebookPage);
    return NextResponse.json({ data: safe, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { fbPageId, accessToken } = body;
      if (!fbPageId || !accessToken) return NextResponse.json({ success: false, message: "Thiếu Page ID hoặc Access Token" });
      try {
        const url = new URL(`https://graph.facebook.com/v21.0/${fbPageId}`);
        url.searchParams.set("fields", "name,id");
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        if (data.name) return NextResponse.json({ success: true, message: `Kết nối thành công! Page: ${data.name}`, pageName: data.name });
        return NextResponse.json({ success: false, message: data.error?.message || "Token không hợp lệ" });
      } catch (e) {
        console.error("facebook page test connection failed:", e);
        return NextResponse.json({ success: false, message: "Không thể kết nối — kiểm tra Page ID và Access Token" });
      }
    }

    if (action === "add") {
      const { fbPageId, pageName, accessToken, adAccountId } = body;
      if (!fbPageId?.trim() || !pageName?.trim() || !accessToken?.trim()) {
        return NextResponse.json({ error: "Thiếu Page ID, tên page hoặc Access Token", success: false }, { status: 400 });
      }
      const adActId = normalizeAdAccountId(adAccountId);
      const storedToken = encryptSecret(accessToken.trim());
      const page = await prisma.facebookPage.upsert({
        where: { fbPageId: fbPageId.trim() },
        create: { fbPageId: fbPageId.trim(), pageName: pageName.trim(), accessToken: storedToken, adAccountId: adActId },
        update: {
          pageName: pageName.trim(),
          accessToken: storedToken,
          adAccountId: adActId,
          ...resetReadiness,
        },
      });
      return NextResponse.json({ data: safeFacebookPage(page), success: true });
    }

    if (action === "update") {
      const { id, pageName, accessToken, adAccountId } = body;
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      const data: Record<string, string | null | number | Date> = {};
      if (pageName?.trim()) data.pageName = pageName.trim();
      if (accessToken?.trim()) data.accessToken = encryptSecret(accessToken.trim());
      if ("adAccountId" in body) data.adAccountId = normalizeAdAccountId(adAccountId);
      if (accessToken?.trim() || "adAccountId" in body) Object.assign(data, resetReadiness);
      await prisma.facebookPage.update({ where: { id }, data });
      return NextResponse.json({ success: true });
    }

    if (action === "update-ad-account") {
      const { id, adAccountId } = body;
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      await prisma.facebookPage.update({
        where: { id },
        data: { adAccountId: normalizeAdAccountId(adAccountId), ...resetReadiness },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "check-ads-readiness") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      const page = await prisma.facebookPage.findUnique({
        where: { id },
        select: { id: true, fbPageId: true, accessToken: true, adAccountId: true },
      });
      if (!page) return NextResponse.json({ error: "Không tìm thấy", success: false }, { status: 404 });
      const readiness = await probeAdsReadiness(page);
      return NextResponse.json({ data: readiness, success: readiness.status === "ready" });
    }

    if (action === "toggle") {
      const { id } = body;
      const page = await prisma.facebookPage.findUnique({ where: { id } });
      if (!page) return NextResponse.json({ error: "Không tìm thấy", success: false }, { status: 404 });
      await prisma.facebookPage.update({ where: { id }, data: { isActive: !page.isActive } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi không xác định");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
    await prisma.facebookPage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi khi xóa");
  }
}
