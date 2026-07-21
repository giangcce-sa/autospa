export type AdsExecutionMode = "read_only" | "supervised_manual" | "semi" | "full";

const MODE_RANK: Record<AdsExecutionMode, number> = {
  read_only: 0,
  supervised_manual: 1,
  semi: 2,
  full: 3,
};

const VALID_MODES = new Set<AdsExecutionMode>([
  "read_only",
  "supervised_manual",
  "semi",
  "full",
]);

export class AdsMutationBlockedError extends Error {
  readonly status = 423;
  readonly operation: string;

  constructor(message: string, operation: string) {
    super(message);
    this.name = "AdsMutationBlockedError";
    this.operation = operation;
  }
}

function parseList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function getAdsExecutionMode(env: NodeJS.ProcessEnv = process.env): AdsExecutionMode {
  const value = env.ADS_EXECUTION_MODE as AdsExecutionMode | undefined;
  return value && VALID_MODES.has(value) ? value : "read_only";
}

export function getEffectiveAdsAutomationLevel(
  configuredLevel: string,
  env: NodeJS.ProcessEnv = process.env,
): "supervised" | "semi" | "full" {
  if (env.ADS_EMERGENCY_STOP !== "false") return "supervised";

  const mode = getAdsExecutionMode(env);
  if (mode === "read_only" || mode === "supervised_manual") return "supervised";
  if (mode === "semi") {
    return configuredLevel === "semi" || configuredLevel === "full" ? "semi" : "supervised";
  }
  if (configuredLevel === "semi" || configuredLevel === "full") return configuredLevel;
  return "supervised";
}

export function shouldForceAdsDryRun(env: NodeJS.ProcessEnv = process.env) {
  const mode = getAdsExecutionMode(env);
  return env.ADS_EMERGENCY_STOP !== "false" || mode === "read_only" || mode === "supervised_manual";
}

export function evaluateAdsMutation(input: {
  operation: string;
  facebookPageId?: string;
  adAccountId?: string;
  minimumMode?: Exclude<AdsExecutionMode, "read_only">;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const mode = getAdsExecutionMode(env);
  const minimumMode = input.minimumMode ?? "supervised_manual";

  if (env.ADS_EMERGENCY_STOP !== "false") {
    return { allowed: false as const, mode, reason: "Facebook Ads đang bị khóa khẩn cấp" };
  }
  if (MODE_RANK[mode] < MODE_RANK[minimumMode]) {
    return {
      allowed: false as const,
      mode,
      reason: `Facebook Ads đang ở chế độ ${mode}; thao tác ${input.operation} yêu cầu ${minimumMode}`,
    };
  }

  const allowedPages = parseList(env.ADS_ALLOWED_FACEBOOK_PAGE_IDS);
  if (!input.facebookPageId || !allowedPages.has(input.facebookPageId)) {
    return {
      allowed: false as const,
      mode,
      reason: "Facebook Page chưa nằm trong allowlist quảng cáo",
    };
  }

  const allowedAccounts = parseList(env.ADS_ALLOWED_AD_ACCOUNT_IDS);
  const normalizedAccountId = input.adAccountId?.replace(/^act_/, "");
  const accountAllowed = input.adAccountId && (
    allowedAccounts.has(input.adAccountId) ||
    (normalizedAccountId ? allowedAccounts.has(normalizedAccountId) : false) ||
    (normalizedAccountId ? allowedAccounts.has(`act_${normalizedAccountId}`) : false)
  );
  if (!accountAllowed) {
    return {
      allowed: false as const,
      mode,
      reason: "Ad Account chưa nằm trong allowlist quảng cáo",
    };
  }

  return { allowed: true as const, mode };
}

export function adsMutationErrorResponse(error: unknown) {
  if (error instanceof AdsMutationBlockedError) {
    return Response.json(
      { success: false, error: error.message, operation: error.operation },
      { status: error.status },
    );
  }
  return null;
}

export async function enforceAdsMutation(input: {
  operation: string;
  facebookPageId?: string;
  adAccountId?: string;
  minimumMode?: Exclude<AdsExecutionMode, "read_only">;
}) {
  const decision = evaluateAdsMutation(input);
  if (decision.allowed) return decision;

  const error = new AdsMutationBlockedError(decision.reason, input.operation);
  try {
    const { logActivity } = await import("@/lib/activity-log");
    await logActivity({
      type: "ads_mutation_blocked",
      title: "Đã chặn thao tác Facebook Ads",
      detail: decision.reason,
      href: "/facebook-ads",
      severity: "warning",
      source: "ads-safety",
      metadata: {
        operation: input.operation,
        facebookPageId: input.facebookPageId,
        adAccountId: input.adAccountId,
        executionMode: decision.mode,
      },
    });
  } catch {
    // The safety decision must not depend on audit persistence.
  }
  throw error;
}
