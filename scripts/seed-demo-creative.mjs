// Local-only demo data for the "Ý tưởng & Nghiên cứu" studio.
// Idempotent: every row id is prefixed "demo-" and deleted before re-insert.
// Refuses to run against a database whose name does not look like test/e2e/demo.
//
// Usage: node scripts/seed-demo-creative.mjs   (needs DATABASE_URL)

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const dbName = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ""));
if (!/(_e2e|_test|test|e2e|demo)/i.test(dbName)) {
  console.error(`Refusing to seed non-test database: ${dbName}`);
  process.exit(1);
}

const PAGE_ID = "demo-page-1";
const pool = new pg.Pool({ connectionString });

// Naive UTC strings: the pg adapter reads timestamps as UTC, so binding a JS Date
// would shift every value by the machine's offset.
const utc = (date) => date.toISOString().replace("T", " ").replace("Z", "");
const hoursAgo = (h) => utc(new Date(Date.now() - h * 3600_000));
const atHourToday = (hour, minute = 0) => {
  const now = new Date();
  // Business day is Asia/Ho_Chi_Minh (+07); store the equivalent UTC instant.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour - 7, minute, 0));
  return utc(d);
};

// Two samples per topic so the UI can show a MEASURED delta, not an invented one.
// "trẻ hóa da" appears on google_trends while fb_ads_library carries "trẻ hóa da
// HIFU", so the corroboration factor has a real two-source case to report.
const SIGNALS = [
  { topic: "peel da mùa hè", source: "google_trends", prev: 1400, now: 3920, trend: "rising" },
  { topic: "trị nám laser toning", source: "google_trends", prev: 2600, now: 3250, trend: "rising" },
  { topic: "trẻ hóa da", source: "google_trends", prev: 2100, now: 4600, trend: "rising" },
  { topic: "trẻ hóa da HIFU", source: "fb_ads_library", prev: 12, now: 19, trend: "rising" },
  { topic: "triệt lông công nghệ cao", source: "fb_ads_library", prev: 21, now: 15, trend: "falling" },
  { topic: "chăm sóc da dầu mụn", source: "google_trends", prev: 1800, now: 1850, trend: "stable" },
  { topic: "filler má baby", source: "fb_competitor", prev: 8, now: 14, trend: "rising" },
];

/**
 * Measured performance of already-published posts, per postType + platform +
 * tone. This is what "Hiệu quả tương tự đã đo" reads; nothing here is a forecast.
 * `promo` on Instagram is deliberately left at 3 samples so the sample floor
 * (MIN_BENCHMARK_SAMPLES) is visibly enforced — that group must NOT render.
 */
const CONTENT_MEMORY = [
  { postType: "educational", platform: "facebook", tone: "professional", avgEngagement: 38.4, sampleCount: 14 },
  { postType: "educational", platform: "facebook", tone: "friendly", avgEngagement: 52.1, sampleCount: 9 },
  { postType: "educational", platform: "instagram", tone: "friendly", avgEngagement: 61.3, sampleCount: 7 },
  { postType: "testimonial", platform: "facebook", tone: "friendly", avgEngagement: 74.6, sampleCount: 11 },
  { postType: "testimonial", platform: "facebook", tone: "professional", avgEngagement: 40.2, sampleCount: 4 },
  { postType: "promo", platform: "facebook", tone: "friendly", avgEngagement: 88.9, sampleCount: 22 },
  { postType: "promo", platform: "instagram", tone: "playful", avgEngagement: 30.0, sampleCount: 3 },
  { postType: "service", platform: "facebook", tone: "professional", avgEngagement: 25.7, sampleCount: 6 },
];

const COMPETITOR_TOPICS = [
  { label: "trẻ hóa da", count: 24, score: 96 },
  { label: "điều trị da", count: 19, score: 81 },
  { label: "triệt lông", count: 15, score: 62 },
  { label: "ưu đãi dịch vụ", count: 12, score: 48 },
  { label: "chăm sóc da mặt", count: 9, score: 35 },
];

/**
 * Provenance rows behind the "Lịch sử" tab. `daily_report` is what actually
 * drives the research syncs, so one failed run is included — the timeline must
 * surface a real error, not only happy paths.
 */
