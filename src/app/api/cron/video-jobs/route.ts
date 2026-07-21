import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { pollVideoJob } from "@/lib/video-studio/service";
import { processInternalVideoJobs } from "@/lib/video-studio/worker";

export const maxDuration = 900;

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const internal = await processInternalVideoJobs(1);
  const jobs = await prisma.videoJob.findMany({
    where: { provider: { not: "internal" }, status: { in: ["queued", "processing"] }, OR: [{ nextPollAt: null }, { nextPollAt: { lte: new Date() } }] },
    orderBy: { nextPollAt: "asc" },
    take: 20,
    select: { id: true },
  });
  const results = [];
  for (const job of jobs) {
    const result = await pollVideoJob(job.id).catch((error) => ({ id: job.id, status: "error", error: error instanceof Error ? error.message : String(error) }));
    results.push(result);
  }
  return NextResponse.json({ success: true, processed: results.length + internal.length, data: { internal, providers: results } });
}
