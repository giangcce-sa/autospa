// Seeds realistic Vietnamese demo data for local design review of the "Hôm nay" dashboard.
//
//   $env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/autospa_e2e"
//   node --experimental-strip-types scripts/seed-demo-data.mjs
//
// Every row it writes has an id prefixed with "demo-", and the script deletes exactly those
// rows before re-inserting, so it is safe to run repeatedly.
import assert from "node:assert/strict";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, "DATABASE_URL is required");
const databaseName = new URL(databaseUrl).pathname.slice(1);
assert(
  /(?:^|_)e2e(?:_|$)/i.test(databaseName)
    || /(?:^|_)test(?:_|$)/i.test(databaseName)
    || /(?:^|_)demo(?:_|$)/i.test(databaseName),
  `Refusing to seed non-test database: ${databaseName}`,
);

const PAGE_ID = "demo-page-1";
const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? "viewer-e2e@example.test";

/* ── time helpers ───────────────────────────────────────────────────────────
 * Prisma stores UTC in `timestamp without time zone` columns and @prisma/adapter-pg
 * reads them back as UTC. node-postgres would serialise a JS Date using the *local*
 * timezone, which would skew everything by +07:00 on this machine, so every timestamp
 * is passed as an explicit naive-UTC string instead.
 * Business day/month bounds mirror src/lib/today-policy.ts (Asia/Ho_Chi_Minh).
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const now = new Date();
const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
const vnYear = vnNow.getUTCFullYear();
const vnMonth = vnNow.getUTCMonth();
const vnDate = vnNow.getUTCDate();

/** A UTC instant for the given wall-clock time in Asia/Ho_Chi_Minh, relative to today. */
function vn(dayOffset, hour = 0, minute = 0) {
  return new Date(Date.UTC(vnYear, vnMonth, vnDate + dayOffset, hour, minute) - VN_OFFSET_MS);
}
const startOfDay = vn(0);
const endOfDay = new Date(vn(1).getTime() - 1);
const startOfMonth = new Date(Date.UTC(vnYear, vnMonth, 1) - VN_OFFSET_MS);

function minutesFromNow(minutes) {
  return new Date(now.getTime() + minutes * 60_000);
}
/** A future slot inside today's business day, placed at `fraction` of the remaining window. */
function slotLaterToday(fraction) {
  const remainingMs = endOfDay.getTime() - now.getTime();
  const aheadMs = Math.max(2 * 60_000, Math.floor(remainingMs * fraction));
  return new Date(Math.min(now.getTime() + aheadMs, endOfDay.getTime() - 30_000));
}
/** A past instant inside the current business month (used for publishedAt). */
function earlierThisMonth(daysBack, hour, minute) {
  const floor = startOfMonth.getTime() + 60_000;
  const ceiling = Math.max(floor, now.getTime() - 60_000);
  return new Date(Math.min(Math.max(vn(-daysBack, hour, minute).getTime(), floor), ceiling));
}
function ts(date) {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/* ── generic insert helper (identifiers are literals, values are parameterised) ── */
const pool = new pg.Pool({ connectionString: databaseUrl });

async function insertRows(client, table, rows) {
  if (!rows.length) return 0;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const params = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      const raw = row[column];
      params.push(raw instanceof Date ? ts(raw) : raw === undefined ? null : raw);
      return `$${params.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  await client.query(
    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES ${tuples.join(", ")}`,
    params,
  );
  return rows.length;
}

// Child tables first so foreign keys stay satisfied.
const CLEANUP_ORDER = [
  "BookingRevenue", "LeadConversation", "Lead",
  "CareMessage", "AppointmentRequest", "InboxMessage", "Customer",
  "ContentReview", "Post", "Service",
  "PendingApproval", "SocialAlert", "RealtimeAlert", "ActivityLog",
  "AdOptimizationLog", "JobRun", "WorkflowRun",
  "UserPageAccess", "FacebookPage",
];

/* ── data ──────────────────────────────────────────────────────────────────── */

const facebookPages = [{
  id: PAGE_ID,
  fbPageId: "demo-fb-100000000000001",
  pageName: "Lotus Beauty Spa – Quận 3",
  accessToken: "demo-page-access-token",
  isActive: true,
  adAccountId: "act_demo_1000000001",
  adsReadinessStatus: "ready",
  adsPermissions: JSON.stringify(["ads_management", "ads_read", "pages_manage_posts"]),
  adsMissingPermissions: "[]",
  adAccountStatus: 1,
  adAccountCurrency: "VND",
  adAccountTimezone: "Asia/Ho_Chi_Minh",
  igAccountId: "demo-ig-17841400000000001",
  igUsername: "lotusbeautyspa",
  createdAt: vn(-120, 9, 0),
}];

