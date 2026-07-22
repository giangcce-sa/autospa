export const APP_SECTIONS = ["today", "creative", "customers", "growth", "system"] as const;
export type AppSectionId = (typeof APP_SECTIONS)[number];

export type RouteIconKey =
  | "ab-test"
  | "analytics"
  | "appointments"
  | "automation"
  | "brain"
  | "brand"
  | "brand-kit"
  | "bulk"
  | "care"
  | "competitors"
  | "content"
  | "content-research"
  | "council"
  | "crm"
  | "facebook-ads"
  | "google-business"
  | "holidays"
  | "images"
  | "inbox"
  | "learning"
  | "library"
  | "listening"
  | "orchestrator"
  | "promotions"
  | "publish"
  | "quality"
  | "reports"
  | "sale"
  | "services"
  | "settings"
  | "skin-ai"
  | "staff-visuals"
  | "stories"
  | "style-training"
  | "today"
  | "video-studio"
  | "zalo";

export type RouteScope = "current_page" | "current_or_all" | "account" | "none";
export type RouteVisibility = "simple" | "advanced" | "hidden";
export type HubPlacement = "primary" | "tool";
export type RouteKind = "section" | "workspace" | "alias" | "page";

export interface WorkspaceView {
  id: string;
  label: string;
  description: string;
  scope?: RouteScope;
  targetPath?: string;
}

export interface AppRoute {
  id: string;
  path: string;
  kind?: RouteKind;
  workspaceId?: string;
  canonicalPath?: string;
  defaultView?: string;
  views?: readonly WorkspaceView[];
  aliasTarget?: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: RouteIconKey;
  section: AppSectionId | "auth" | "internal";
  scope: RouteScope;
  visibility: RouteVisibility;
  searchAliases?: string[];
  hub?: HubPlacement;
  premium?: boolean;
  ownerOnly?: boolean;
  command?: boolean;
}

export interface AppSection {
  id: AppSectionId;
  label: string;
  description: string;
  href: string;
  icon: RouteIconKey;
}

const LEGACY_CANONICAL_PATHS: Readonly<Record<string, string>> = {
  "content-research": "/creative/ideas",
  holidays: "/creative/ideas",
  content: "/creative/content",
  bulk: "/creative/content",
  "ab-test": "/creative/content",
  quality: "/creative/content",
  images: "/creative/images",
  "video-studio": "/creative/video",
  publish: "/creative/publishing",
  library: "/creative/publishing",
  inbox: "/customers/inbox",
  appointments: "/customers/inbox",
  crm: "/customers/crm",
  sale: "/customers/sales",
  care: "/customers/care",
  "facebook-ads": "/growth/ads",
  promotions: "/growth/promotions",
  "flash-deal": "/growth/promotions",
  reports: "/growth/intelligence",
  analytics: "/growth/intelligence",
  competitors: "/growth/intelligence",
  listening: "/growth/intelligence",
  "tiktok-ig": "/growth/intelligence",
  council: "/system/ai-rooms",
  brain: "/system/ai-rooms",
  "ceo-memory": "/system/ai-rooms",
  orchestrator: "/system/ai-rooms",
  automation: "/system/ai-rooms",
  brand: "/system/brand-assets",
  "brand-kit": "/system/brand-assets",
  services: "/system/brand-assets",
  "staff-visuals": "/system/brand-assets",
  stories: "/system/brand-assets",
  "style-training": "/system/brand-assets",
  learning: "/system/brand-assets",
  settings: "/system/settings",
};

