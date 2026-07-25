export type SecurityConfigurationSource = "database" | "deployment" | "database_or_deployment";

export interface SecuritySecretStatus {
  id: string;
  label: string;
  configured: boolean;
  source: SecurityConfigurationSource;
}

export interface SecurityDeploymentStatus {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
}

export interface SecuritySettingsInput {
  databaseSecrets: {
    claude: boolean;
    openai: boolean;
    spaApi: boolean;
    spaWebhook: boolean;
    webhookVerify: boolean;
    zalo: boolean;
    telegram: boolean;
    runway: boolean;
    elevenLabs: boolean;
    sync: boolean;
  };
  deployment: {
    authSecret: boolean;
    cronSecret: boolean;
    publicBaseUrl?: string;
    mediaStorageProvider: "local" | "s3";
    mediaS3Bucket: boolean;
    runway: boolean;
    elevenLabs: boolean;
    sync: boolean;
  };
}

function secret(
  id: string,
  label: string,
  configured: boolean,
  source: SecurityConfigurationSource,
): SecuritySecretStatus {
  return { id, label, configured, source };
}

export function buildSecurityConfiguration(input: SecuritySettingsInput) {
  const videoSource = (database: boolean, deployment: boolean): SecurityConfigurationSource =>
    database ? "database" : deployment ? "deployment" : "database_or_deployment";
  const publicBaseUrl = input.deployment.publicBaseUrl;
  const publicBaseUrlIsHttps = (() => {
    if (!publicBaseUrl) return false;
    try {
      return new URL(publicBaseUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();
  const storageConfigured = input.deployment.mediaStorageProvider === "local" || input.deployment.mediaS3Bucket;

  const secrets = [
    secret("auth", "Khóa ký phiên đăng nhập", input.deployment.authSecret, "deployment"),
    secret("cron", "Khóa xác thực cron", input.deployment.cronSecret, "deployment"),
    secret("claude", "Claude API key", input.databaseSecrets.claude, "database"),
    secret("openai", "OpenAI API key", input.databaseSecrets.openai, "database"),
    secret("spa-api", "Spa API key", input.databaseSecrets.spaApi, "database"),
    secret("spa-webhook", "Spa webhook secret", input.databaseSecrets.spaWebhook, "database"),
    secret("webhook-verify", "Webhook verify token", input.databaseSecrets.webhookVerify, "database"),
    secret("zalo", "Zalo access token", input.databaseSecrets.zalo, "database"),
    secret("telegram", "Telegram bot token", input.databaseSecrets.telegram, "database"),
    secret(
      "runway",
      "Runway API key",
      input.databaseSecrets.runway || input.deployment.runway,
      videoSource(input.databaseSecrets.runway, input.deployment.runway),
    ),
    secret(
      "elevenlabs",
      "ElevenLabs API key",
      input.databaseSecrets.elevenLabs || input.deployment.elevenLabs,
      videoSource(input.databaseSecrets.elevenLabs, input.deployment.elevenLabs),
    ),
    secret(
      "sync",
      "Sync Labs API key",
      input.databaseSecrets.sync || input.deployment.sync,
      videoSource(input.databaseSecrets.sync, input.deployment.sync),
    ),
  ];

  const deployment: SecurityDeploymentStatus[] = [
    {
      id: "auth-secret",
      label: "Auth.js signing secret",
      configured: input.deployment.authSecret,
      detail: input.deployment.authSecret
        ? "Phiên JWT và signed media URL có khóa ký từ deployment."
        : "Thiếu AUTH_SECRET; đăng nhập, mã hóa Video key và signed media URL không an toàn để chạy production.",
    },
    {
      id: "cron-secret",
      label: "Cron authorization",
      configured: input.deployment.cronSecret,
      detail: input.deployment.cronSecret
        ? "Cron endpoint yêu cầu bearer secret do deployment quản lý."
        : "Thiếu CRON_SECRET; production sẽ từ chối cron request.",
    },
    {
      id: "public-origin",
      label: "Public HTTPS origin",
      configured: publicBaseUrlIsHttps,
      detail: publicBaseUrlIsHttps
        ? "Public base URL dùng HTTPS cho callback, webhook và signed media URL."
        : "Chưa có public HTTPS origin hợp lệ trong NEXT_PUBLIC_APP_URL hoặc AUTH_URL.",
    },
    {
      id: "media-storage",
      label: "Media storage",
      configured: storageConfigured,
      detail: storageConfigured
        ? `Storage ${input.deployment.mediaStorageProvider.toUpperCase()} có cấu hình hiệu lực.`
        : "Storage S3 đã chọn nhưng chưa có bucket trong deployment.",
    },
  ];

  return {
    secrets,
    deployment,
    configuredSecretCount: secrets.filter((entry) => entry.configured).length,
    deploymentReadyCount: deployment.filter((entry) => entry.configured).length,
  };
}

export type SecurityConfiguration = ReturnType<typeof buildSecurityConfiguration>;
