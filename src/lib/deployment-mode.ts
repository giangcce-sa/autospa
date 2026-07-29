export type DeploymentMode = "persistent" | "stateless";
export type DeploymentModeSource = "explicit" | "vercel_fallback" | "compatibility_fallback" | "invalid";

export interface DeploymentModeResolution {
  mode: DeploymentMode;
  source: DeploymentModeSource;
  valid: boolean;
}

export function resolveDeploymentMode(env: NodeJS.ProcessEnv = process.env): DeploymentModeResolution {
  if (env.DEPLOYMENT_MODE === "persistent" || env.DEPLOYMENT_MODE === "stateless") {
    return { mode: env.DEPLOYMENT_MODE, source: "explicit", valid: true };
  }
  if (env.DEPLOYMENT_MODE) {
    return { mode: "stateless", source: "invalid", valid: false };
  }
  if (env.VERCEL || env.VERCEL_ENV) {
    return { mode: "stateless", source: "vercel_fallback", valid: true };
  }
  return { mode: "persistent", source: "compatibility_fallback", valid: true };
}
