import { NextResponse } from "next/server";
import { getAutomationOperationsData } from "@/lib/automation-operations";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const data = await getAutomationOperationsData();
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        spaSync: data.spa.sync,
        adsReadiness: {
          automationLevel: data.ads.policy.effectiveAutomationLevel,
          pauseCtr: data.ads.policy.pauseCtr,
          scaleCtr: data.ads.policy.scaleCtr,
          maxBudget: data.ads.policy.maxBudget,
          cooldownHours: data.ads.policy.cooldownHours,
          minRoas: data.ads.policy.minRoas,
          configuredAdsPages: data.ads.configuredPageCount,
          hasApprovalRecipient: data.ads.policy.hasApprovalRecipient,
        },
      },
    });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}