const services = [
  ["demo-service-1", "Chăm sóc da chuyên sâu", "Làm sạch sâu, điện di dưỡng chất và massage thư giãn cho da xỉn màu.", "450.000đ / buổi", "Chăm sóc da", "75 phút"],
  ["demo-service-2", "Trẻ hóa da HIFU", "Nâng cơ, giảm chảy xệ vùng má và viền hàm bằng sóng siêu âm hội tụ.", "12.000.000đ / liệu trình", "Công nghệ cao", "90 phút"],
  ["demo-service-3", "Triệt lông công nghệ cao", "Triệt lông vùng tay, chân, nách bằng laser diode ít đau.", "3.500.000đ / 6 buổi", "Triệt lông", "45 phút"],
  ["demo-service-4", "Trị nám Laser Toning", "Phá vỡ sắc tố nám chân sâu, phục hồi hàng rào bảo vệ da.", "6.500.000đ / 5 buổi", "Điều trị chuyên sâu", "60 phút"],
  ["demo-service-5", "Detox da thanh lọc", "Thải độc da, cấp ẩm và làm dịu da sau mụn.", "550.000đ / buổi", "Chăm sóc da", "60 phút"],
].map(([id, name, description, price, category, duration], index) => ({
  id,
  facebookPageId: PAGE_ID,
  name,
  description,
  price,
  category,
  duration,
  active: true,
  createdAt: vn(-90 + index, 10, 0),
  updatedAt: vn(-7 + index, 10, 0),
}));

const customerSeeds = [
  ["Nguyễn Thị Mai Anh", "0901234567", "vip", 92, "Khách quen 2 năm, ưu tiên chuyên viên Ngọc.", "HIFU,VIP"],
  ["Trần Thu Hà", "0912345678", "regular", 85, "Đang theo liệu trình trị nám buổi 3/5.", "Trị nám"],
  ["Lê Ngọc Bích", "0938271645", "new", 78, "Hỏi giá triệt lông trọn gói.", "Triệt lông"],
  ["Phạm Thùy Dương", "0977123456", "regular", 58, "Thích khung giờ tối sau 19h.", "Chăm sóc da"],
  ["Hoàng Thị Kim Ngân", "0968553321", "new", 74, "Được bạn giới thiệu từ cơ sở Quận 1.", "Chăm sóc da"],
  ["Vũ Hồng Nhung", "0932114455", "regular", 49, "Da nhạy cảm, cần test trước khi điện di.", "Detox"],
  ["Đặng Phương Linh", "0945667788", "new", 22, "Mới nhắn hỏi, chưa để lại số bàn.", "Triệt lông"],
  ["Bùi Thị Thanh Tâm", "0987112233", "new", 15, "Quan tâm ưu đãi tháng, chưa chốt dịch vụ.", ""],
  ["Ngô Hải Yến", "0906778899", "vip", 88, "Đã đặt liệu trình HIFU trọn gói.", "HIFU,VIP"],
  ["Dương Khánh Huyền", "0918224466", "loyal", 95, "Hoàn tất 5 buổi trị nám, hài lòng.", "Trị nám"],
  ["Trịnh Bảo Châu", "0961335577", "regular", 61, "Hay đi cùng bạn, thích combo đôi.", "Chăm sóc da"],
  ["Lý Thị Hồng Đào", "0925448866", "loyal", 70, "Sinh nhật tháng này, gửi ưu đãi riêng.", "Detox"],
];

const customers = customerSeeds.map(([name, phone, segment, leadScore, note, tags], index) => ({
  id: `demo-customer-${index + 1}`,
  name,
  phone,
  fbId: `demo-psid-${String(index + 1).padStart(3, "0")}`,
  fbName: name,
  email: null,
  birthday: index === 11 ? `${String(vnMonth + 1).padStart(2, "0")}-18` : null,
  segment,
  leadScore,
  lastContact: vn(-index, 11, 0),
  note,
  tags,
  npsScore: index % 4 === 0 ? 9 : null,
  clvTotal: [12000000, 6500000, 0, 1800000, 450000, 2200000, 0, 0, 12000000, 6500000, 1650000, 3300000][index],
  clvTier: ["premium", "high", "low", "mid", "low", "mid", "low", "low", "premium", "high", "mid", "mid"][index],
  churnRisk: ["low", "low", "medium", "medium", "high", "medium", "high", "high", "low", "low", "medium", "low"][index],
  createdAt: vn(-60 + index * 3, 9, 30),
  updatedAt: vn(-index, 11, 5),
}));

