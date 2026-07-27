import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { reconcileExpiredPublishOperations } from "@/lib/publishing/service";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    return NextResponse.json({ success: true, data: await reconcileExpiredPublishOperations() });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi đối soát đăng bài");
  }
}
