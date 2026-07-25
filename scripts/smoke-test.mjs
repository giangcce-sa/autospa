const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;

async function check(name, path, expectedStatus, validate, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, redirect: "manual" });
  const body = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`${name}: expected HTTP ${expectedStatus}, received ${response.status}: ${body.slice(0, 200)}`);
  }

  if (validate && !validate(response, body)) {
    throw new Error(`${name}: response validation failed`);
  }

  console.log(`PASS ${name} (${response.status})`);
}

await check("liveness", "/api/health", 200, (_response, body) => JSON.parse(body).status === "ok");
await check("readiness", "/api/ready", 200, (_response, body) => JSON.parse(body).ready === true);
await check("login page", "/login", 200);
await check(
  "protected dashboard",
  "/",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2F") === true,
);
await check(
  "protected settings API",
  "/api/settings",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings") === true,
);
await check(
  "protected Automation Settings workspace",
  "/system/settings?view=automation&scope=account",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fsystem%2Fsettings") === true,
);
await check(
  "protected Automation Settings API",
  "/api/settings/automation",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fautomation") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhookMode: "manual" }),
  },
);
await check(
  "protected Connections Settings API",
  "/api/settings/connections",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fconnections") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaApiUrl: "https://spa.example.com" }),
  },
);
await check(
  "protected Channels Settings API",
  "/api/settings/channels",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fchannels") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zaloOaId: "oa-smoke" }),
  },
);
await check(
  "protected Provider Settings API",
  "/api/settings/providers",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fproviders") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openaiChatModel: "gpt-5" }),
  },
);
await check(
  "protected Image Settings API",
  "/api/settings/images",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fimages") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageModel: "dall-e-3" }),
  },
);
await check(
  "protected Ads Settings API",
  "/api/settings/ads",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fads") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adsOptimizePauseCtr: 0.5 }),
  },
);
await check(
  "protected Video Settings API",
  "/api/settings/video",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fvideo") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoMockMode: true }),
  },
);
await check(
  "protected Data Settings API",
  "/api/settings/data",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fsettings%2Fdata") === true,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftRetentionDays: 30 }),
  },
);
await check(
  "protected backup",
  "/api/backup",
  307,
  (response) => response.headers.get("location")?.includes("/login?from=%2Fapi%2Fbackup") === true,
);

const cronResponse = await fetch(`${baseUrl}/api/cron/weekly-report`, { redirect: "manual" });
const cronBody = await cronResponse.text();
const isLocalBaseUrl = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
if (cronResponse.status === 401 && cronBody.includes("Unauthorized")) {
  console.log("PASS cron authorization (401)");
} else if (isLocalBaseUrl && cronResponse.status === 200) {
  console.log("SKIP cron authorization (local dev allows localhost without CRON_SECRET)");
} else {
  throw new Error(`cron authorization: expected HTTP 401, received ${cronResponse.status}: ${cronBody.slice(0, 200)}`);
}

await check(
  "OAuth callback state protection",
  "/api/auth/google?code=smoke&state=smoke",
  307,
  (response) => response.headers.get("location")?.includes("reason=invalid_state") === true
    && response.headers.getSetCookie().some((cookie) => cookie.startsWith("autospa_google_oauth_state=") && cookie.includes("Max-Age=0")),
);

if (smokeEmail && smokePassword) {
  const cookies = new Map();
  const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  const absorbCookies = (response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";", 1);
      const separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  };
  const sessionFetch = async (path, init = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      redirect: "manual",
      headers: {
        ...init.headers,
        ...(cookies.size ? { Cookie: cookieHeader() } : {}),
      },
    });
    absorbCookies(response);
    return response;
  };

  const csrfResponse = await sessionFetch("/api/auth/csrf");
  const { csrfToken } = await csrfResponse.json();
  const credentials = new URLSearchParams({
    csrfToken,
    email: smokeEmail,
    password: smokePassword,
    redirect: "false",
    callbackUrl: `${baseUrl}/`,
  });
  const loginResponse = await sessionFetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: credentials,
  });
  if (loginResponse.status !== 302) {
    throw new Error(`authenticated login: expected HTTP 302, received ${loginResponse.status}`);
  }
  console.log("PASS authenticated login (302)");

  const sessionResponse = await sessionFetch("/api/auth/session");
  const session = await sessionResponse.json();
  if (sessionResponse.status !== 200 || session.user?.email !== smokeEmail) {
    throw new Error("authenticated session: user did not match");
  }
  console.log("PASS authenticated session (200)");

  const settingsResponse = await sessionFetch("/api/settings");
  const settings = await settingsResponse.json();
  const secretFields = [
    "claudeApiKey",
    "openaiApiKey",
    "zaloToken",
    "spaApiKey",
    "spaWebhookSecret",
    "telegramBotToken",
  ];
  const leaked = secretFields.filter((field) => {
    const value = settings.data?.[field];
    return typeof value === "string" && !value.startsWith("••");
  });
  if (settingsResponse.status !== 200 || settings.success !== true || leaked.length) {
    throw new Error(`authenticated settings: invalid response or unmasked fields: ${leaked.join(", ")}`);
  }
  console.log("PASS authenticated settings and secret masking (200)");
}

console.log(`Smoke checks passed for ${baseUrl}`);