const unreadInbox = [
  ["Chị ơi liệu trình trẻ hóa da HIFU giá bao nhiêu ạ? Em muốn đặt lịch cuối tuần này.", 6],
  ["Da em bị nám hai bên gò má khá lâu rồi, spa có gói điều trị nào phù hợp không ạ?", 32],
  ["Em muốn hỏi triệt lông tay chân trọn gói thì bao nhiêu buổi là hết ạ?", 58],
  ["Cho em xin địa chỉ và giờ mở cửa hôm nay với ạ, em ở gần Nguyễn Đình Chiểu.", 95],
  ["Em đặt lịch 15h chiều mai được không chị? Em làm chăm sóc da chuyên sâu nhé.", 140],
  ["Hôm trước em làm xong da hơi đỏ và châm châm, như vậy có bình thường không chị?", 190],
];
const readInbox = [
  ["Dạ em cảm ơn chị, em sẽ tới đúng giờ hẹn ạ.", 320],
  ["Chị cho em giữ suất ưu đãi tháng này nha, em chuyển khoản trước 30% được không?", 400],
  ["Em đã nhận được hướng dẫn chăm sóc da tại nhà rồi, cảm ơn spa nhiều.", 520],
  ["Liệu trình của em còn mấy buổi nữa vậy chị?", 610],
  ["Em muốn đổi lịch từ thứ Năm sang thứ Bảy có được không ạ?", 700],
  ["Spa có combo đi hai người không chị? Em rủ bạn đi cùng.", 880],
];

const inboxMessages = [
  ...unreadInbox.map(([message, minutesAgo], index) => ({
    id: `demo-message-${index + 1}`,
    senderId: `demo-psid-${String(index + 1).padStart(3, "0")}`,
    senderName: customerSeeds[index][0],
    message,
    fbMessageId: `demo-mid-${index + 1}`,
    reply: null,
    isRead: false,
    isAutoReply: false,
    customerId: `demo-customer-${index + 1}`,
    facebookPageId: PAGE_ID,
    createdAt: minutesFromNow(-minutesAgo),
  })),
  ...readInbox.map(([message, minutesAgo], offset) => {
    const index = offset + 6;
    return {
      id: `demo-message-${index + 1}`,
      senderId: `demo-psid-${String(index + 1).padStart(3, "0")}`,
      senderName: customerSeeds[index][0],
      message,
      fbMessageId: `demo-mid-${index + 1}`,
      reply: "Dạ em đã ghi nhận, spa sẽ xác nhận lại với chị trong ít phút nữa ạ.",
      isRead: true,
      isAutoReply: offset % 2 === 0,
      customerId: `demo-customer-${index + 1}`,
      facebookPageId: PAGE_ID,
      createdAt: minutesFromNow(-minutesAgo),
    };
  }),
];

// stage/score/service/source/customerIndex/createdAt/nextFollowUp/lastAction
const leadSeeds = [
  ["Nguyễn Thị Mai Anh", "hot", 92, "Trẻ hóa da HIFU", "facebook", 1, vn(0, 8, 40), vn(0, 16, 0), "Đã gửi bảng giá liệu trình HIFU và ảnh trước – sau"],
  ["Trần Thu Hà", "hot", 85, "Trị nám Laser Toning", "facebook", 2, vn(0, 9, 15), vn(0, 17, 30), "Đã tư vấn phác đồ 5 buổi, khách đang xin ý kiến gia đình"],
  ["Lê Ngọc Bích", "hot", 78, "Triệt lông công nghệ cao", "instagram", 3, vn(0, 10, 5), vn(0, 18, 0), "Đã báo giá combo 6 buổi, chờ khách chọn khung giờ"],
  ["Hoàng Thị Kim Ngân", "hot", 74, "Chăm sóc da chuyên sâu", "zalo", 5, vn(0, 11, 20), vn(1, 9, 30), "Khách hỏi ưu đãi khách mới, đã gửi voucher 20%"],
  ["Phạm Thùy Dương", "warm", 58, "Detox da thanh lọc", "facebook", 4, vn(0, 12, 10), vn(1, 14, 0), "Đã nhắn hỏi khung giờ tối, chờ khách trả lời"],
  ["Vũ Hồng Nhung", "warm", 49, "Chăm sóc da chuyên sâu", "website", 6, vn(0, 13, 45), vn(1, 16, 0), "Điền form trên website, cần gọi xác nhận nhu cầu"],
  ["Đặng Phương Linh", "cold", 22, "Triệt lông công nghệ cao", "tiktok", 7, vn(-2, 20, 15), null, "Bình luận dưới video triệt lông, chưa để lại số"],
  ["Bùi Thị Thanh Tâm", "cold", 15, null, "referral", 8, vn(-3, 15, 30), null, "Bạn của khách cũ giới thiệu, mới chào hỏi"],
  ["Ngô Hải Yến", "booked", 88, "Trẻ hóa da HIFU", "facebook", 9, vn(-4, 10, 0), null, "Đã chốt liệu trình, cọc 30% và hẹn buổi đầu"],
  ["Dương Khánh Huyền", "closed", 95, "Trị nám Laser Toning", "facebook", 10, vn(-9, 14, 20), null, "Hoàn tất 5 buổi, đã xin feedback và ảnh kết quả"],
];

