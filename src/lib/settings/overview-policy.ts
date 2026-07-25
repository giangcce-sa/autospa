export type SettingsOverviewStatus = "ready" | "attention" | "blocked" | "info";

export interface SettingsOverviewItem {
  id: "connections" | "channels" | "providers" | "images" | "video" | "ads" | "automation" | "data";
  label: string;
  status: SettingsOverviewStatus;
  statusLabel: string;
  summary: string;
  detail: string;
  source: string;
  href: string;
}

export interface SettingsOverviewInput {
  connections: {
    hasUrl: boolean;
    hasApiKey: boolean;
    hasWebhookSecret: boolean;
  };
  channels: {
    connected: number;
    total: number;
  };
  providers: {
    claude: boolean;
    openai: boolean;
  };
  images: {
    model: string;
    storageProvider: "local" | "s3";
    storageConfigured: boolean;
  };
  video: {
    mockMode: boolean;
    runway: boolean;
    elevenLabs: boolean;
    sync: boolean;
    deploymentKeyCount: number;
  };
  ads: {
    executionMode: "read_only" | "supervised_manual" | "semi" | "full";
    emergencyStop: boolean;
    forcedDryRun: boolean;
    allowedPageCount: number;
    allowedAdAccountCount: number;
  };
  automation: {
    webhookMode: "manual" | "auto";
    hasWebhookVerifyToken: boolean;
    automationLevel: "supervised" | "semi" | "full";
  };
  data: {
    draftRetentionDays: number;
    publishedRetentionDays: number;
  };
}

function item(
  id: SettingsOverviewItem["id"],
  values: Omit<SettingsOverviewItem, "id" | "href">,
): SettingsOverviewItem {
  return {
    id,
    href: `/system/settings?view=${id}&scope=account`,
    ...values,
  };
}