const JOB_RUNS = [
  { name: "daily_report", status: "success", trigger: "cron", summary: "Đồng bộ 7 chủ đề, 1 brief", hoursAgo: 3, seconds: 42, error: null },
  { name: "auto_publish", status: "success", trigger: "cron", summary: "Đăng 2 bài đã lên lịch", hoursAgo: 9, seconds: 18, error: null },
  { name: "daily_report", status: "failed", trigger: "cron", summary: null, hoursAgo: 27, seconds: 6, error: "Google Trends trả về 429, bỏ qua nguồn này" },
  { name: "realtime_monitor", status: "success", trigger: "cron", summary: "Không có cảnh báo mới", hoursAgo: 33, seconds: 4, error: null },
  { name: "daily_report", status: "success", trigger: "manual", summary: "Đồng bộ 5 chủ đề", hoursAgo: 51, seconds: 37, error: null },
];

const GENERATIONS = [
  { postId: "demo-idea-1", model: "claude-sonnet-5", mode: "deep", humanScore: 84, userAccepted: true, hoursAgo: 6 },
  { postId: "demo-idea-2", model: "claude-sonnet-5", mode: "quick", humanScore: 71, userAccepted: true, hoursAgo: 6 },
  { postId: "demo-idea-3", model: "claude-sonnet-5", mode: "deep", humanScore: 66, userAccepted: null, hoursAgo: 6 },
  { postId: null, model: "claude-sonnet-5", mode: "quick", humanScore: 41, userAccepted: false, hoursAgo: 29 },
];