const leads = leadSeeds.map(([name, stage, score, service, source, customerIndex, createdAt, nextFollowUp, lastAction], index) => ({
  id: `demo-lead-${index + 1}`,
  customerId: `demo-customer-${customerIndex}`,
  name,
  phone: customerSeeds[customerIndex - 1][1],
  source,
  score,
  stage,
  service,
  lastAction,
  nextFollowUp,
  note: null,
  channelType: source === "zalo" ? "zalo" : "messenger",
  channelId: `demo-psid-${String(customerIndex).padStart(3, "0")}`,
  handoffAt: stage === "booked" || stage === "closed" ? vn(-1, 9, 0) : null,
  handoffMode: stage === "booked" || stage === "closed" ? "staff" : null,
  nurtureStep: stage === "cold" ? 0 : stage === "warm" ? 1 : 2,
  fromPostId: index % 3 === 0 ? "demo-post-1" : null,
  fromCampaignId: index % 3 === 1 ? "demo-camp-001" : null,
  createdAt,
  updatedAt: minutesFromNow(-(index + 1) * 17),
}));

const leadConversations = leads.map((lead, index) => ({
  id: `demo-conversation-${index + 1}`,
  leadId: lead.id,
  senderId: lead.channelId,
  facebookPageId: PAGE_ID,
  step: lead.nurtureStep + 1,
  version: 1,
  collectedName: lead.name,
  collectedService: lead.service,
  isComplete: lead.stage === "booked" || lead.stage === "closed",
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt,
}));

// leadIndex/customerIndex/service/amount(VND)/paidAt — sums to 41.000.000đ
const bookingSeeds = [
  [9, 9, "Trẻ hóa da HIFU", 12_000_000, vn(0, 9, 20)],
  [10, 10, "Trị nám Laser Toning", 6_500_000, vn(0, 10, 5)],
  [1, 1, "Trẻ hóa da HIFU", 8_500_000, vn(0, 11, 40)],
  [2, 2, "Trị nám Laser Toning", 5_500_000, vn(0, 13, 15)],
  [4, 5, "Chăm sóc da chuyên sâu", 4_300_000, vn(0, 15, 0)],
  [5, 4, "Detox da thanh lọc", 2_900_000, vn(0, 16, 30)],
  [6, 6, "Chăm sóc da chuyên sâu", 1_300_000, vn(0, 18, 10)],
];

const bookingRevenues = bookingSeeds.map(([leadIndex, customerIndex, service, amount, paidAt], index) => ({
  id: `demo-booking-${index + 1}`,
  leadId: `demo-lead-${leadIndex}`,
  bookingId: `DEMO-BK-${String(index + 1).padStart(4, "0")}`,
  customerId: `demo-customer-${customerIndex}`,
  service,
  amount,
  paidAt,
  fromPostId: index % 3 === 0 ? "demo-post-1" : null,
  fromCampaignId: index % 3 === 1 ? "demo-camp-001" : null,
  fromAdId: null,
  createdAt: paidAt,
}));

const appointmentRequests = [
  ["Nguyễn Thị Mai Anh", 1, "Trẻ hóa da HIFU", "hôm nay 16:00", "inbox", "Khách muốn gặp chuyên viên tư vấn trước khi vào liệu trình.", 45],
  ["Trần Thu Hà", 2, "Trị nám Laser Toning", "hôm nay 18:30", "inbox", "Buổi 4/5, nhắc khách mang theo kem chống nắng.", 80],
  ["Lê Ngọc Bích", 3, "Triệt lông công nghệ cao", "ngày mai 09:30", "zalo", "Khách mới, cần test phản ứng da trước khi bắn.", 130],
  ["Hoàng Thị Kim Ngân", 5, "Chăm sóc da chuyên sâu", "ngày mai 14:00", "website", "Đặt qua form website, chưa xác nhận số điện thoại.", 175],
  ["Phạm Thùy Dương", 4, "Detox da thanh lọc", "ngày mai 19:00", "inbox", "Khách chỉ rảnh sau 19h, ưu tiên chuyên viên Ngọc.", 240],
].map(([name, customerIndex, service, preferredAt, source, note, minutesAgo], index) => ({
  id: `demo-appointment-${index + 1}`,
  name,
  phone: customerSeeds[customerIndex - 1][1],
  service,
  preferredAt,
  note,
  status: "pending",
  source,
  customerId: `demo-customer-${customerIndex}`,
  createdAt: minutesFromNow(-minutesAgo),
  updatedAt: minutesFromNow(-minutesAgo),
}));

