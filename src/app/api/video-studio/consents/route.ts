import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { requirePageAccess } from "@/lib/page-access";
import { createHash } from "crypto";

const schema = z.object({
  subjectType: z.enum(["staff", "customer", "owner"]),
  subjectId: z.string().min(1),
  subjectName: z.string().trim().min(2).max(120),
  facebookPageId: z.string().nullable().optional(),
  scopes: z.array(z.enum(["video_analysis", "face_generation", "voice_clone", "lip_sync", "advertising"])).min(1),
  evidenceUrl: z.string().nullable().optional(),
  storageKey: z.string().nullable().optional(),
  expiresAt: z.string().datetime(),
  notes: z.string().max(1000).nullable().optional(),
  evidenceType: z.enum(["signed_form", "digital_attestation", "contract"]),
  evidenceText: z.string().trim().min(20).max(2000),
  confirmed: z.literal(true),
  termsVersion: z.string().trim().min(3).max(80).default("video-consent-v1"),
});

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const subjectId = new URL(req.url).searchParams.get("subjectId");
    const data = await prisma.videoConsent.findMany({ where: { facebookPageId, ...(subjectId ? { subjectId } : {}) }, orderBy: { updatedAt: "desc" }, take: 100 });
    return NextResponse.json({ success: true, data: data.map((item) => ({ ...item, scopes: JSON.parse(item.scopes) })) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const input = schema.parse(await req.json());
    await requirePageAccess(input.facebookPageId, { owner: true });
    let subjectName = input.subjectName;
    if (input.subjectType === "staff") {
      const staff = await prisma.staffVisualProfile.findFirst({
        where: { id: input.subjectId, facebookPageId: input.facebookPageId || null, isActive: true },
        select: { name: true, consentStatus: true },
      });
      if (!staff) return NextResponse.json({ success: false, error: "Nhân viên không thuộc Trang đã chọn" }, { status: 404 });
      if (staff.consentStatus === "blocked") return NextResponse.json({ success: false, error: "Nhân viên đã chặn sử dụng danh tính" }, { status: 422 });
      subjectName = staff.name;
    } else if (input.subjectType === "customer") {
      const customer = await prisma.customer.findFirst({
        where: input.facebookPageId
          ? { id: input.subjectId, messages: { some: { facebookPageId: input.facebookPageId } } }
          : { id: input.subjectId },
        select: { name: true },
      });
      if (!customer) return NextResponse.json({ success: false, error: "Khách hàng không thuộc Trang đã chọn" }, { status: 404 });
      subjectName = customer.name;
    } else if (input.subjectId !== user.id) {
      return NextResponse.json({ success: false, error: "Chủ thể xác nhận không khớp tài khoản hiện tại" }, { status: 422 });
    }
    if (input.storageKey) {
      const evidence = await prisma.videoAsset.findFirst({
        where: { storageKey: input.storageKey, project: { facebookPageId: input.facebookPageId || null } },
        select: { url: true },
      });
      if (!evidence || (input.evidenceUrl && input.evidenceUrl !== evidence.url)) {
        return NextResponse.json({ success: false, error: "Tệp bằng chứng không thuộc Trang đã chọn" }, { status: 422 });
      }
    }
    const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= new Date() || expiresAt > new Date(Date.now() + 2 * 365 * 86_400_000)) {
      return NextResponse.json({ success: false, error: "Thời hạn đồng ý phải ở trong tương lai và không được quá 2 năm" }, { status: 400 });
    }
    const evidenceHash = createHash("sha256").update(JSON.stringify({ subjectId: input.subjectId, scopes: input.scopes, evidenceText: input.evidenceText, termsVersion: input.termsVersion })).digest("hex");
    const { evidenceText, ...consentInput } = input;
    delete (consentInput as Partial<typeof consentInput> & { confirmed?: true }).confirmed;
    const consent = await prisma.videoConsent.create({
      data: { ...consentInput, subjectName, scopes: JSON.stringify(input.scopes), expiresAt, notes: [input.notes, evidenceText].filter(Boolean).join("\n\n"), evidenceHash, status: "active", grantedAt: new Date(), grantedBy: user.id },
    });
    return NextResponse.json({ success: true, data: consent }, { status: 201 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { id } = await req.json();
    const consent = await prisma.videoConsent.findUnique({ where: { id } });
    if (!consent) return NextResponse.json({ success: false, error: "Không tìm thấy xác nhận đồng ý" }, { status: 404 });
    await requirePageAccess(consent.facebookPageId, { owner: true });
    await prisma.videoConsent.update({ where: { id }, data: { status: "revoked", revokedAt: new Date() } });
    await prisma.videoVoiceProfile.updateMany({ where: { consentId: id }, data: { status: "revoked", isActive: false } });
    const scenes = await prisma.videoScene.findMany({
      where: { staffProfileId: consent.subjectId, project: { facebookPageId: consent.facebookPageId } },
      select: { projectId: true },
    });
    const projectIds = [...new Set(scenes.map((scene) => scene.projectId))];
    if (projectIds.length) await prisma.videoProject.updateMany({ where: { id: { in: projectIds } }, data: { approvalStatus: "draft", approvedRevision: null, approvedAt: null, approvedBy: null, status: "review" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
