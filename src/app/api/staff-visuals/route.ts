import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const CONSENT_STATUSES = new Set(["consented", "limited", "blocked"]);

function compact(value: unknown, limit = 800) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = searchParams.get("facebookPageId") || null;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const staff = await prisma.staffVisualProfile.findMany({
      where: {
        facebookPageId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        samples: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "create") {
      const name = compact(body.name, 120);
      const promptDescriptor = compact(body.promptDescriptor, 1000);
      const consentStatus = CONSENT_STATUSES.has(body.consentStatus) ? body.consentStatus : "consented";
      if (!name || !promptDescriptor) {
        return NextResponse.json({ success: false, error: "Thiếu tên hoặc mô tả nhân viên cho prompt" }, { status: 400 });
      }

      const staff = await prisma.staffVisualProfile.create({
        data: {
          facebookPageId: body.facebookPageId || null,
          name,
          role: compact(body.role, 120) || null,
          gender: compact(body.gender, 40) || "female",
          referenceImageUrl: compact(body.referenceImageUrl, 1000) || null,
          promptDescriptor,
          appearanceNotes: compact(body.appearanceNotes, 800) || null,
          uniformNotes: compact(body.uniformNotes, 800) || null,
          usageNotes: compact(body.usageNotes, 800) || null,
          consentStatus,
          samples: body.referenceImageUrl ? {
            create: {
              imageUrl: compact(body.referenceImageUrl, 1000),
              angle: compact(body.angle, 80) || null,
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

    if (action === "update") {
      if (!body.id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
      const data: Record<string, unknown> = {};
      const allowed = [
        "name", "role", "gender", "referenceImageUrl", "promptDescriptor",
        "appearanceNotes", "uniformNotes", "usageNotes", "isActive",
      ] as const;
      for (const key of allowed) {
        if (body[key] !== undefined) data[key] = typeof body[key] === "string" ? compact(body[key], 1000) || null : body[key];
      }
      if (body.consentStatus !== undefined) {
        if (!CONSENT_STATUSES.has(body.consentStatus)) {
          return NextResponse.json({ success: false, error: "Consent status không hợp lệ" }, { status: 400 });
        }
        data.consentStatus = body.consentStatus;
      }
      const staff = await prisma.staffVisualProfile.update({
        where: { id: body.id },
        data,
        include: { samples: true },
      });
      return NextResponse.json({ success: true, data: staff });
    }

    if (action === "add-sample") {
      if (!body.staffId || !body.imageUrl) {
        return NextResponse.json({ success: false, error: "Thiếu staffId hoặc imageUrl" }, { status: 400 });
      }
      if (body.isPrimary === true) {
        await prisma.staffVisualSample.updateMany({
          where: { staffId: body.staffId },
          data: { isPrimary: false },
        });
      }
      const sample = await prisma.staffVisualSample.create({
        data: {
          staffId: body.staffId,
          imageUrl: compact(body.imageUrl, 1000),
          angle: compact(body.angle, 80) || null,
          expression: compact(body.expression, 120) || null,
          outfit: compact(body.outfit, 160) || null,
          notes: compact(body.notes, 400) || null,
          isPrimary: body.isPrimary === true,
        },
      });
      if (body.isPrimary === true) {
        await prisma.staffVisualProfile.update({
          where: { id: body.staffId },
          data: { referenceImageUrl: sample.imageUrl },
        });
      }
      return NextResponse.json({ success: true, data: sample });
    }

    if (action === "delete-sample") {
      if (!body.id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
      const sample = await prisma.staffVisualSample.findUnique({ where: { id: body.id } });
      if (!sample) return NextResponse.json({ success: false, error: "Không tìm thấy ảnh mẫu" }, { status: 404 });
      await prisma.staffVisualSample.delete({ where: { id: body.id } });
      if (sample.isPrimary) {
        const next = await prisma.staffVisualSample.findFirst({
          where: { staffId: sample.staffId },
          orderBy: { createdAt: "desc" },
        });
        if (next) {
          await prisma.$transaction([
            prisma.staffVisualSample.update({ where: { id: next.id }, data: { isPrimary: true } }),
            prisma.staffVisualProfile.update({ where: { id: sample.staffId }, data: { referenceImageUrl: next.imageUrl } }),
          ]);
        } else {
          await prisma.staffVisualProfile.update({ where: { id: sample.staffId }, data: { referenceImageUrl: null } });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === "set-primary-sample") {
      if (!body.id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
      const sample = await prisma.staffVisualSample.findUnique({ where: { id: body.id } });
      if (!sample) return NextResponse.json({ success: false, error: "Không tìm thấy ảnh mẫu" }, { status: 404 });
      await prisma.$transaction([
        prisma.staffVisualSample.updateMany({ where: { staffId: sample.staffId }, data: { isPrimary: false } }),
        prisma.staffVisualSample.update({ where: { id: sample.id }, data: { isPrimary: true } }),
        prisma.staffVisualProfile.update({ where: { id: sample.staffId }, data: { referenceImageUrl: sample.imageUrl } }),
      ]);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!body.id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
      await prisma.staffVisualProfile.update({ where: { id: body.id }, data: { isActive: false } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Action không hợp lệ" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