const careMessages = [
  ["follow_up", 1, "facebook", vn(0, 14, 0), "Chào chị Mai Anh, sau 3 ngày làm HIFU da chị thấy thế nào ạ? Spa muốn ghi nhận để điều chỉnh mức năng lượng buổi tới."],
  ["reminder", 2, "zalo", vn(0, 15, 30), "Nhắc chị Thu Hà buổi trị nám thứ 4 vào 18:30 hôm nay, chị nhớ không trang điểm trước khi tới nhé."],
  ["aftercare", 3, "facebook", null, "Gửi chị Ngọc Bích hướng dẫn chăm sóc sau triệt lông: tránh nắng 48 giờ và không tẩy da chết trong 3 ngày."],
  ["birthday", 12, "zalo", vn(0, 8, 0), "Chúc mừng sinh nhật chị Hồng Đào! Spa tặng chị một buổi detox da miễn phí trong tháng này."],
  ["reactivation", 7, "facebook", vn(0, 19, 0), "Đã 2 tháng chị Phương Linh chưa ghé spa, tháng này có ưu đãi 25% cho khách quay lại ạ."],
  ["follow_up", 9, "instagram", null, "Chị Hải Yến ơi, buổi HIFU đầu tiên có làm chị thấy căng vùng viền hàm hơn không ạ?"],
].map(([type, customerIndex, platform, scheduledAt, content], index) => ({
  id: `demo-care-${index + 1}`,
  customerId: `demo-customer-${customerIndex}`,
  type,
  content,
  platform,
  scheduledAt,
  sentAt: null,
  status: "pending",
  createdAt: minutesFromNow(-(index + 1) * 55),
}));

const socialAlerts = [
  ["ad_anomaly", "critical", "facebook_ads", "CPA chiến dịch “Triệt lông công nghệ cao – Tháng 7” tăng cao 68% trong 24 giờ, hiện ở mức 412.000đ mỗi khách."],
  ["negative_sentiment", "warning", "facebook_comments", "Có 3 phản hồi tiêu cực mới về thời gian chờ tại cơ sở Quận 3, tất cả trong vòng một giờ."],
  ["competitor_spike", "warning", "competitor_watch", "Đối thủ Seoul Center tăng hoạt động: 12 bài quảng cáo triệt lông mới trong tuần này."],
  ["engagement_drop", "info", "page_insights", "Tương tác bài viết giảm 18% so với tuần trước, riêng nhóm ảnh trước – sau vẫn giữ hiệu quả."],
].map(([type, severity, source, content], index) => ({
  id: `demo-social-alert-${index + 1}`,
  type,
  content,
  source,
  severity,
  isRead: false,
  createdAt: minutesFromNow(-(index + 1) * 37),
}));

const realtimeAlerts = [
  ["ad_anomaly", "critical", "CPA chiến dịch “Triệt lông công nghệ cao – Tháng 7” tăng cao 68% lên 412.000đ mỗi khách trong 24 giờ."],
  ["negative_sentiment", "warning", "3 phản hồi tiêu cực về thời gian chờ tại cơ sở Quận 3 trong một giờ, cần trả lời trước khi lan rộng."],
  ["competitor_spike", "warning", "Đối thủ Seoul Center tăng hoạt động với 12 quảng cáo triệt lông mới, giá chào thấp hơn 15%."],
  ["spend_spike", "critical", "Chi phí quảng cáo hôm nay đã dùng 82% ngân sách ngày chỉ sau 6 giờ chạy."],
].map(([type, severity, signal], index) => ({
  id: `demo-realtime-alert-${index + 1}`,
  type,
  signal,
  severity,
  workflowRunId: index === 0 ? "demo-workflow-2" : null,
  acknowledged: false,
  detectedAt: minutesFromNow(-[25, 70, 180, 310][index]),
}));

const pendingApprovals = [
  ["ad_budget_increase", "DEMO01", {
    campaignName: "Triệt lông công nghệ cao – Tháng 7",
    oldBudget: "800.000đ/ngày",
    newBudget: "1.200.000đ/ngày",
    reason: "ROAS 3.4 và CTR 2.8% duy trì liên tục 3 ngày",
  }, 120, 40],
  ["ad_pause", "DEMO02", {
    campaignName: "Trị nám Laser Toning – Nhắm lại khách cũ",
    adsetName: "Nữ 28-40, TP.HCM",
    reason: "CTR 0.42% thấp hơn ngưỡng 0.5% và CPA 512.000đ",
  }, 300, 25],
  ["content_publish", "DEMO03", {
    postId: "demo-post-4",
    platform: "facebook",
    caption: "Ưu đãi tháng 7: Chăm sóc da chuyên sâu chỉ còn 360.000đ",
  }, 1560, 10],
].map(([type, shortCode, payload, timeoutMinutes, createdMinutesAgo], index) => ({
  id: `demo-approval-${index + 1}`,
  type,
  payload: JSON.stringify(payload),
  status: "pending",
  shortCode,
  zaloMessageId: null,
  timeoutAt: minutesFromNow(timeoutMinutes),
  createdAt: minutesFromNow(-createdMinutesAgo),
}));

