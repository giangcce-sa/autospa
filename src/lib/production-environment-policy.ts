const SECRET_MIN_LENGTH = 32;
const PLACEHOLDER_PATTERN = /(?:change[-_ ]?me|replace[-_ ]?me|example|placeholder|your[-_ ]|ci-only|local-auth|local-cron)/i;
const ADS_EXECUTION_MODES = new Set(["read_only", "dry_run", "live"]);
const VIDEO_EXECUTION_MODES = new Set(["mock", "live"]);

export interface ProductionEnvironmentPolicy {
  valid: boolean;
  blockers: string[];
}

function validSecret(value: string | undefined) {
  return Boolean(value && value.length >= SECRET_MIN_LENGTH && !PLACEHOLDER_PATTERN.test(value));
}

function httpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function resolveProductionEnvironmentPolicy(env: NodeJS.ProcessEnv = process.env): ProductionEnvironmentPolicy {
  if (env.DEPLOYMENT_ENV !== "production") return { valid: true, blockers: [] };

  const blockers: string[] = [];
  const authOrigin = httpsOrigin(env.AUTH_URL);
  const publicOrigin = httpsOrigin(env.NEXT_PUBLIC_APP_URL);

  if (!validSecret(env.AUTH_SECRET)) blockers.push("AUTH_SECRET phải là secret production tối thiểu 32 ký tự và không phải placeholder.");
  if (!validSecret(env.CRON_SECRET)) blockers.push("CRON_SECRET phải là secret production tối thiểu 32 ký tự và không phải placeholder.");
  if (!authOrigin) blockers.push("AUTH_URL phải là HTTPS origin hợp lệ.");
  if (!publicOrigin) blockers.push("NEXT_PUBLIC_APP_URL phải là HTTPS origin hợp lệ.");
  if (authOrigin && publicOrigin && authOrigin !== publicOrigin) blockers.push("AUTH_URL và NEXT_PUBLIC_APP_URL phải cùng origin.");
  if (env.DEPLOYMENT_MODE !== "persistent" && env.DEPLOYMENT_MODE !== "stateless") blockers.push("DEPLOYMENT_MODE phải được khai báo explicit.");
  if (!env.APP_RELEASE && !env.VERCEL_GIT_COMMIT_SHA) blockers.push("APP_RELEASE hoặc VERCEL_GIT_COMMIT_SHA là bắt buộc.");
  if (!env.ADS_EXECUTION_MODE || !ADS_EXECUTION_MODES.has(env.ADS_EXECUTION_MODE)) blockers.push("ADS_EXECUTION_MODE không hợp lệ hoặc chưa được khai báo.");
  if (env.ADS_EMERGENCY_STOP !== "true" && env.ADS_EMERGENCY_STOP !== "false") blockers.push("ADS_EMERGENCY_STOP phải được khai báo true hoặc false.");
  if (!env.VIDEO_EXECUTION_MODE || !VIDEO_EXECUTION_MODES.has(env.VIDEO_EXECUTION_MODE)) blockers.push("VIDEO_EXECUTION_MODE không hợp lệ hoặc chưa được khai báo.");
  if (env.VIDEO_EMERGENCY_STOP !== "true" && env.VIDEO_EMERGENCY_STOP !== "false") blockers.push("VIDEO_EMERGENCY_STOP phải được khai báo true hoặc false.");

  return { valid: blockers.length === 0, blockers };
}
