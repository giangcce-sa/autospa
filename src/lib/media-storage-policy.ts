import { resolveDeploymentMode, type DeploymentMode, type DeploymentModeSource } from "./deployment-mode.ts";

export type MediaStorageProvider = "local" | "s3";

export interface MediaStoragePolicy {
  allowed: boolean;
  blocker: string | null;
  configured: boolean;
  deploymentMode: DeploymentMode;
  deploymentModeSource: DeploymentModeSource;
  durable: boolean;
  provider: MediaStorageProvider;
}

export function resolveMediaStoragePolicy(env: NodeJS.ProcessEnv = process.env): MediaStoragePolicy {
  const deployment = resolveDeploymentMode(env);
  const rawProvider = env.MEDIA_STORAGE_PROVIDER || "local";
  const provider = rawProvider === "s3" ? "s3" : "local";
  const providerValid = rawProvider === "local" || rawProvider === "s3";
  const credentialPairValid = Boolean(env.MEDIA_S3_ACCESS_KEY_ID) === Boolean(env.MEDIA_S3_SECRET_ACCESS_KEY);
  const bucketConfigured = Boolean(env.MEDIA_S3_BUCKET);

  let blocker: string | null = null;
  if (!deployment.valid) blocker = "DEPLOYMENT_MODE phải là persistent hoặc stateless.";
  else if (!providerValid) blocker = "MEDIA_STORAGE_PROVIDER phải là local hoặc s3.";
  else if (provider === "local" && deployment.mode === "stateless") blocker = "Local media không bền vững trên deployment stateless; hãy dùng S3.";
  else if (provider === "s3" && !bucketConfigured) blocker = "Storage S3 đã chọn nhưng chưa có MEDIA_S3_BUCKET.";
  else if (provider === "s3" && !credentialPairValid) blocker = "MEDIA_S3_ACCESS_KEY_ID và MEDIA_S3_SECRET_ACCESS_KEY phải được cấu hình cùng nhau.";
  else if (provider === "s3" && env.MEDIA_S3_ENDPOINT && !env.MEDIA_S3_ACCESS_KEY_ID) blocker = "S3-compatible endpoint tùy chỉnh yêu cầu access key và secret key.";

  const allowed = blocker === null;
  return {
    allowed,
    blocker,
    configured: allowed,
    deploymentMode: deployment.mode,
    deploymentModeSource: deployment.source,
    durable: allowed && (provider === "s3" || deployment.mode === "persistent"),
    provider,
  };
}