const posts = [
  {
    id: "demo-post-1", platform: "facebook", status: "published", serviceId: "demo-service-4",
    caption: "Sau 5 buổi Trị nám Laser Toning, vùng nám gò má của chị Huyền đã mờ rõ rệt. Điều quan trọng nhất vẫn là chống nắng đều tay mỗi ngày, cả khi trời râm.",
    hashtags: "#trinam #lasertoning #lotusbeautyspa", postType: "story", tone: "friendly",
    qualityScore: 88, qualityNotes: "Đạt: có bằng chứng thật, không hứa hẹn tuyệt đối.",
    publishedAt: earlierThisMonth(6, 19, 30), fbPostId: "demo-fbpost-1",
  },
  {
    id: "demo-post-2", platform: "instagram", status: "published", serviceId: "demo-service-2",
    caption: "Trẻ hóa da HIFU không phải phép màu qua đêm. Sóng siêu âm hội tụ cần 4–8 tuần để kích thích collagen mới, nên hãy kiên nhẫn cùng làn da của mình nhé.",
    hashtags: "#hifu #trehoada #nangco", postType: "education", tone: "professional",
    qualityScore: 91, qualityNotes: "Đạt: giải thích cơ chế, có mốc thời gian thực tế.",
    publishedAt: earlierThisMonth(3, 20, 0), igPostId: "demo-igpost-2",
  },
  {
    id: "demo-post-3", platform: "tiktok", status: "published", serviceId: "demo-service-5",
    caption: "Một buổi Detox da thanh lọc tại Lotus diễn ra thế nào? Cùng xem trọn 60 phút từ bước làm sạch tới đắp mặt nạ làm dịu.",
    hashtags: "#detoxda #spahcm #chamsocda", postType: "behind-scenes", tone: "friendly",
    qualityScore: 84, qualityNotes: "Đạt: nội dung quy trình, không so sánh đối thủ.",
    publishedAt: earlierThisMonth(1, 12, 15), tiktokVideoId: "demo-tiktok-3",
  },
  {
    id: "demo-post-4", platform: "facebook", status: "scheduled", serviceId: "demo-service-1",
    caption: "Ưu đãi tháng 7: Chăm sóc da chuyên sâu 75 phút chỉ còn 360.000đ cho 20 khách đặt lịch sớm nhất. Nhắn tin để spa giữ suất cho chị nhé.",
    hashtags: "#uudai #chamsocda #lotusbeautyspa", postType: "promotion", tone: "friendly",
    qualityScore: 86, qualityNotes: "Đạt: nêu rõ điều kiện ưu đãi và số lượng.",
    scheduledAt: slotLaterToday(0.35),
  },
  {
    id: "demo-post-5", platform: "zalo", status: "scheduled", serviceId: "demo-service-3",
    caption: "Triệt lông công nghệ cao mùa hè: 6 buổi cho vùng tay và chân, có test phản ứng da trước khi bắn. Spa sẽ tư vấn số buổi phù hợp với từng vùng.",
    hashtags: "#trietlong #laserdiode", postType: "service", tone: "professional",
    qualityScore: 82, qualityNotes: "Đạt: có bước test da, không cam kết vĩnh viễn.",
    scheduledAt: slotLaterToday(0.75),
  },
  {
    id: "demo-post-6", platform: "instagram", status: "scheduled", serviceId: "demo-service-2",
    caption: "Buổi sáng ở Lotus bắt đầu bằng việc khử khuẩn toàn bộ đầu HIFU. Chị em an tâm vì mỗi khách đều dùng đầu tip riêng theo số lần đã cam kết.",
    hashtags: "#hifu #antoan #spahcm", postType: "behind-scenes", tone: "friendly",
    qualityScore: 87, qualityNotes: "Đạt: nhấn mạnh an toàn, có kiểm chứng nội bộ.",
    scheduledAt: vn(1, 9, 30),
  },
  {
    id: "demo-post-7", platform: "facebook", status: "draft", serviceId: "demo-service-4",
    caption: "Trắng da bật tông chỉ sau 1 buổi, cam kết hết nám 100% hoặc hoàn tiền!",
    hashtags: "#trinam #trangda", postType: "promotion", tone: "urgent",
    qualityScore: 41,
    qualityNotes: "BLOCKED: Cam kết “hết nám 100%” và “trắng da sau 1 buổi” vi phạm quy định quảng cáo dịch vụ y tế – thẩm mỹ. Cần bỏ toàn bộ tuyên bố tuyệt đối hóa và thay bằng mô tả cải thiện theo liệu trình.",
  },
  {
    id: "demo-post-8", platform: "tiktok", status: "draft", serviceId: "demo-service-3",
    caption: "Triệt lông vĩnh viễn một lần cho cả đời, không bao giờ mọc lại nữa nha cả nhà.",
    hashtags: "#trietlong #vinhvien", postType: "service", tone: "friendly",
    qualityScore: 52,
    qualityNotes: "BLOCKED: Dùng từ “vĩnh viễn” và thiếu cảnh báo chống chỉ định với khách đang điều trị bằng thuốc isotretinoin. Cần bổ sung lưu ý và đổi sang “giảm lông lâu dài”.",
  },
  {
    id: "demo-post-9", platform: "instagram", status: "draft", serviceId: "demo-service-2",
    caption: "Ảnh trước – sau của khách làm HIFU tuần này, chị em xem có khác biệt không ạ?",
    hashtags: "#hifu #truocsau", postType: "story", tone: "friendly",
    qualityScore: 47,
    qualityNotes: "BLOCKED: Ảnh trước – sau chưa có văn bản đồng ý sử dụng hình ảnh của khách hàng. Cần thu thập consent hoặc thay bằng ảnh minh họa đã được cấp phép.",
  },
].map((post, index) => ({
  id: post.id,
  caption: post.caption,
  hashtags: post.hashtags,
  imageUrl: null,
  imagePrompt: null,
  platform: post.platform,
  postType: post.postType,
  tone: post.tone,
  status: post.status,
  scheduledAt: post.scheduledAt ?? null,
  publishedAt: post.publishedAt ?? null,
  fbPostId: post.fbPostId ?? null,
  igPostId: post.igPostId ?? null,
  tiktokVideoId: post.tiktokVideoId ?? null,
  qualityScore: post.qualityScore,
  qualityNotes: post.qualityNotes,
  serviceId: post.serviceId,
  facebookPageId: PAGE_ID,
  createdAt: vn(-14 + index, 8, 0),
  updatedAt: minutesFromNow(-(index + 1) * 23),
}));

