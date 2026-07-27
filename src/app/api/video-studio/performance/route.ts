import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";

const schema = z.object({ projectId: z.string(), platform: z.string(), externalPostId: z.string().optional(), views: z.number().int().min(0).default(0), impressions: z.number().int().min(0).default(0), watchTimeSec: z.number().min(0).default(0), completionRate: z.number().min(0).max(1).default(0), clicks: z.number().int().min(0).default(0), leads: z.number().int().min(0).default(0), bookings: z.number().int().min(0).default(0), spend: z.number().min(0).default(0), revenue: z.number().min(0).default(0) });

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const project = await prisma.videoProject.findUnique({ where: { id: data.projectId }, select: { facebookPageId: true } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy project" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    return NextResponse.json({ success: true, data: await prisma.videoPerformance.create({ data }) }, { status: 201 });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
