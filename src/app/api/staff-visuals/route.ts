import { prisma } from "@/lib/db";
import { deleteMedia } from "@/lib/media-storage";
import { requireExplicitPageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";

const CONSENT_STATUSES = new Set(["consented", "limited", "blocked"]);

function compact(value: unknown, limit = 800) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function pageIdFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isManagedStaffImage(url: string | null) {
  return !url || url.startsWith("/api/media/staff-visuals/") || url.startsWith("/uploads/staff-visuals/");
}

async function findStaff(id: string, facebookPageId: string | null) {
  return prisma.staffVisualProfile.findFirst({
    where: { id, facebookPageId },
    include: { samples: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = pageIdFrom(searchParams.get("facebookPageId"));
    await requireExplicitPageAccess(facebookPageId);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const staff = await prisma.staffVisualProfile.findMany({
      where: { facebookPageId, ...(includeInactive ? {} : { isActive: true }) },
      include: { samples: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] } },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";
    const facebookPageId = pageIdFrom(body.facebookPageId);
    await requireExplicitPageAccess(facebookPageId, { owner: true });

    if (action === "create") {
      const name = compact(body.name, 120);
      const promptDescriptor = compact(body.promptDescriptor, 1000);
      const consentStatus = CONSENT_STATUSES.has(body.consentStatus) ? body.consentStatus : "consented";
      if (!name || !promptDescriptor) {
        return NextResponse.json({ success: false, error: "Thiếu tên hoặc mô tả nhân viên cho prompt" }, { status: 400 });
      }

      const referenceImageUrl = compact(body.referenceImageUrl, 1000) || null;
      const referenceStorageKey = compact(body.referenceStorageKey, 500) || null;
      if (!isManagedStaffImage(referenceImageUrl)) {
        return NextResponse.json({ success: false, error: "Ảnh nhân viên phải được upload vào thư viện AutoSpa" }, { status: 400 });
      }
      const staff = await prisma.staffVisualProfile.create({
        data: {
          facebookPageId,
          name,
          role: compact(body.role, 120) || null,
          gender: compact(body.gender, 40) || "female",
          referenceImageUrl,
          referenceStorageKey,
          promptDescriptor,
          appearanceNotes: compact(body.appearanceNotes, 800) || null,
          uniformNotes: compact(body.uniformNotes, 800) || null,
          usageNotes: compact(body.usageNotes, 800) || null,
          consentStatus,
          samples: referenceImageUrl ? {
            create: {
              imageUrl: referenceImageUrl,
              storageKey: referenceStorageKey,
              angle: compact(body.angle, 80) || "portrait",
              expression: compact(body.expression, 120) || null,
              outfit: compact(body.outfit, 160) || null,
              notes: compact(body.sampleNotes, 400) || null,
              isPrimary: true,
            },
          } : undefined,
        },
        include: { samples: true },
      });
      return NextResponse.json({ success: true, data: staff });
    }

    if (!body.id && action !== "add-sample") {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
    }

    if (action === "update") {
      const existing = await findStaff(body.id, facebookPageId);
      if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy nhân viên trong Page này" }, { status: 404 });
      if (body.name !== undefined && !compact(body.name, 120)) {
        return NextResponse.json({ success: false, error: "Tên nhân viên không được để trống" }, { status: 400 });
      }
      if (body.promptDescriptor !== undefined && !compact(body.promptDescriptor, 1000)) {
        return NextResponse.json({ success: false, error: "Mô tả nhận diện không được để trống" }, { status: 400 });
      }
      if (body.referenceImageUrl !== undefined && !isManagedStaffImage(compact(body.referenceImageUrl, 1000) || null)) {
        return NextResponse.json({ success: false, error: "Ảnh nhân viên phải được upload vào thư viện AutoSpa" }, { status: 400 });
      }

      const data: Record<string, unknown> = {};
      const nullable = ["role", "referenceImageUrl", "referenceStorageKey", "appearanceNotes", "uniformNotes", "usageNotes"] as const;
      const required = ["name", "gender", "promptDescriptor"] as const;
      for (const key of nullable) if (body[key] !== undefined) data[key] = compact(body[key], 1000) || null;
      for (const key of required) if (body[key] !== undefined) data[key] = compact(body[key], 1000);
      if (typeof body.isActive === "boolean") data.isActive = body.isActive;
      if (body.consentStatus !== undefined) {
        if (!CONSENT_STATUSES.has(body.consentStatus)) {
          return NextResponse.json({ success: false, error: "Consent status không hợp lệ" }, { status: 400 });
        }
        data.consentStatus = body.consentStatus;
      }
      const staff = await prisma.staffVisualProfile.update({ where: { id: existing.id }, data, include: { samples: true } });
      return NextResponse.json({ success: true, data: staff });
    }

    if (action === "add-sample") {
      if (!body.staffId || !body.imageUrl) {
        return NextResponse.json({ success: false, error: "Thiếu staffId hoặc imageUrl" }, { status: 400 });
      }
      if (!isManagedStaffImage(compact(body.imageUrl, 1000))) {
        return NextResponse.json({ success: false, error: "Ảnh mẫu phải được upload vào thư viện AutoSpa" }, { status: 400 });
      }
      const existing = await findStaff(body.staffId, facebookPageId);
      if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy nhân viên trong Page này" }, { status: 404 });
      const sample = await prisma.$transaction(async (tx) => {
        if (body.isPrimary === true) {
          await tx.staffVisualSample.updateMany({ where: { staffId: existing.id }, data: { isPrimary: false } });
        }
        const created = await tx.staffVisualSample.create({
          data: {
            staffId: existing.id,
            imageUrl: compact(body.imageUrl, 1000),
            storageKey: compact(body.storageKey, 500) || null,
            angle: compact(body.angle, 80) || null,
            expression: compact(body.expression, 120) || null,
            outfit: compact(body.outfit, 160) || null,
            notes: compact(body.notes, 400) || null,
            isPrimary: body.isPrimary === true,
          },
        });
        if (body.isPrimary === true) {
          await tx.staffVisualProfile.update({
            where: { id: existing.id },
            data: { referenceImageUrl: created.imageUrl, referenceStorageKey: created.storageKey },
          });
        }
        return created;
      });
      return NextResponse.json({ success: true, data: sample });
    }

    if (action === "delete-sample" || action === "set-primary-sample") {
      const sample = await prisma.staffVisualSample.findFirst({
        where: { id: body.id, staff: { facebookPageId } },
        include: { staff: true },
      });
      if (!sample) return NextResponse.json({ success: false, error: "Không tìm thấy ảnh mẫu trong Page này" }, { status: 404 });

      if (action === "set-primary-sample") {
        await prisma.$transaction([
          prisma.staffVisualSample.updateMany({ where: { staffId: sample.staffId }, data: { isPrimary: false } }),
          prisma.staffVisualSample.update({ where: { id: sample.id }, data: { isPrimary: true } }),
          prisma.staffVisualProfile.update({
            where: { id: sample.staffId },
            data: { referenceImageUrl: sample.imageUrl, referenceStorageKey: sample.storageKey },
          }),
        ]);
        return NextResponse.json({ success: true });
      }

      await prisma.staffVisualSample.delete({ where: { id: sample.id } });
      if (sample.isPrimary) {
        const next = await prisma.staffVisualSample.findFirst({ where: { staffId: sample.staffId }, orderBy: { createdAt: "desc" } });
        await prisma.$transaction([
          ...(next ? [prisma.staffVisualSample.update({ where: { id: next.id }, data: { isPrimary: true } })] : []),
          prisma.staffVisualProfile.update({
            where: { id: sample.staffId },
            data: { referenceImageUrl: next?.imageUrl ?? null, referenceStorageKey: next?.storageKey ?? null },
          }),
        ]);
      }
      await deleteMedia(sample.storageKey).catch(() => null);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const existing = await findStaff(body.id, facebookPageId);
      if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy nhân viên trong Page này" }, { status: 404 });
      await prisma.staffVisualProfile.update({ where: { id: existing.id }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Action không hợp lệ" }, { status: 400 });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