export function buildSettingsOverview(input: SettingsOverviewInput) {
  const configuredConnections = [
    input.connections.hasUrl,
    input.connections.hasApiKey,
    input.connections.hasWebhookSecret,
  ].filter(Boolean).length;
  const providerCount = [input.providers.claude, input.providers.openai].filter(Boolean).length;
  const videoProviderCount = [input.video.runway, input.video.elevenLabs, input.video.sync].filter(Boolean).length;
  const adsAllowlisted = input.ads.allowedPageCount > 0 && input.ads.allowedAdAccountCount > 0;

  const items: SettingsOverviewItem[] = [
    item("connections", configuredConnections === 3 ? {
      label: "Kết nối nền",
      status: "ready",
      statusLabel: "Sẵn sàng",
      summary: "Spa API và webhook đã cấu hình",
      detail: "URL, API key và webhook secret đều đã có.",
      source: "Database",
    } : {
      label: "Kết nối nền",
      status: "attention",
      statusLabel: "Cần cấu hình",
      summary: `${configuredConnections}/3 thành phần đã cấu hình`,
      detail: "Cần URL, API key và webhook secret để hoàn tất kết nối phần mềm spa.",
      source: "Database",
    }),
    item("channels", input.channels.connected > 0 ? {
      label: "Kênh truyền thông",
      status: "ready",
      statusLabel: "Đã kết nối",
      summary: `${input.channels.connected}/${input.channels.total} nhóm kênh đang kết nối`,
      detail: "Các kênh là tùy chọn; chỉ cấu hình những kênh spa thực sự sử dụng.",
      source: "External accounts + database",
    } : {
      label: "Kênh truyền thông",
      status: "attention",
      statusLabel: "Chưa kết nối",
      summary: "Chưa có kênh hoạt động",
      detail: "Kết nối ít nhất một kênh để đăng bài hoặc nhận tương tác.",
      source: "External accounts + database",
    }),
    item("providers", providerCount > 0 ? {
      label: "AI Providers",
      status: "ready",
      statusLabel: "Sẵn sàng",
      summary: `${providerCount}/2 provider có khóa truy cập`,
      detail: "Claude hoặc OpenAI có thể phục vụ các tác vụ AI tương ứng.",
      source: "Database",
    } : {
      label: "AI Providers",
      status: "attention",
      statusLabel: "Thiếu API key",
      summary: "Chưa có provider AI sẵn sàng",
      detail: "Cấu hình Claude hoặc OpenAI trước khi chạy tác vụ AI.",
      source: "Database",
    }),
    item("images", input.images.storageConfigured ? {
      label: "Hình ảnh",
      status: "ready",
      statusLabel: "Sẵn sàng",
      summary: `${input.images.model} · lưu trữ ${input.images.storageProvider.toUpperCase()}`,
      detail: "Model ảnh và storage deployment đã có cấu hình hiệu lực.",
      source: "Database + deployment",
    } : {
      label: "Hình ảnh",
      status: "blocked",
      statusLabel: "Storage bị chặn",
      summary: `Storage ${input.images.storageProvider.toUpperCase()} chưa hoàn tất`,
      detail: "Cần cấu hình deployment storage trước khi lưu media ổn định.",
      source: "Deployment",
    }),
    item("video", input.video.mockMode ? {
      label: "Video",
      status: "attention",
      statusLabel: "Đang mô phỏng",
      summary: `${videoProviderCount}/3 provider có khóa truy cập`,
      detail: "Video đang ở mock mode; chuyển live chỉ sau khi provider và budget đã sẵn sàng.",
      source: input.video.deploymentKeyCount > 0 ? "Database + deployment" : "Database",
    } : videoProviderCount === 3 ? {
      label: "Video",
      status: "ready",
      statusLabel: "Live sẵn sàng",
      summary: "Runway, ElevenLabs và Sync đều có khóa",
      detail: "Các provider cần cho pipeline video live đã được cấu hình.",
      source: input.video.deploymentKeyCount > 0 ? "Database + deployment" : "Database",
    } : {
      label: "Video",
      status: "blocked",
      statusLabel: "Thiếu provider",
      summary: `${videoProviderCount}/3 provider có khóa truy cập`,
      detail: "Live mode đang bật nhưng pipeline video chưa có đủ provider.",
      source: input.video.deploymentKeyCount > 0 ? "Database + deployment" : "Database",
    }),
    item("ads", input.ads.emergencyStop ? {
      label: "Quảng cáo",
      status: "blocked",
      statusLabel: "Emergency stop",
      summary: "Mọi mutation Ads đang bị chặn",
      detail: "Emergency stop từ deployment đang bật và database không thể tắt.",
      source: "Deployment + database",
    } : input.ads.executionMode === "read_only" ? {
      label: "Quảng cáo",
      status: "blocked",
      statusLabel: "Chỉ đọc",
      summary: "Execution mode chưa cho phép mutation",
      detail: "Deployment đang giới hạn Ads ở read-only.",
      source: "Deployment + database",
    } : !adsAllowlisted ? {
      label: "Quảng cáo",
      status: "blocked",
      statusLabel: "Thiếu allowlist",
      summary: "Page hoặc Ad Account chưa được cho phép",
      detail: "Cả Page và Ad Account phải nằm trong deployment allowlist.",
      source: "Deployment + database",
    } : input.ads.forcedDryRun ? {
      label: "Quảng cáo",
      status: "attention",
      statusLabel: "Dry-run bắt buộc",
      summary: `${input.ads.executionMode} · chưa thực thi live`,
      detail: "Safety policy đang ép dry-run; resource mới vẫn luôn được tạo PAUSED.",
      source: "Deployment + database",
    } : {
      label: "Quảng cáo",
      status: "ready",
      statusLabel: "Safety sẵn sàng",
      summary: `${input.ads.executionMode} · allowlist hợp lệ`,
      detail: "Safety deployment cho phép vận hành; resource mới vẫn luôn được tạo PAUSED.",
      source: "Deployment + database",
    }),
    item("automation", input.automation.webhookMode === "auto" && !input.automation.hasWebhookVerifyToken ? {
      label: "Tự động hóa",
      status: "blocked",
      statusLabel: "Thiếu verify token",
      summary: `Mức yêu cầu: ${input.automation.automationLevel}`,
      detail: "Webhook auto cần verify token trước khi nhận sự kiện an toàn.",
      source: "Database",
    } : {
      label: "Tự động hóa",
      status: "info",
      statusLabel: input.automation.webhookMode === "auto" ? "Đã bật auto" : "Đang thủ công",
      summary: `Mức yêu cầu: ${input.automation.automationLevel}`,
      detail: "Mức yêu cầu không thể vượt các safety ceiling do deployment kiểm soát.",
      source: "Database + deployment policy",
    }),
    item("data", {
      label: "Dữ liệu & backup",
      status: "info",
      statusLabel: "Đã có chính sách",
      summary: `Nháp ${input.data.draftRetentionDays} ngày · đã đăng ${input.data.publishedRetentionDays} ngày`,
      detail: "0 ngày có nghĩa là giữ không giới hạn; backup loại bỏ các trường secret.",
      source: "Database",
    }),
  ];

  return {
    items,
    readyCount: items.filter((entry) => entry.status === "ready").length,
    attentionCount: items.filter((entry) => entry.status === "attention").length,
    blockedCount: items.filter((entry) => entry.status === "blocked").length,
    infoCount: items.filter((entry) => entry.status === "info").length,
  };
}

export type SettingsOverviewData = ReturnType<typeof buildSettingsOverview>;
