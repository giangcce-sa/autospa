import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDeploymentReadiness } from "@/lib/deployment-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);
  const readiness = buildDeploymentReadiness({ database });

  return NextResponse.json(readiness, {
    status: readiness.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