const ROUTE_DEFINITIONS: readonly AppRoute[] = [
  { id: "today", path: "/", label: "Hôm nay", description: "Việc cần xử lý, lịch sắp tới và chỉ số cần chú ý.", icon: "today", section: "today", scope: "current_or_all", visibility: "simple", searchAliases: ["dashboard", "trang chủ"], command: true },

  { id: "creative", path: "/creative", kind: "section", label: "Sáng tạo", description: "Tạo, duyệt và lên lịch nội dung trong một khu vực.", icon: "content", section: "creative", scope: "current_page", visibility: "simple" },
  { id: "creative-ideas", path: "/creative/ideas", kind: "workspace", workspaceId: "ideas", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Tín hiệu, brief và ý tưởng đang ưu tiên." },
    { id: "research", label: "Nghiên cứu", description: "Thu thập bằng chứng và góc nội dung.", targetPath: "/content-research" },
    { id: "backlog", label: "Kho ý tưởng", description: "Ý tưởng đã lưu để phát triển thành nội dung.", targetPath: "/content-research" },
    { id: "history", label: "Lịch sử", description: "Các lần nghiên cứu và nguồn đã dùng.", targetPath: "/content-research" },
  ], label: "Ý tưởng & Nghiên cứu", description: "Biến tín hiệu thị trường thành brief nội dung có bằng chứng.", icon: "content-research", section: "creative", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "creative-content", path: "/creative/content", kind: "workspace", workspaceId: "content", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Draft, review và công việc nội dung gần đây." },
    { id: "editor", label: "Biên tập", description: "Tạo và chỉnh caption theo giọng thương hiệu.", targetPath: "/content" },
    { id: "bulk", label: "Hàng loạt", description: "Sản xuất nhiều nội dung theo kế hoạch.", targetPath: "/bulk" },
    { id: "experiments", label: "Thử nghiệm", description: "So sánh các phiên bản nội dung.", targetPath: "/ab-test" },
    { id: "review", label: "Kiểm tra", description: "Kiểm tra chất lượng trước khi chuyển bước.", targetPath: "/quality" },
  ], label: "Biên tập nội dung", description: "Từ brief đến draft đã review và sẵn sàng xuất bản.", icon: "content", section: "creative", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "creative-images", path: "/creative/images", kind: "workspace", workspaceId: "images", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Readiness, dự án và ảnh gần đây." },
    { id: "create", label: "Tạo ảnh", description: "Sinh và so sánh các phương án hình ảnh.", targetPath: "/images" },
    { id: "library", label: "Thư viện", description: "Tài nguyên hình ảnh đã lưu.", targetPath: "/images" },
    { id: "review", label: "Duyệt ảnh", description: "Kiểm tra chất lượng và nhận diện.", targetPath: "/images" },
  ], label: "Xưởng hình ảnh", description: "Tạo, review và lưu hình ảnh theo bộ nhận diện.", icon: "images", section: "creative", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "creative-video", path: "/creative/video", kind: "workspace", workspaceId: "video", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Readiness và dự án video đang chạy." },
    { id: "projects", label: "Dự án", description: "Storyboard, cảnh, giọng và render.", targetPath: "/video-studio" },
    { id: "review", label: "QA & Duyệt", description: "Kiểm tra revision, consent và phê duyệt.", targetPath: "/video-studio" },
    { id: "jobs", label: "Công việc", description: "Theo dõi render và publish jobs.", targetPath: "/video-studio" },
  ], label: "Xưởng video", description: "Từ storyboard đến video đã QA và được phê duyệt.", icon: "video-studio", section: "creative", scope: "current_page", visibility: "advanced", hub: "primary", premium: true, command: true },
  { id: "creative-publishing", path: "/creative/publishing", kind: "workspace", workspaceId: "publishing", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Lịch, hàng đợi và kết quả gần đây." },
    { id: "composer", label: "Soạn & Đăng", description: "Review và phân phối nội dung.", targetPath: "/publish" },
    { id: "calendar", label: "Lịch", description: "Theo dõi nội dung đã lên lịch.", targetPath: "/publish" },
    { id: "library", label: "Thư viện", description: "Tìm và tái sử dụng nội dung.", targetPath: "/library" },
  ], label: "Đăng bài & Thư viện", description: "Quản lý vòng đời nội dung từ draft đến kết quả từng kênh.", icon: "publish", section: "creative", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "content", path: "/content", label: "Viết bài", description: "Tạo nội dung tự nhiên theo giọng thương hiệu.", icon: "content", section: "creative", scope: "current_page", visibility: "simple", searchAliases: ["content", "tạo bài", "AI"], hub: "primary", command: true },
  { id: "images", path: "/images", label: "Tạo hình ảnh", description: "Tạo hình ảnh theo bộ nhận diện và mẫu tham chiếu.", icon: "images", section: "creative", scope: "current_page", visibility: "simple", searchAliases: ["image", "ảnh AI"], hub: "primary", command: true },
  { id: "video-studio", path: "/video-studio", label: "Xưởng video", description: "Từ kịch bản đến giọng đọc, khẩu hình và dựng video.", icon: "video-studio", section: "creative", scope: "current_page", visibility: "advanced", searchAliases: ["AI video", "runway", "lipsync"], hub: "primary", premium: true, command: true },
  { id: "publish", path: "/publish", label: "Đăng và lịch", description: "Duyệt nội dung và phân phối lên các kênh.", icon: "publish", section: "creative", scope: "current_page", visibility: "simple", searchAliases: ["schedule", "đăng bài", "lịch"], hub: "primary", command: true },
  { id: "library", path: "/library", label: "Thư viện nội dung", description: "Tìm lại nội dung và tài nguyên đã tạo.", icon: "library", section: "creative", scope: "current_page", visibility: "simple", hub: "tool", command: true },
  { id: "staff-visuals", path: "/staff-visuals", label: "Hình ảnh nhân viên", description: "Quản lý ảnh nhân viên và quyền sử dụng làm mẫu.", icon: "staff-visuals", section: "system", scope: "account", visibility: "advanced", searchAliases: ["visual library", "ảnh mẫu", "khuôn mặt"], hub: "tool", command: true },
  { id: "bulk", path: "/bulk", label: "Tạo hàng loạt", description: "Sản xuất nhiều nội dung theo một kế hoạch.", icon: "bulk", section: "creative", scope: "current_page", visibility: "advanced", searchAliases: ["bulk"], hub: "tool", command: true },
  { id: "ab-test", path: "/ab-test", label: "So sánh hai phiên bản", description: "So sánh các phương án nội dung trước khi sử dụng.", icon: "ab-test", section: "creative", scope: "current_page", visibility: "advanced", searchAliases: ["A/B test"], command: true },
  { id: "content-research", path: "/content-research", label: "Nghiên cứu nội dung", description: "Tìm chủ đề và góc tiếp cận cho nội dung mới.", icon: "content-research", section: "creative", scope: "current_page", visibility: "advanced", searchAliases: ["research"], command: true },
  { id: "quality", path: "/quality", label: "Kiểm tra chất lượng", description: "Kiểm tra chất lượng nội dung trước khi phân phối.", icon: "quality", section: "creative", scope: "current_page", visibility: "advanced", command: true },

  { id: "customers", path: "/customers", kind: "section", label: "Khách hàng", description: "Hội thoại, khách tiềm năng và lịch hẹn trong một quy trình.", icon: "crm", section: "customers", scope: "current_or_all", visibility: "simple" },
  { id: "customers-inbox", path: "/customers/inbox", kind: "workspace", workspaceId: "inbox", defaultView: "queue", views: [
    { id: "queue", label: "Hàng đợi", description: "Hội thoại đang chờ phản hồi.", targetPath: "/inbox" },
    { id: "conversation", label: "Hội thoại", description: "Tin nhắn và ngữ cảnh khách hàng.", targetPath: "/inbox" },
    { id: "appointments", label: "Lịch hẹn", description: "Yêu cầu đặt lịch từ hội thoại.", targetPath: "/appointments" },
    { id: "rules", label: "Quy tắc", description: "Trạng thái các quy tắc trả lời.", targetPath: "/inbox" },
  ], label: "Hộp thư", description: "Xử lý hội thoại, gợi ý trả lời và handoff lịch hẹn.", icon: "inbox", section: "customers", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "customers-crm", path: "/customers/crm", kind: "workspace", workspaceId: "crm", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Tình trạng dữ liệu và khách hàng cần chú ý." },
    { id: "customers", label: "Khách hàng", description: "Danh sách, tìm kiếm và lọc hồ sơ.", targetPath: "/crm" },
    { id: "segments", label: "Phân khúc", description: "Các nhóm khách hàng phục vụ chăm sóc.", targetPath: "/crm" },
    { id: "appointments", label: "Lịch hẹn", description: "Lịch sử và yêu cầu đặt lịch.", targetPath: "/appointments" },
  ], label: "CRM", description: "Hồ sơ, timeline, phân khúc và lịch hẹn khách hàng.", icon: "crm", section: "customers", scope: "account", visibility: "simple", hub: "primary", command: true },
  { id: "customers-sales", path: "/customers/sales", kind: "workspace", workspaceId: "sales", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Pipeline và cơ hội cần xử lý." },
    { id: "pipeline", label: "Pipeline", description: "Lead, điểm số và bước tiếp theo.", targetPath: "/sale" },
    { id: "outreach", label: "Tư vấn", description: "Kịch bản và handoff đặt lịch.", targetPath: "/sale" },
    { id: "results", label: "Kết quả", description: "Theo dõi chuyển đổi tư vấn.", targetPath: "/sale" },
  ], label: "Bán hàng", description: "Ưu tiên lead và đưa khách tới bước đặt lịch.", icon: "sale", section: "customers", scope: "current_or_all", visibility: "simple", hub: "primary", command: true },
  { id: "customers-care", path: "/customers/care", kind: "workspace", workspaceId: "care", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Khách đến hạn và lý do cần chăm sóc." },
    { id: "tasks", label: "Công việc", description: "Danh sách chăm sóc cần review.", targetPath: "/care" },
    { id: "segments", label: "Phân khúc", description: "Nhóm khách cần liên hệ lại.", targetPath: "/care" },
    { id: "history", label: "Lịch sử", description: "Kết quả các lần chăm sóc.", targetPath: "/care" },
  ], label: "Chăm sóc lại", description: "Quản lý tác vụ chăm sóc theo consent và lịch sử khách.", icon: "care", section: "customers", scope: "account", visibility: "simple", hub: "primary", command: true },
  { id: "inbox", path: "/inbox", label: "Tin nhắn", description: "Phản hồi các cuộc hội thoại đang chờ.", icon: "inbox", section: "customers", scope: "current_page", visibility: "simple", searchAliases: ["hộp thư", "chat"], hub: "primary", command: true },
  { id: "sale", path: "/sale", label: "Khách cần tư vấn", description: "Ưu tiên những khách có khả năng đặt lịch cao.", icon: "sale", section: "customers", scope: "current_or_all", visibility: "simple", searchAliases: ["lead", "sale", "chốt"], hub: "primary", command: true },
  { id: "crm", path: "/crm", label: "Hồ sơ khách hàng", description: "Xem thông tin và lịch sử tương tác của từng khách.", icon: "crm", section: "customers", scope: "account", visibility: "simple", searchAliases: ["CRM"], hub: "primary", command: true },
  { id: "appointments", path: "/appointments", label: "Lịch hẹn", description: "Xác nhận các yêu cầu đặt lịch mới.", icon: "appointments", section: "customers", scope: "current_or_all", visibility: "simple", hub: "primary", command: true },
  { id: "care", path: "/care", label: "Chăm sóc lại", description: "Theo dõi những khách đã đến lịch liên hệ lại.", icon: "care", section: "customers", scope: "account", visibility: "simple", hub: "tool", command: true },
  { id: "auto-comment", path: "/auto-comment", label: "Bình luận tự động", description: "Theo dõi và hỗ trợ phản hồi bình luận theo Trang.", icon: "automation", section: "customers", scope: "current_page", visibility: "advanced", command: true },
  { id: "zalo", path: "/zalo", label: "Zalo OA", description: "Quản lý hoạt động chăm sóc khách hàng trên Zalo.", icon: "zalo", section: "customers", scope: "account", visibility: "advanced", command: true },

  { id: "growth", path: "/growth", kind: "section", label: "Tăng trưởng", description: "Quảng cáo, hiệu quả và tín hiệu thị trường.", icon: "reports", section: "growth", scope: "current_or_all", visibility: "simple" },
  { id: "growth-ads", path: "/growth/ads", kind: "workspace", workspaceId: "ads", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Readiness, execution mode và chiến dịch cần chú ý." },
    { id: "campaigns", label: "Chiến dịch", description: "Theo dõi các chiến dịch quảng cáo.", targetPath: "/facebook-ads" },
    { id: "create", label: "Tạo quảng cáo", description: "Preflight, review và tạo resource ở trạng thái PAUSED.", targetPath: "/facebook-ads" },
    { id: "insights", label: "Hiệu quả", description: "Phân tích hiệu quả quảng cáo.", targetPath: "/facebook-ads" },
    { id: "operations", label: "Vận hành", description: "Checkpoint, retry và recovery.", targetPath: "/facebook-ads" },
  ], label: "Ads Manager", description: "Tạo và vận hành quảng cáo Facebook với các safety gate bắt buộc.", icon: "facebook-ads", section: "growth", scope: "current_page", visibility: "simple", hub: "primary", command: true },
  { id: "growth-promotions", path: "/growth/promotions", kind: "workspace", workspaceId: "promotions", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Ưu đãi, công suất và kết quả gần đây." },
    { id: "offers", label: "Ưu đãi", description: "Tạo và quản lý chương trình khuyến mãi.", targetPath: "/promotions" },
    { id: "capacity", label: "Công suất", description: "Lấp lịch trống theo công suất.", targetPath: "/flash-deal" },
    { id: "results", label: "Kết quả", description: "Theo dõi hiệu quả ưu đãi.", targetPath: "/promotions" },
  ], label: "Khuyến mãi", description: "Tạo ưu đãi theo mục tiêu, công suất và biên lợi nhuận.", icon: "promotions", section: "growth", scope: "account", visibility: "simple", hub: "primary", command: true },
  { id: "growth-intelligence", path: "/growth/intelligence", kind: "workspace", workspaceId: "intelligence", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "KPI, freshness và tín hiệu tăng trưởng." },
    { id: "reports", label: "Báo cáo", description: "Doanh thu và hiệu quả theo kênh.", targetPath: "/reports" },
    { id: "performance", label: "Hiệu quả", description: "Phân tích nội dung và chiến dịch.", targetPath: "/analytics" },
    { id: "competitors", label: "Đối thủ", description: "Tín hiệu cạnh tranh và xu hướng.", targetPath: "/competitors" },
    { id: "listening", label: "Lắng nghe", description: "Cảnh báo và tín hiệu thị trường.", targetPath: "/listening" },
  ], label: "Phân tích tăng trưởng", description: "Báo cáo, attribution và tín hiệu thị trường trong một nơi.", icon: "reports", section: "growth", scope: "current_or_all", visibility: "simple", hub: "primary", command: true },
  { id: "reports", path: "/reports", label: "Báo cáo", description: "Doanh thu, khách tiềm năng và hiệu quả theo kênh.", icon: "reports", section: "growth", scope: "current_or_all", visibility: "simple", searchAliases: ["report"], hub: "primary", command: true },
  { id: "facebook-ads", path: "/facebook-ads", label: "Quảng cáo Facebook", description: "Theo dõi và quản lý chiến dịch có kiểm soát.", icon: "facebook-ads", section: "growth", scope: "current_page", visibility: "simple", searchAliases: ["ads manager", "Meta Ads"], hub: "primary", command: true },
  { id: "analytics", path: "/analytics", label: "Phân tích hiệu quả", description: "So sánh hiệu quả nội dung và chiến dịch.", icon: "analytics", section: "growth", scope: "current_or_all", visibility: "simple", searchAliases: ["analytics"], hub: "primary", command: true },
  { id: "promotions", path: "/promotions", label: "Khuyến mãi", description: "Tạo ưu đãi theo công suất và mục tiêu.", icon: "promotions", section: "growth", scope: "account", visibility: "simple", searchAliases: ["promotion", "ưu đãi"], hub: "primary", command: true },
  { id: "flash-deal", path: "/flash-deal", label: "Lấp lịch trống", description: "Tạo ưu đãi ngắn hạn theo công suất còn trống.", icon: "promotions", section: "growth", scope: "account", visibility: "advanced", command: true },
  { id: "competitors", path: "/competitors", label: "Đối thủ", description: "Quan sát nội dung và xu hướng cạnh tranh.", icon: "competitors", section: "growth", scope: "account", visibility: "advanced", searchAliases: ["intelligence"], hub: "tool", command: true },
  { id: "listening", path: "/listening", label: "Lắng nghe mạng xã hội", description: "Phát hiện cảnh báo và tín hiệu từ thị trường.", icon: "listening", section: "growth", scope: "current_or_all", visibility: "advanced", searchAliases: ["social listening"], hub: "tool", command: true },
  { id: "tiktok-ig", path: "/tiktok-ig", label: "TikTok và Instagram", description: "Theo dõi hoạt động trên các kênh video và hình ảnh.", icon: "analytics", section: "growth", scope: "current_page", visibility: "advanced", command: true },
  { id: "google-business", path: "/google-business", label: "Google Business", description: "Quản lý hiện diện và nội dung trên Google Business.", icon: "google-business", section: "growth", scope: "account", visibility: "advanced", command: true },
  { id: "holidays", path: "/holidays", label: "Lịch sự kiện", description: "Theo dõi dịp lễ và cơ hội nội dung theo mùa.", icon: "holidays", section: "growth", scope: "account", visibility: "advanced", command: true },

  { id: "system", path: "/system", kind: "section", label: "Hệ thống", description: "Kết nối, thương hiệu, dữ liệu và tự động hóa.", icon: "settings", section: "system", scope: "account", visibility: "simple" },
  { id: "system-ai-rooms", path: "/system/ai-rooms", kind: "workspace", workspaceId: "ai-rooms", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Phiên họp, approval và follow-up gần đây." },
    { id: "council", label: "Phòng tư vấn", description: "Thảo luận và phản biện nhiều vai trò AI.", targetPath: "/council" },
    { id: "brain", label: "Kỹ năng", description: "Kỹ năng và kiến thức hệ thống sử dụng.", targetPath: "/brain" },
    { id: "memory", label: "Quyết định", description: "Quyết định và outcome đã lưu.", targetPath: "/ceo-memory" },
    { id: "orchestrator", label: "Điều phối", description: "Workflow health và execution status.", targetPath: "/orchestrator" },
    { id: "approvals", label: "Phê duyệt", description: "Automation đề xuất đang chờ owner.", targetPath: "/automation" },
  ], label: "Phòng họp AI", description: "Tư vấn, phản biện, phê duyệt và lưu quyết định có provenance.", icon: "council", section: "system", scope: "account", visibility: "advanced", hub: "primary", premium: true, command: true },
  { id: "system-brand-assets", path: "/system/brand-assets", kind: "workspace", workspaceId: "brand-assets", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Readiness thương hiệu và tài nguyên.", scope: "account" },
    { id: "brand", label: "Thương hiệu", description: "Thông tin và kiến thức nền.", scope: "account", targetPath: "/brand" },
    { id: "kit", label: "Bộ nhận diện", description: "Logo, màu sắc và quy chuẩn hình ảnh.", scope: "current_page", targetPath: "/brand-kit" },
    { id: "services", label: "Dịch vụ", description: "Danh mục dịch vụ của spa.", scope: "current_page", targetPath: "/services" },
    { id: "staff", label: "Nhân viên", description: "Ảnh mẫu và quyền sử dụng.", scope: "current_page", targetPath: "/staff-visuals" },
    { id: "stories", label: "Câu chuyện", description: "Nguồn chất liệu thực tế.", scope: "current_page", targetPath: "/stories" },
    { id: "style", label: "Văn phong", description: "Huấn luyện giọng thương hiệu.", scope: "current_page", targetPath: "/style-training" },
    { id: "learning", label: "Học tập", description: "Theo dõi dữ liệu hệ thống đã học.", scope: "account", targetPath: "/learning" },
  ], label: "Thương hiệu & Tài nguyên", description: "Một nơi quản lý brand, dịch vụ, consent và style.", icon: "brand-kit", section: "system", scope: "account", visibility: "simple", hub: "primary", command: true },
  { id: "system-settings", path: "/system/settings", kind: "workspace", workspaceId: "settings", defaultView: "overview", views: [
    { id: "overview", label: "Tổng quan", description: "Trạng thái kết nối và blocker cấu hình." },
    { id: "connections", label: "Kết nối", description: "AI provider và phần mềm spa.", targetPath: "/settings" },
    { id: "channels", label: "Kênh", description: "Facebook, Instagram, TikTok và Zalo.", targetPath: "/settings" },
    { id: "automation", label: "Tự động hóa", description: "Quy tắc và mức độ tự động.", targetPath: "/settings" },
    { id: "data", label: "Dữ liệu", description: "Retention và backup.", targetPath: "/settings" },
  ], label: "Cài đặt & Kết nối", description: "Kết nối provider, kênh và cấu hình vận hành an toàn.", icon: "settings", section: "system", scope: "account", visibility: "simple", hub: "primary", ownerOnly: true, command: true },
  { id: "settings", path: "/settings", label: "Cài đặt", description: "Kết nối dịch vụ, mạng xã hội và quy tắc vận hành.", icon: "settings", section: "system", scope: "account", visibility: "simple", searchAliases: ["API key", "kết nối"], hub: "primary", command: true },
  { id: "brand", path: "/brand", label: "Thương hiệu", description: "Thông tin spa, giọng nói và kiến thức nền.", icon: "brand", section: "system", scope: "account", visibility: "simple", searchAliases: ["brand"], hub: "primary", command: true },
  { id: "brand-kit", path: "/brand-kit", label: "Bộ nhận diện", description: "Logo, màu sắc và quy chuẩn hình ảnh.", icon: "brand-kit", section: "system", scope: "current_page", visibility: "simple", searchAliases: ["logo", "màu sắc"], hub: "primary", command: true },
  { id: "brain", path: "/brain", label: "Bộ não AutoSpa", description: "Quản lý kỹ năng và dữ liệu hệ thống đã học.", icon: "brain", section: "system", scope: "account", visibility: "advanced", searchAliases: ["AI", "skill", "kỹ năng"], hub: "primary", premium: true, command: true },
  { id: "automation", path: "/automation", label: "Tự động hóa", description: "Duyệt công việc và chọn mức độ tự động.", icon: "automation", section: "system", scope: "account", visibility: "advanced", searchAliases: ["workflow"], hub: "tool", command: true },
  { id: "orchestrator", path: "/orchestrator", label: "Trung tâm điều phối", description: "Theo dõi các công việc AutoSpa đang thực hiện.", icon: "orchestrator", section: "system", scope: "account", visibility: "advanced", searchAliases: ["agent", "điều phối"], hub: "tool", premium: true, command: true },
  { id: "services", path: "/services", label: "Danh mục dịch vụ", description: "Quản lý dịch vụ dùng trong nội dung và chăm sóc khách hàng.", icon: "services", section: "system", scope: "account", visibility: "advanced", searchAliases: ["services"], hub: "tool", command: true },
  { id: "learning", path: "/learning", label: "Hệ thống học tập", description: "Theo dõi dữ liệu và kết quả AutoSpa đang học.", icon: "learning", section: "system", scope: "account", visibility: "advanced", premium: true, command: true },
  { id: "council", path: "/council", label: "Hội đồng tư vấn", description: "Xem phân tích và ý kiến từ các vai trò AI.", icon: "council", section: "system", scope: "account", visibility: "advanced", searchAliases: ["AI council"], premium: true, command: true },
  { id: "ceo-memory", path: "/ceo-memory", label: "Bộ nhớ quyết định", description: "Xem lại dữ liệu và quyết định quản trị đã lưu.", icon: "brain", section: "system", scope: "account", visibility: "advanced", searchAliases: ["CEO memory"], premium: true, command: true },
  { id: "style-training", path: "/style-training", label: "Huấn luyện văn phong", description: "Cập nhật cách viết phù hợp với thương hiệu.", icon: "style-training", section: "system", scope: "current_page", visibility: "advanced", command: true },
  { id: "stories", path: "/stories", label: "Câu chuyện thực tế", description: "Quản lý câu chuyện dùng làm nguồn nội dung.", icon: "stories", section: "system", scope: "current_page", visibility: "advanced", command: true },
  { id: "skin-ai", path: "/skin-ai", label: "Phân tích da", description: "Công cụ hỗ trợ phân tích hình ảnh da.", icon: "skin-ai", section: "system", scope: "account", visibility: "advanced", searchAliases: ["skin AI"], command: true },

  { id: "login", path: "/login", label: "Đăng nhập", description: "Đăng nhập vào AutoSpa.", icon: "today", section: "auth", scope: "none", visibility: "hidden" },
  { id: "setup", path: "/setup", label: "Thiết lập", description: "Thiết lập tài khoản AutoSpa đầu tiên.", icon: "settings", section: "auth", scope: "none", visibility: "hidden" },
  { id: "ui-demo", path: "/ui-demo", label: "UI Demo", description: "Màn hình kiểm tra giao diện nội bộ.", icon: "settings", section: "internal", scope: "none", visibility: "hidden" },
];