const RESEARCH_DRAFTS = [
  {
    id: "demo-idea-1", topic: "Quy trình peel an toàn mùa hè", postType: "educational", tone: "professional",
    hour: 9,
    title: "Quy trình peel an toàn mùa hè",
    summary: "Bài giải thích quy trình peel an toàn trong mùa hè, giúp khách hiểu đúng về peel, lợi ích, lưu ý quan trọng và cách chăm sóc sau peel để đảm bảo hiệu quả và hạn chế rủi ro.",
    outline: [
      "Peel là gì và lợi ích với da",
      "Vì sao cần peel đúng cách vào mùa hè",
      "Quy trình peel an toàn tại spa (5 bước)",
      "Những lưu ý quan trọng trước – trong – sau peel",
      "Ai nên và không nên peel vào mùa hè",
    ],
    hooks: [
      "Peel mùa hè có an toàn không? Câu trả lời sẽ khiến bạn bất ngờ.",
      "Peel đúng cách — da đẹp lên từng ngày, không lo bắt nắng.",
      "5 bước peel chuẩn y khoa — bí quyết để da sáng mịn mùa hè.",
    ],
    topicTags: ["Kiến thức", "Chăm sóc da"],
    targetChannels: ["facebook", "tiktok", "zalo"],
    assets: [
      { kind: "image", name: "quy-trinh-peel-5buoc.jpg", mimeType: "image/jpeg", sizeBytes: 1_258_291, durationSec: null },
      { kind: "video", name: "peel-an-toan-mua-he.mp4", mimeType: "video/mp4", sizeBytes: 25_690_112, durationSec: 45 },
      { kind: "image", name: "peel-mua-he-infographic.png", mimeType: "image/png", sizeBytes: 2_202_010, durationSec: null },
    ],
    caption: "Peel da mùa hè — vẫn an toàn nếu bạn làm đúng cách ☀️\n\nPeel giúp loại bỏ tế bào chết, kích thích tái tạo da, cải thiện thâm nám và làm sáng mịn da. Nhưng mùa hè nắng gắt nên quy trình phải chuẩn và chăm sóc sau peel phải kỹ.\n\n5 bước peel an toàn tại spa:\n1. Soi da, xác định tình trạng và nồng độ phù hợp\n2. Làm sạch sâu hai bước\n3. Peel theo từng lớp, theo dõi phản ứng da\n4. Làm dịu và phục hồi bằng mặt nạ chuyên biệt\n5. Chống nắng và hướng dẫn chăm sóc tại nhà\n\nLưu ý: tránh nắng trực tiếp 7 ngày sau peel, dùng kem chống nắng SPF 50+ mỗi ngày.\n\n💜 Inbox để được soi da và tư vấn liệu trình peel phù hợp với tình trạng da của bạn.",
    hashtags: "#peelda #chamsocda #spa #trinam #peelmuahe",
  },
  {
    id: "demo-idea-2", topic: "Feedback trị nám sau 2 buổi", postType: "testimonial", tone: "friendly",
    hour: 12,
    title: "Feedback trị nám sau 2 buổi",
    summary: "Chia sẻ kết quả thực tế của một khách hàng sau 2 buổi trị nám bằng laser toning, nhấn mạnh việc không cần nghỉ dưỡng và mỗi làn da cần một phác đồ riêng.",
    outline: [
      "Tình trạng da ban đầu của khách",
      "Liệu trình đã áp dụng và khoảng cách giữa 2 buổi",
      "Kết quả quan sát được sau 2 buổi",
      "Điều khách hài lòng nhất",
      "Kêu gọi soi da để có phác đồ riêng",
    ],
    hooks: [
      "Chỉ 2 buổi — vùng má của chị Hà đã sáng đều hơn rõ rệt.",
      "Trị nám mà không cần nghỉ dưỡng, có thật không?",
      "Cùng một loại nám, hai người có thể cần hai phác đồ khác nhau.",
    ],
    topicTags: ["Cảm nhận", "Trị nám"],
    targetChannels: ["facebook", "zalo"],
    assets: [
      { kind: "image", name: "feedback-chi-ha-truoc-sau.jpg", mimeType: "image/jpeg", sizeBytes: 986_112, durationSec: null },
      { kind: "video", name: "chi-ha-chia-se.mp4", mimeType: "video/mp4", sizeBytes: 18_874_368, durationSec: 32 },
    ],
    caption: "Chị Hà sau 2 buổi trị nám — vùng má đã sáng đều hơn rõ rệt ✨\n\nTình trạng ban đầu: nám mảng hai bên gò má, da hơi khô và bong nhẹ. Liệu trình: laser toning kết hợp dưỡng phục hồi, 2 buổi cách nhau 10 ngày.\n\nĐiều chị Hà thích nhất là không phải nghỉ dưỡng, xong là về đi làm bình thường được luôn.\n\nMỗi làn da một phác đồ riêng — inbox để được soi da miễn phí nhé cả nhà.",
    hashtags: "#trinam #lasertoning #feedbackkhachhang #spa",
  },
  {
    id: "demo-idea-3", topic: "So sánh laser toning và meso", postType: "educational", tone: "professional",
    hour: 18,
    caption: "Laser toning và meso trắng da — nên chọn cái nào? 🤔\n\nLaser toning: dùng năng lượng ánh sáng phá vỡ hạt sắc tố, phù hợp nám sâu và nám mảng lâu năm. Cần nhiều buổi, hiệu quả bền.\n\nMeso trắng da: đưa dưỡng chất vào lớp trung bì, cải thiện tổng thể độ sáng và độ ẩm, phù hợp da xỉn màu, thiếu sức sống.\n\nThực tế nhiều trường hợp kết hợp cả hai sẽ cho kết quả tốt hơn là chọn một.\n\nĐể biết da mình phù hợp hướng nào, inbox đặt lịch soi da nha.",
    hashtags: "#lasertoning #mesotrangda #chamsocda #spa",
  },
  {
    id: "demo-idea-4", topic: "Chống nắng đúng cách cho da treatment", postType: "educational", tone: "friendly",
    hour: null,
    caption: "Đang làm treatment mà chống nắng sai thì coi như làm lại từ đầu 🧴\n\n3 lỗi hay gặp nhất:\n• Bôi quá ít — cần khoảng 2 đốt tay cho cả mặt\n• Không bôi lại — cứ 3-4 tiếng nên bôi lại nếu ra ngoài\n• Chỉ chống nắng khi trời nắng — tia UVA xuyên qua mây và cả kính\n\nDa đang peel, đang trị nám hay mới laser thì chống nắng là bước quan trọng nhất, hơn cả serum đắt tiền.\n\nInbox để được tư vấn loại chống nắng phù hợp với da bạn nhé.",
    hashtags: "#chongnang #skincare #treatment #chamsocda",
  },
];

const IMAGE_PRESETS = [
  ["testimonial", 18], ["before_after_concept", 24], ["service_hero", 12], ["educational", 9], ["organic", 6],
];

