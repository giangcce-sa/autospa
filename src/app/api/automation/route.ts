import { NextResponse } from "next/server";
import { getAutomationOperationsData } from "@/lib/automation-operations";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

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
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), success: false }, { status: 500 });
  }
}