const activityLogs = [
  ["revenue", "Đã ghi nhận 41.000.000đ doanh thu hôm nay", "7 giao dịch từ 5 dịch vụ, cao nhất là liệu trình HIFU 12.000.000đ.", "/reports", "success", "spa_sync", 20],
  ["ads", "Tạm dừng nhóm quảng cáo có CTR thấp", "Nhóm “Nữ 28-40, TP.HCM” của chiến dịch trị nám chỉ đạt CTR 0.42%, đang chờ chủ spa duyệt.", "/ads", "warning", "ads_agent", 55],
  ["content", "3 bài viết bị chặn ở bước kiểm duyệt", "Vi phạm quy định quảng cáo y tế và thiếu văn bản đồng ý hình ảnh khách hàng.", "/publish", "critical", "content_reviewer", 95],
  ["lead", "6 khách mới vào phễu trong hôm nay", "4 khách đạt mức ưu tiên cao, nên gọi lại trước 18:00 hôm nay.", "/sale", "info", "lead_agent", 150],
  ["inbox", "Trả lời tự động 9 tin nhắn hỏi giá", "6 tin còn lại cần người thật phản hồi vì khách hỏi về tình trạng da cụ thể.", "/inbox", "info", "inbox_agent", 210],
].map(([type, title, detail, href, severity, source, minutesAgo], index) => ({
  id: `demo-activity-${index + 1}`,
  type,
  title,
  detail,
  href,
  severity,
  source,
  metadata: null,
  createdAt: minutesFromNow(-minutesAgo),
}));

const adOptimizationLogs = [
  ["demo-camp-001", "Triệt lông công nghệ cao – Tháng 7", "increase_budget", "ROAS 3.4 và CTR 2.8% duy trì liên tục 3 ngày", "800.000đ/ngày", "1.200.000đ/ngày", vn(0, 8, 15)],
  ["demo-camp-002", "Trị nám Laser Toning – Nhắm lại khách cũ", "pause_adset", "CTR 0.42% thấp hơn ngưỡng 0.5%", "Đang chạy", "Tạm dừng", vn(0, 10, 40)],
  ["demo-camp-003", "Chăm sóc da chuyên sâu – Khách mới", "rotate_creative", "Tần suất hiển thị 3.6 vượt giới hạn 3.0", "Ảnh trước – sau #2", "Video cảm nhận khách #5", vn(0, 13, 5)],
  ["demo-camp-004", "Trẻ hóa da HIFU – Khách thân thiết", "decrease_budget", "CPA 512.000đ cao hơn mục tiêu 380.000đ", "1.500.000đ/ngày", "1.100.000đ/ngày", vn(0, 15, 50)],
].map(([campaignId, campaignName, action, reason, oldValue, newValue, createdAt], index) => ({
  id: `demo-ad-log-${index + 1}`,
  campaignId,
  campaignName,
  action,
  reason,
  oldValue,
  newValue,
  createdAt,
}));

const jobRuns = [
  ["Tạo 10 ảnh cho bài viết trị nám", "completed", "schedule", "Đã tạo 10 ảnh, 8 ảnh đạt điểm chất lượng trên 80.", null, 480, 465],
  ["Render video feedback khách hàng", "running", "manual", "Đang dựng cảnh 3/5, dự kiến hoàn tất trong 12 phút.", null, 9, null],
  ["Phân tích đối thủ tuần này", "completed", "schedule", "Đã phân tích 42 bài của 5 đối thủ, phát hiện 3 chủ đề đang lên.", null, 1020, 998],
  ["Đồng bộ doanh thu từ phần mềm spa", "failed", "cron", null, "Hết thời gian chờ khi gọi API phần mềm spa sau 30 giây.", 1140, 1139],
  ["Chấm điểm và phân loại khách mới", "failed", "schedule", null, "Thiếu khóa API nên không chấm được điểm cho 4 khách mới.", 300, 298],
].map(([name, status, trigger, summary, error, startedMinutesAgo, completedMinutesAgo], index) => ({
  id: `demo-job-${index + 1}`,
  name,
  status,
  trigger,
  summary,
  metrics: null,
  error,
  startedAt: minutesFromNow(-startedMinutesAgo),
  completedAt: completedMinutesAgo === null ? null : minutesFromNow(-completedMinutesAgo),
}));

