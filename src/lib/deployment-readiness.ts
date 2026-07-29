import { resolveMediaStoragePolicy } from "./media-storage-policy.ts";
import { resolveProductionEnvironmentPolicy } from "./production-environment-policy.ts";
import { resolveVideoExecutionPolicy } from "./video-studio/execution-policy.ts";

export interface DeploymentReadiness {
  ready: boolean;
  checks: {
    database: boolean;
    authSecret: boolean;
    cronSecret: boolean;
    publicHttpsOrigin: boolean;
    mediaStorage: boolean;
    productionEnvironment: boolean;
  };
  deployment: {
    mode: "persistent" | "stateless";
    source: "explicit" | "vercel_fallback" | "compatibility_fallback" | "invalid";
  };
  media: {
    provider: "local" | "s3";
    configured: boolean;
    durable: boolean;
  };
  safety: {
    adsExecutionMode: string;
    adsEmergencyStop: boolean;
    videoExecutionMode: "mock" | "live";
    videoEmergencyStop: boolean;
  };
  release: string | null;
  environment: string;
}

function publicHttpsOrigin(env: NodeJS.ProcessEnv) {
  const value = env.NEXT_PUBLIC_APP_URL || env.AUTH_URL;
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildDeploymentReadiness(input: {
  database: boolean;
  env?: NodeJS.ProcessEnv;
}): DeploymentReadiness {
  const env = input.env ?? process.env;
  const mediaPolicy = resolveMediaStoragePolicy(env);
  const productionEnvironment = resolveProductionEnvironmentPolicy(env);
  const checks = {
    database: input.database,
    authSecret: Boolean(env.AUTH_SECRET),
    cronSecret: Boolean(env.CRON_SECRET),
    publicHttpsOrigin: publicHttpsOrigin(env),
    mediaStorage: mediaPolicy.allowed,
    productionEnvironment: productionEnvironment.valid,
  };
  const videoPolicy = resolveVideoExecutionPolicy({
    requestedMockMode: env.VIDEO_MOCK_MODE !== "false",
    deploymentMode: env.VIDEO_EXECUTION_MODE,
    emergencyStop: env.VIDEO_EMERGENCY_STOP,
  });

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    deployment: {
      mode: mediaPolicy.deploymentMode,
      source: mediaPolicy.deploymentModeSource,
    },
    media: {
      provider: mediaPolicy.provider,
      configured: mediaPolicy.configured,
      durable: mediaPolicy.durable,
    },
    safety: {
      adsExecutionMode: env.ADS_EXECUTION_MODE || "read_only",
      adsEmergencyStop: env.ADS_EMERGENCY_STOP !== "false",
      videoExecutionMode: videoPolicy.mode,
      videoEmergencyStop: videoPolicy.emergencyStop,
    },
    release: env.APP_RELEASE || env.VERCEL_GIT_COMMIT_SHA || null,
    environment: env.DEPLOYMENT_ENV || env.VERCEL_ENV || env.NODE_ENV || "development",
  };
}