export const APP_ROUTES: readonly AppRoute[] = ROUTE_DEFINITIONS.map((route) => {
  const canonicalPath = LEGACY_CANONICAL_PATHS[route.id];
  if (!canonicalPath) return route;
  return {
    ...route,
    kind: "alias",
    canonicalPath,
    aliasTarget: canonicalPath,
    hub: undefined,
    command: false,
  };
});

export const ROUTES_BY_ID = new Map(APP_ROUTES.map((route) => [route.id, route]));
export const ROUTES_BY_PATH = new Map(APP_ROUTES.map((route) => [route.path, route]));

export const SECTIONS: readonly AppSection[] = APP_SECTIONS.map((id) => {
  const route = ROUTES_BY_ID.get(id);
  if (!route) throw new Error(`Missing section route: ${id}`);
  return { id, label: route.label, description: route.description, href: route.path, icon: route.icon };
});

export function getSection(sectionId: AppSectionId) {
  return SECTIONS.find((section) => section.id === sectionId);
}

export function getSectionRoutes(sectionId: AppSectionId, placement?: HubPlacement) {
  return APP_ROUTES.filter((route) => route.section === sectionId && (!placement || route.hub === placement));
}

export function getCommandRoutes() {
  return APP_ROUTES.filter((route) => route.command);
}

export function routeIsActive(pathname: string, routePath: string) {
  if (routePath === "/") return pathname === "/";
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

export function sectionIsActive(pathname: string, sectionId: AppSectionId) {
  const section = getSection(sectionId);
  if (!section) return false;
  if (section.href === "/") return pathname === "/";
  return APP_ROUTES.some((route) => route.section === sectionId && routeIsActive(pathname, route.path));
}
