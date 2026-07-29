import { generateAdCreative } from "@/lib/ads-creative";
import { parseAdCreativeRequest } from "@/lib/ads-creative-policy";
import { routeErrorResponse } from "@/lib/api-response";
import { requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const input = parseAdCreativeRequest(await req.json());
    await requirePageAccess(input.facebookPageId, { owner: true });
    const spec = await generateAdCreative(input);
    return NextResponse.json({ data: spec, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Không tạo được creative");
  }
}