const client = await pool.connect();
try {
  await client.query("BEGIN");

  // Clean previous demo-creative rows (FK-safe order)
  await client.query(`DELETE FROM "PostAsset" WHERE "id" LIKE 'demo-asset-%'`);
  await client.query(`DELETE FROM "VideoProject" WHERE "sourcePostId" LIKE 'demo-idea-%'`);
  await client.query(`DELETE FROM "ImageGeneration" WHERE "id" LIKE 'demo-img-%'`);
  await client.query(`DELETE FROM "Post" WHERE "id" LIKE 'demo-idea-%'`);
  await client.query(`DELETE FROM "IntelligenceSignal" WHERE "id" LIKE 'demo-sig-%'`);
  await client.query(`DELETE FROM "CompetitorMemory" WHERE "id" LIKE 'demo-mem-%'`);
  await client.query(`DELETE FROM "ContentMemory" WHERE "id" LIKE 'demo-cm-%'`);
  await client.query(`DELETE FROM "ContentGeneration" WHERE "id" LIKE 'demo-gen-%'`);
  await client.query(`DELETE FROM "JobRun" WHERE "id" LIKE 'demo-job-%'`);
  await client.query(`DELETE FROM "BrandKit" WHERE "id" LIKE 'demo-brand-%'`);

  // Brand kit
  await client.query(
    `INSERT INTO "BrandKit" ("id","facebookPageId","logoUrl","primaryColor","accentColor","fontStyle","spaName","tagline","updatedAt")
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("facebookPageId") DO UPDATE SET
       "primaryColor"=EXCLUDED."primaryColor", "accentColor"=EXCLUDED."accentColor",
       "fontStyle"=EXCLUDED."fontStyle", "spaName"=EXCLUDED."spaName",
       "tagline"=EXCLUDED."tagline", "updatedAt"=EXCLUDED."updatedAt"`,
    ["demo-brand-1", PAGE_ID, "#6C5CE7", "#F43F6E", "elegant", "Lotus Beauty Spa", "Tận tâm – Thân thiện", utc(new Date())],
  );

  // Intelligence signals: previous sample then latest sample per topic
  let sigIndex = 0;
  for (const signal of SIGNALS) {
    await client.query(
      `INSERT INTO "IntelligenceSignal" ("id","source","topic","volume","trend","details","fetchedAt")
       VALUES ($1,$2,$3,$4,$5,NULL,$6)`,
      [`demo-sig-${++sigIndex}`, signal.source, signal.topic, signal.prev, "stable", hoursAgo(7 * 24)],
    );
    await client.query(
      `INSERT INTO "IntelligenceSignal" ("id","source","topic","volume","trend","details","fetchedAt")
       VALUES ($1,$2,$3,$4,$5,NULL,$6)`,
      [`demo-sig-${++sigIndex}`, signal.source, signal.topic, signal.now, signal.trend, hoursAgo(3)],
    );
  }

  // Competitor memory
  await client.query(
    `INSERT INTO "CompetitorMemory"
       ("id","windowDays","topTopics","topServices","topFormats","topHooks","commonOffers","competitorMomentum","counterPositioning","recommendations","sampleCount","confidence","lastAnalyzedPostAt","createdAt","updatedAt")
     VALUES ($1,30,$2,'[]','[]','[]','[]','[]',NULL,'[]',$3,$4,$5,$6,$6)`,
    [
      "demo-mem-1",
      JSON.stringify(COMPETITOR_TOPICS),
      47,
      0.78,
      hoursAgo(20),
      utc(new Date()),
    ],
  );

  // Content memory: measured averages behind "Hiệu quả tương tự đã đo"
  let memIndex = 0;
  for (const row of CONTENT_MEMORY) {
    await client.query(
      `INSERT INTO "ContentMemory"
         ("id","tone","postType","topKeywords","topHashtags","avgEngagement","sampleCount","platform","createdAt","updatedAt")
       VALUES ($1,$2,$3,'[]','[]',$4,$5,$6,$7,$7)`,
      [
        `demo-cm-${++memIndex}`, row.tone, row.postType,
        row.avgEngagement, row.sampleCount, row.platform,
        hoursAgo(12),
      ],
    );
  }

  // Research drafts (real Post rows, matching the AI-RESEARCH convention)
  let assetIndex = 0;
  for (const draft of RESEARCH_DRAFTS) {
    await client.query(
      `INSERT INTO "Post"
         ("id","facebookPageId","title","summary","outline","hooks","topicTags","targetChannels",
          "caption","hashtags","platform","postType","tone","status","scheduledAt","qualityNotes","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'facebook',$11,$12,'draft',$13,$14,$15,$15)`,
      [
        draft.id, PAGE_ID,
        draft.title ?? null,
        draft.summary ?? null,
        JSON.stringify(draft.outline ?? []),
        JSON.stringify(draft.hooks ?? []),
        JSON.stringify(draft.topicTags ?? []),
        JSON.stringify(draft.targetChannels ?? []),
        draft.caption, draft.hashtags, draft.postType, draft.tone,
        draft.hour === null ? null : atHourToday(draft.hour),
        `AI-RESEARCH: ${draft.topic}`,
        hoursAgo(6),
      ],
    );
    for (const [position, asset] of (draft.assets ?? []).entries()) {
      await client.query(
        `INSERT INTO "PostAsset"
           ("id","postId","kind","name","url","mimeType","sizeBytes","durationSec","position","source","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upload',$10)`,
        [
          `demo-asset-${++assetIndex}`, draft.id, asset.kind, asset.name,
          `/api/media/demo/${asset.name}`,
          asset.mimeType, asset.sizeBytes, asset.durationSec, position,
          hoursAgo(6),
        ],
      );
    }
  }

  // Cron runs (account-wide) behind the research pipeline
  let jobIndex = 0;
  for (const job of JOB_RUNS) {
    const startedAt = hoursAgo(job.hoursAgo);
    const completedAt = utc(new Date(Date.now() - job.hoursAgo * 3600_000 + job.seconds * 1000));
    await client.query(
      `INSERT INTO "JobRun" ("id","name","status","trigger","summary","metrics","error","startedAt","completedAt")
       VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8)`,
      [`demo-job-${++jobIndex}`, job.name, job.status, job.trigger, job.summary, job.error, startedAt, completedAt],
    );
  }

  // Generation provenance per draft (FK to Post, so this runs after the drafts)
  let genIndex = 0;
  for (const generation of GENERATIONS) {
    const createdAt = hoursAgo(generation.hoursAgo);
    await client.query(
      `INSERT INTO "ContentGeneration"
         ("id","postId","facebookPageId","promptVersion","model","mode","narrator","brief",
          "draftCaption","editorCaption","finalCaption","hashtags","humanScore","scoreDetails",
          "userAccepted","createdAt","updatedAt")
       VALUES ($1,$2,$3,'human-v1',$4,$5,'brand',$6,$7,$7,$7,NULL,$8,'[]',$9,$10,$10)`,
      [
        `demo-gen-${++genIndex}`, generation.postId, PAGE_ID,
        generation.model, generation.mode,
        "brief demo cho lịch sử nghiên cứu",
        "caption demo",
        generation.humanScore, generation.userAccepted, createdAt,
      ],
    );
  }

  // Image generations for the brand-asset counts (grouped by preset)
  let imgIndex = 0;
  for (const [preset, count] of IMAGE_PRESETS) {
    for (let i = 0; i < count; i++) {
      const createdAt = hoursAgo(24 + imgIndex + 1);
      await client.query(
        `INSERT INTO "ImageGeneration"
           ("id","facebookPageId","prompt","finalPrompt","imageUrl","scoreDetails","preset","format","createdAt","updatedAt")
         VALUES ($1,$2,$3,$3,$4,'[]',$5,'square',$6,$6)`,
        [
          `demo-img-${++imgIndex}`, PAGE_ID,
          `demo ${preset} ${i + 1}`,
          `/api/media/demo/${preset}-${i + 1}.jpg`,
          preset, createdAt,
        ],
      );
    }
  }

  await client.query("COMMIT");
  console.log(`Seeded creative demo data into ${dbName}: ${SIGNALS.length * 2} signals, ${RESEARCH_DRAFTS.length} drafts, ${imgIndex} images, ${memIndex} content-memory rows, ${jobIndex} job runs, ${genIndex} generations, 1 brand kit, 1 competitor memory`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