const workflowRuns = [
  ["Xử lý phản hồi tiêu cực", "3 phản hồi tiêu cực trong một giờ", "completed", "Đã trả lời công khai 3 bình luận và chuyển 1 ca sang quản lý cơ sở Quận 3.", 190, 178],
  ["Chặn đà tăng CPA quảng cáo", "CPA tăng cao 68% trong 24 giờ", "running", null, 26, null],
  ["Đối thủ tăng hoạt động", "Seoul Center tăng 12 quảng cáo triệt lông", "completed", "Đã đề xuất 3 góc nội dung phản hồi và một combo giữ giá.", 560, 542],
  ["Cứu doanh thu cuối tháng", "Doanh thu tháng chỉ đạt 68% mục tiêu", "failed", null, 1600, 1590],
].map(([name, trigger, status, plan, startedMinutesAgo, completedMinutesAgo], index) => ({
  id: `demo-workflow-${index + 1}`,
  name,
  trigger,
  context: JSON.stringify({ page: "Lotus Beauty Spa – Quận 3", window: "24h", locale: "vi-VN" }),
  steps: JSON.stringify([
    { agent: "intelligence", label: "Thu thập tín hiệu", status: "completed", durationMs: 4200 },
    { agent: "analyst", label: "Phân tích nguyên nhân", status: status === "running" ? "running" : "completed", durationMs: 8100 },
    { agent: "ceo", label: "Chốt phương án xử lý", status: status === "completed" ? "completed" : status === "failed" ? "failed" : "pending", durationMs: 5300 },
  ]),
  plan,
  status,
  startedAt: minutesFromNow(-startedMinutesAgo),
  completedAt: completedMinutesAgo === null ? null : minutesFromNow(-completedMinutesAgo),
}));

/* ── run ───────────────────────────────────────────────────────────────────── */

const client = await pool.connect();
try {
  await client.query("BEGIN");

  let removed = 0;
  for (const table of CLEANUP_ORDER) {
    const result = await client.query(`DELETE FROM "${table}" WHERE "id" LIKE $1`, ["demo-%"]);
    removed += result.rowCount ?? 0;
  }

  const counts = {};
  const write = async (table, rows) => {
    counts[table] = (counts[table] ?? 0) + await insertRows(client, table, rows);
  };

  await write("FacebookPage", facebookPages);
  await write("Service", services);
  await write("Customer", customers);
  await write("InboxMessage", inboxMessages);
  await write("Lead", leads);
  await write("LeadConversation", leadConversations);
  await write("BookingRevenue", bookingRevenues);
  await write("AppointmentRequest", appointmentRequests);
  await write("CareMessage", careMessages);
  await write("SocialAlert", socialAlerts);
  await write("RealtimeAlert", realtimeAlerts);
  await write("PendingApproval", pendingApprovals);
  await write("Post", posts);
  await write("ActivityLog", activityLogs);
  await write("AdOptimizationLog", adOptimizationLogs);
  await write("JobRun", jobRuns);
  await write("WorkflowRun", workflowRuns);

  // The non-owner e2e account only sees pages it is explicitly granted.
  const viewer = await client.query(`SELECT "id" FROM "User" WHERE "email" = $1`, [VIEWER_EMAIL.toLowerCase()]);
  if (viewer.rows.length) {
    await write("UserPageAccess", [{
      id: "demo-access-viewer",
      userId: viewer.rows[0].id,
      facebookPageId: PAGE_ID,
      permission: "viewer",
      createdAt: now,
    }]);
  }

  await client.query("COMMIT");

  const totalInserted = Object.values(counts).reduce((sum, value) => sum + value, 0);
  console.log(`Seeded demo data in ${databaseName} (removed ${removed} previous demo rows, inserted ${totalInserted})`);
  console.log(`Business day (Asia/Ho_Chi_Minh): ${startOfDay.toISOString()} → ${endOfDay.toISOString()}`);
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count}`);
  if (posts.some((post) => post.status === "scheduled" && post.scheduledAt && post.scheduledAt <= now)) {
    console.warn("  ! Ran too close to midnight: some scheduled posts are no longer in the future.");
  }
  console.log("Open the dashboard with ?scope=all as the owner to also see approvals, alerts, ads logs, AI jobs and activity (those models are hidden in single-page scope).");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
