export const dashboardJs = `
/* ─── Utilities ─────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const PAGE_TITLES = {
  setup: "Bắt đầu",
  overview: "Overview",
  keys: "API Keys",
  policy: "Policy",
  models: "Models",
  logs: "Logs",
  console: "Console"
};

const STORAGE_KEY = "gatewayDashboardApiKey";

let logsPage = 1;
let selectedSetupTool = "claude-code";
let selectedSetupMode = "balanced";

const SETUP_TOOLS = {
  "claude-code": {
    title: "Claude Code",
    description: "Cấu hình biến môi trường rồi mở lại terminal.",
    task: "coding",
    instructions: ["Copy cấu hình bên dưới.", "Chạy lệnh trong terminal.", "Mở Claude Code và gửi một yêu cầu thử."]
  },
  cursor: {
    title: "Cursor",
    description: "Thêm OpenAI-compatible provider trong phần Models.",
    task: "coding",
    instructions: ["Mở Cursor Settings.", "Thêm Base URL và API key theo cấu hình.", "Chọn model được tạo và bắt đầu chat."]
  },
  n8n: {
    title: "n8n",
    description: "Dùng HTTP Request node với endpoint OpenAI-compatible.",
    task: "workflow",
    instructions: ["Tạo HTTP Request node.", "Dán URL, headers và body từ cấu hình.", "Nối trường prompt rồi chạy node."]
  },
  "ai-spa": {
    title: "AI Spa",
    description: "Cấu hình gateway cho chat và các tác vụ AI của hệ thống spa.",
    task: "spa-chat",
    instructions: ["Thêm các biến vào môi trường AI Spa.", "Khởi động lại ứng dụng.", "Gửi một yêu cầu chat thử."]
  }
};

function setupModel(tool, mode) {
  if (mode === "economy") return "cheap-chat";
  if (mode === "quality" && (tool === "claude-code" || tool === "cursor")) return "strong-code";
  return "auto";
}

function setupConfig(tool, mode) {
  const key = getStoredKey();
  const base = window.location.origin;
  const model = setupModel(tool, mode);
  if (tool === "claude-code") {
    return [
      'export ANTHROPIC_BASE_URL="' + base + '/v1"',
      'export ANTHROPIC_AUTH_TOKEN="' + key + '"',
      'export ANTHROPIC_MODEL="' + model + '"'
    ].join("\\n");
  }
  if (tool === "cursor") {
    return JSON.stringify({ baseUrl: base + "/v1", apiKey: key, model: model }, null, 2);
  }
  if (tool === "n8n") {
    return JSON.stringify({
      method: "POST",
      url: base + "/v1/chat/completions",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: { model: model, messages: [{ role: "user", content: "={{$json.prompt}}" }] }
    }, null, 2);
  }
  return [
    'AI_GATEWAY_URL="' + base + '"',
    'AI_GATEWAY_API_KEY="' + key + '"',
    'AI_GATEWAY_MODEL="' + model + '"',
    'AI_GATEWAY_TASK="spa-chat"'
  ].join("\\n");
}

function renderSetup() {
  const tool = SETUP_TOOLS[selectedSetupTool];
  if (!tool) return;
  setText("setupToolTitle", tool.title);
  setText("setupToolDescription", tool.description);
  setText("setupConfig", setupConfig(selectedSetupTool, selectedSetupMode));
  const list = $("setupInstructions");
  if (list) {
    list.innerHTML = "";
    tool.instructions.forEach(function(text) {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
  }
  $("setupStepConfig")?.classList.add("active");
  $("setupStepTest")?.classList.remove("active");
  if ($("diagnosticResults")) {
    $("diagnosticResults").innerHTML = '<div class="empty-state">Chưa chạy kiểm tra.</div>';
  }
}

async function runSetupDiagnostics() {
  const target = $("diagnosticResults");
  const button = $("runDiagnostics");
  if (!target || !button) return;
  button.disabled = true;
  button.textContent = "Đang kiểm tra...";
  target.innerHTML = '<div class="empty-state">Đang kiểm tra key, policy và routing...</div>';
  try {
    const result = await apiFetch(
      "/dashboard/api/my/diagnostics/" + selectedSetupTool + "?mode=" + selectedSetupMode
    );
    target.innerHTML = "";
    (result.data.checks || []).forEach(function(check) {
      const row = document.createElement("div");
      row.className = "diagnostic-item " + (check.ok ? "ok" : "bad");
      const status = document.createElement("span");
      status.className = "diagnostic-status";
      status.textContent = check.ok ? "OK" : "Lỗi";
      const copy = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = check.label;
      const detail = document.createElement("span");
      detail.textContent = check.detail;
      copy.append(strong, detail);
      row.append(status, copy);
      target.appendChild(row);
    });
    $("setupStepTest")?.classList.toggle("active", result.data.ready);
    toast(result.data.ready ? "Cấu hình sẵn sàng sử dụng" : "Cần xử lý lỗi cấu hình", result.data.ready ? "ok" : "warn");
  } catch (error) {
    target.innerHTML = '<div class="diagnostic-item bad"><span class="diagnostic-status">Lỗi</span><div><strong>Không thể kiểm tra</strong><span></span></div></div>';
    target.querySelector("span:last-child").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Chạy kiểm tra";
  }
}

function getStoredKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function storeKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

function clearKey() {
  localStorage.removeItem(STORAGE_KEY);
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v;
}

function json(v) {
  return JSON.stringify(v, null, 2);
}

/* ─── Toast ─────────────────────────────────────────────── */
function toast(msg, type = "ok", duration = 4000) {
  const container = $("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.setAttribute("role", "alert");
  const icon = type === "ok" ? "✓" : type === "error" ? "✕" : "⚠";
  el.textContent = icon + "  " + msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, duration);
}

/* ─── Fetch helpers ──────────────────────────────────────── */
async function fetchWithKey(url, key, options = {}) {
  const headers = {
    "x-api-key": key,
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(payload?.error?.message || res.statusText),
      { payload, status: res.status }
    );
  }
  return payload;
}

async function apiFetch(path, options = {}) {
  return fetchWithKey(path, getStoredKey(), options);
}

/* ─── Auth flow ──────────────────────────────────────────── */
function showAuth() {
  $("authScreen").classList.remove("hidden");
  $("appShell").classList.add("hidden");
}

function showApp() {
  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
}

async function verifyKey(key) {
  return fetchWithKey("/dashboard/api/me", key);
}

/* ─── SPA routing ────────────────────────────────────────── */
function navigate(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const target = $("page-" + pageId);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(a => {
    const active = a.dataset.page === pageId;
    a.classList.toggle("active", active);
    a.setAttribute("aria-current", active ? "page" : "false");
  });

  const title = PAGE_TITLES[pageId] || pageId;
  setText("pageTitle", title);
  document.title = title + " — AI Gateway Dashboard";
  history.replaceState(null, "", "#" + pageId);

  if (pageId === "models") loadModels();
  if (pageId === "setup") renderSetup();
}

/* ─── Spinner ────────────────────────────────────────────── */
function setRefreshing(loading) {
  $("refreshIcon")?.classList.toggle("hidden", loading);
  $("refreshSpinner")?.classList.toggle("hidden", !loading);
}

/* ─── Token budget ───────────────────────────────────────── */
function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function renderTokenBudget(data) {
  var budgetCard = $("budget-card");
  var dailyCard = $("daily-budget-card");
  if (!budgetCard) return;

  if (data.monthly_limit) {
    var pct = data.monthly_percent;
    $("budget-pct").textContent = pct + "%";
    var bar = $("budget-bar");
    bar.style.width = Math.min(pct, 100) + "%";
    bar.className = "budget-bar" + (pct >= 90 ? " danger" : pct >= 70 ? " warn" : "");
    $("budget-detail").textContent =
      formatTokens(data.monthly_used) + " / " + formatTokens(data.monthly_limit) + " tokens this month";
  } else {
    $("budget-pct").textContent = "Unlimited";
    $("budget-bar").style.width = "0%";
    $("budget-detail").textContent =
      formatTokens(data.monthly_used) + " tokens used this month (no limit set)";
  }

  if (dailyCard) {
    if (data.daily_request_limit) {
      dailyCard.style.display = "";
      var dpct = data.daily_percent;
      $("daily-pct").textContent = dpct + "%";
      var dbar = $("daily-bar");
      dbar.style.width = Math.min(dpct, 100) + "%";
      dbar.className = "budget-bar" + (dpct >= 90 ? " danger" : dpct >= 70 ? " warn" : "");
      $("daily-detail").textContent =
        data.daily_requests_used + " / " + data.daily_request_limit + " requests today";
    } else {
      dailyCard.style.display = "none";
    }
  }
}

/* ─── Models ─────────────────────────────────────────────── */
var modelsCache = null;

function loadModels() {
  if (modelsCache) { renderModels(modelsCache); return; }
  apiFetch("/dashboard/api/my/models")
    .then(function(json) {
      modelsCache = json.data || [];
      renderModels(modelsCache);
      populateConsoleModelSelect(modelsCache);
    })
    .catch(function() {
      var grid = $("models-grid");
      if (grid) grid.innerHTML = '<div class="empty-state">Failed to load models.</div>';
    });
}

function renderModels(models) {
  var grid = $("models-grid");
  if (!grid) return;
  if (!models.length) {
    grid.innerHTML = '<div class="empty-state">No models available for your policy.</div>';
    return;
  }
  grid.innerHTML = "";
  models.forEach(function(m) {
    var card = document.createElement("div");
    card.className = "model-card";
    var tasks = m.allowed_task_types ? m.allowed_task_types.join(", ") : "all task types";
    card.innerHTML =
      '<div class="model-name">' + m.id + "</div>" +
      '<div class="model-provider">' + m.provider + "</div>" +
      '<div class="model-tasks">' + tasks + "</div>" +
      '<button class="btn-sm use-model-btn" data-model="' + m.id + '">Use in Console</button>';
    grid.appendChild(card);
  });
  grid.querySelectorAll(".use-model-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var modelId = btn.getAttribute("data-model");
      localStorage.setItem("gw-preferred-model", modelId);
      navigate("console");
      var sel = $("consoleModel");
      if (sel) sel.value = modelId;
    });
  });
}

function populateConsoleModelSelect(models) {
  var sel = $("consoleModel");
  if (!sel) return;
  var preferred = localStorage.getItem("gw-preferred-model") || "auto";
  sel.innerHTML = models.map(function(m) {
    return '<option value="' + m.id + '"' + (m.id === preferred ? " selected" : "") + ">" + m.id + "</option>";
  }).join("");
  if (sel.value !== preferred) sel.value = "auto";
  // Sync compare selects if they exist
  if (typeof syncCompareModels === "function") syncCompareModels();
}

/* ─── Rate limit widget ──────────────────────────────────── */
function renderRateLimit(data) {
  var pct = data.limit > 0 ? Math.round((data.current / data.limit) * 100) : 0;
  var cur = document.getElementById("rl-current");
  var sub = document.getElementById("rl-sub");
  var bar = document.getElementById("rl-bar");
  var reset = document.getElementById("rl-reset");
  if (cur) cur.textContent = data.current + " / " + data.limit;
  if (sub) sub.textContent = "requests this minute";
  if (bar) {
    bar.style.width = Math.min(pct, 100) + "%";
    bar.className = "rl-bar" + (pct >= 90 ? " danger" : pct >= 70 ? " warn" : "");
  }
  if (reset) {
    var resetsAt = new Date(data.resets_at);
    var secondsLeft = Math.max(0, Math.round((resetsAt.getTime() - Date.now()) / 1000));
    reset.textContent = "Resets in " + secondsLeft + "s";
  }
}

async function refreshRateLimit() {
  try {
    var res = await apiFetch("/dashboard/api/my/rate-limit");
    if (res && res.data) renderRateLimit(res.data);
  } catch (e) {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  setInterval(function () {
    refreshRateLimit();
  }, 30000);
}

/* ─── Load & render all dashboard data ───────────────────── */
async function loadDashboard() {
  setRefreshing(true);
  try {
    const [meRes, keysRes, usageRes, logsRes, budgetRes] = await Promise.all([
      apiFetch("/dashboard/api/me"),
      apiFetch("/dashboard/api/my/keys"),
      apiFetch("/dashboard/api/my/usage"),
      apiFetch("/dashboard/api/my/audit-logs?page=" + logsPage + "&limit=50"),
      apiFetch("/dashboard/api/my/token-budget")
    ]);

    renderOverview(meRes, usageRes, logsRes);
    renderKeys(keysRes);
    renderPolicy(meRes);
    renderLogs(logsRes);
    if (budgetRes && budgetRes.data) renderTokenBudget(budgetRes.data);
    refreshRateLimit();
    modelsCache = null;
    loadModels();
    setText("lastUpdated", "Updated " + new Date().toLocaleTimeString());
  } catch (e) {
    toast("Failed to load data: " + e.message, "error");
  } finally {
    setRefreshing(false);
  }
}

function renderOverview(me, usage, logs) {
  const { user, client, policy, apiKey } = me;

  // Update user chip
  const initial = (user.name || user.email || "?")[0].toUpperCase();
  setText("userAvatar", initial);
  setText("userName", user.name || user.email);
  setText("userRole", user.role);

  // Stat cards
  setText("keyStatus", apiKey.status);
  setText("keyPrefix", apiKey.key_prefix || "—");
  setText("rateLimit", policy.rateLimitPerMinute ?? "—");
  setText("clientName", client.name);
  setText("clientType", client.type);

  // Today's requests
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = (usage.data || []).filter(u => u.date === today);
  const todayReqs = todayRows.reduce((s, u) => s + (u.request_count || 0), 0);
  const todayTok = todayRows.reduce((s, u) => s + (u.input_tokens || 0) + (u.output_tokens || 0), 0);
  setText("todayRequests", String(todayReqs));
  setText("todayTokens", todayTok.toLocaleString() + " tokens used today");

  // Usage bar chart (last 30 days)
  const usageByDay = {};
  (usage.data || []).forEach(u => {
    usageByDay[u.date] = (usageByDay[u.date] || 0) + (u.request_count || 0);
  });
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ date: d, count: usageByDay[d] || 0 });
  }
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const chart = $("usageChart");
  if (chart) {
    if (days.every(d => d.count === 0)) {
      chart.innerHTML = '<div class="empty-state">No usage in the last 30 days.</div>';
    } else {
      chart.innerHTML = days.map(d => {
        const pct = Math.max((d.count / maxCount) * 100, 2);
        const label = d.date + ": " + d.count + " req";
        return \`<div class="usage-bar" style="height:\${pct}%" data-tip="\${label}" title="\${label}" aria-label="\${label}"></div>\`;
      }).join("");
    }
  }

  // Recent activity (last 5)
  const recent = (logs.data || []).slice(0, 5);
  $("recentRows").innerHTML = recent.length
    ? recent.map(row => \`<tr>
        <td class="muted">\${new Date(row.created_at).toLocaleString()}</td>
        <td>\${row.model || "-"}</td>
        <td>\${row.provider || "-"}</td>
        <td>\${row.status === "ok" ? '<span class="pill ok">ok</span>' : '<span class="pill bad">error</span>'}</td>
        <td class="muted">\${row.latency_ms ? row.latency_ms + "ms" : "-"}</td>
        <td class="muted">\${((row.input_tokens || 0) + (row.output_tokens || 0)).toLocaleString()}</td>
      </tr>\`).join("")
    : '<tr><td colspan="6" class="empty-td">No recent activity</td></tr>';
}

function renderKeys(keysRes) {
  const keys = keysRes.data || [];
  $("keysRows").innerHTML = keys.length
    ? keys.map(k => \`<tr>
        <td>\${k.name}</td>
        <td><code>\${k.key_prefix}</code></td>
        <td>\${k.key_prefix?.startsWith("gw_test") ? "test" : "live"}</td>
        <td>\${k.status === "active" ? '<span class="pill ok">active</span>' : '<span class="pill bad">revoked</span>'}</td>
        <td class="muted">\${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</td>
        <td class="muted">\${new Date(k.created_at).toLocaleDateString()}</td>
      </tr>\`).join("")
    : '<tr><td colspan="6" class="empty-td">No keys found</td></tr>';
}

function renderPolicy(me) {
  const { policy } = me;
  const grid = $("policyGrid");
  if (!grid) return;

  const items = [
    { label: "Rate limit", value: policy.rateLimitPerMinute + " req/min" },
    { label: "Daily request limit", value: policy.dailyRequestLimit ? policy.dailyRequestLimit.toLocaleString() : "Unlimited" },
    { label: "Monthly token limit", value: policy.monthlyTokenLimit ? policy.monthlyTokenLimit.toLocaleString() : "Unlimited" },
    { label: "Max input chars", value: policy.maxInputCharacters ? policy.maxInputCharacters.toLocaleString() : "—" },
    { label: "Allow tools", value: policy.allowTools ? "Yes" : "No" },
    { label: "Log prompts", value: policy.logPrompts ? "Yes" : "No" }
  ];

  const tags = (arr) => arr.map(t => \`<span class="tag">\${t}</span>\`).join("");

  grid.innerHTML = \`
    \${items.map(i => \`
      <div class="policy-item">
        <span class="label">\${i.label}</span>
        <span class="policy-value">\${i.value}</span>
      </div>\`).join("")}
    <div class="policy-item" style="grid-column:1/-1">
      <span class="label">Allowed models</span>
      <div class="policy-tags">\${tags(policy.allowedModels || [])}</div>
    </div>
    <div class="policy-item" style="grid-column:1/-1">
      <span class="label">Allowed task types</span>
      <div class="policy-tags">\${tags(policy.allowedTaskTypes || [])}</div>
    </div>
  \`;
}

function renderLogs(logsRes) {
  const logs = logsRes.data || [];
  const pages = logsRes.pages || 1;
  const page = logsRes.page || 1;
  const total = logsRes.total || logs.length;
  setText("logsPageInfo", "Page " + page + " of " + pages + " (" + total + " total)");
  const prev = $("logsPrevBtn");
  const next = $("logsNextBtn");
  if (prev) prev.disabled = page <= 1;
  if (next) next.disabled = page >= pages;
  $("logsRows").innerHTML = logs.length
    ? logs.map(row => \`<tr>
        <td class="muted">\${new Date(row.created_at).toLocaleString()}</td>
        <td>\${row.model || "-"}</td>
        <td>\${row.provider || "-"}</td>
        <td>\${row.status === "ok" ? '<span class="pill ok">ok</span>' : '<span class="pill bad">error</span>'}</td>
        <td class="muted">\${row.latency_ms ? row.latency_ms + "ms" : "-"}</td>
        <td class="muted">\${(row.input_tokens || 0).toLocaleString()}</td>
        <td class="muted">\${(row.output_tokens || 0).toLocaleString()}</td>
      </tr>\`).join("")
    : '<tr><td colspan="7" class="empty-td">No logs found</td></tr>';
}

/* ─── Chat Console helpers ───────────────────────────────── */
var conversations = [];
var activeTabIdx = 0;
var chatHistory = [];

var CONVS_KEY = "gw-chat-convs";

/* 1. Markdown renderer */
function renderMarkdown(raw) {
  if (!raw) return "";
  // Extract fenced code blocks as placeholders
  var codeBlocks = [];
  var s = raw.replace(/\`\`\`(\\w*)\\n?([\\s\\S]*?)\`\`\`/gm, function(_, lang, code) {
    var idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || "", code: code });
    return "%%CODEBLOCK" + idx + "%%";
  });
  // Escape HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Headers
  s = s.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h2>$1</h2>");
  // Bold & italic
  s = s.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
  s = s.replace(/\\*(.+?)\\*/g, "<em>$1</em>");
  // Inline code
  s = s.replace(/\`([^\`]+)\`/g, "<code>$1</code>");
  // Bullet lists
  s = s.replace(/((?:^[ \\t]*- .+\\n?)+)/gm, function(block) {
    var items = block.trim().split("\\n").map(function(ln) {
      return "<li>" + ln.replace(/^[ \\t]*- /, "") + "</li>";
    });
    return "<ul>" + items.join("") + "</ul>";
  });
  // Numbered lists
  s = s.replace(/((?:^[ \\t]*\\d+\\. .+\\n?)+)/gm, function(block) {
    var items = block.trim().split("\\n").map(function(ln) {
      return "<li>" + ln.replace(/^[ \\t]*\\d+\\. /, "") + "</li>";
    });
    return "<ol>" + items.join("") + "</ol>";
  });
  // Paragraphs (double newline)
  s = s.replace(/\\n{2,}/g, "</p><p>");
  s = "<p>" + s + "</p>";
  // Single line breaks
  s = s.replace(/([^>])\\n([^<])/g, "$1<br>$2");
  // Restore code blocks with syntax highlighting
  s = s.replace(/%%CODEBLOCK(\\d+)%%/g, function(_, i) {
    var block = codeBlocks[parseInt(i, 10)];
    var code = block.code;
    var lang = block.lang;
    // Unescape HTML (we re-escape or highlight.js handles it)
    code = code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    var highlighted;
    try {
      if (lang && window.hljs && window.hljs.getLanguage(lang)) {
        highlighted = window.hljs.highlight(code, { language: lang }).value;
      } else if (window.hljs) {
        highlighted = window.hljs.highlightAuto(code).value;
      } else {
        highlighted = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
    } catch(e) {
      highlighted = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    var langLabel = lang ? '<span class="code-lang">' + lang + '</span>' : '';
    return '<pre class="hljs-pre">' + langLabel + '<code class="hljs">' + highlighted + '</code></pre>';
  });
  // Clean up empty paragraphs around block elements
  s = s.replace(/<p>\\s*(<(?:ul|ol|pre|h[2-4])[^>]*>)/g, "$1");
  s = s.replace(/(<\\/(?:ul|ol|pre|h[2-4])>)\\s*<\\/p>/g, "$1");
  s = s.replace(/<p>\\s*<\\/p>/g, "");
  return s;
}

/* 2. Conversation management */
function createConversation(name) {
  return { id: Date.now() + Math.random(), name: name, history: [], systemPrompt: "" };
}

function saveConvs() {
  try {
    conversations[activeTabIdx].history = chatHistory.slice();
    localStorage.setItem(CONVS_KEY, JSON.stringify({ conversations: conversations, activeTabIdx: activeTabIdx }));
  } catch (_) { /* ignore quota */ }
}

function loadConvs() {
  try {
    var raw = localStorage.getItem(CONVS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.conversations) && parsed.conversations.length) {
        conversations = parsed.conversations;
        activeTabIdx = parsed.activeTabIdx || 0;
        if (activeTabIdx >= conversations.length) activeTabIdx = 0;
        chatHistory = conversations[activeTabIdx].history.slice();
        return;
      }
    }
  } catch (_) { /* ignore */ }
  conversations = [createConversation("Chat 1")];
  activeTabIdx = 0;
  chatHistory = [];
}

function renderTabs() {
  var tabsEl = document.getElementById("chatTabs");
  if (!tabsEl) return;
  // Remove existing tab elements (keep the + button)
  var newTabBtn = document.getElementById("chatNewTab");
  tabsEl.innerHTML = "";
  conversations.forEach(function(conv, idx) {
    var tab = document.createElement("button");
    tab.className = "chat-tab" + (idx === activeTabIdx ? " active" : "");
    tab.type = "button";
    tab.title = conv.name;
    var nameSpan = document.createElement("span");
    nameSpan.textContent = conv.name;
    tab.appendChild(nameSpan);
    if (conversations.length > 1) {
      var closeBtn = document.createElement("button");
      closeBtn.className = "chat-tab-close";
      closeBtn.type = "button";
      closeBtn.title = "Close tab";
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        closeTab(idx);
      });
      tab.appendChild(closeBtn);
    }
    tab.addEventListener("click", function() { switchTab(idx); });
    tabsEl.appendChild(tab);
  });
  if (newTabBtn) tabsEl.appendChild(newTabBtn);
}

function switchTab(idx) {
  conversations[activeTabIdx].history = chatHistory.slice();
  var sysEl = document.getElementById("systemPromptInput");
  if (sysEl) conversations[activeTabIdx].systemPrompt = sysEl.value;
  activeTabIdx = idx;
  chatHistory = conversations[activeTabIdx].history.slice();
  if (sysEl) sysEl.value = conversations[activeTabIdx].systemPrompt || "";
  renderTabs();
  renderTabMessages(conversations[activeTabIdx]);
  saveConvs();
}

function newTab() {
  conversations[activeTabIdx].history = chatHistory.slice();
  var sysEl = document.getElementById("systemPromptInput");
  if (sysEl) conversations[activeTabIdx].systemPrompt = sysEl.value;
  var newConv = createConversation("Chat " + (conversations.length + 1));
  conversations.push(newConv);
  activeTabIdx = conversations.length - 1;
  chatHistory = [];
  if (sysEl) sysEl.value = "";
  renderTabs();
  renderTabMessages(newConv);
  saveConvs();
}

function closeTab(idx) {
  if (conversations.length <= 1) return;
  conversations.splice(idx, 1);
  if (activeTabIdx >= conversations.length) activeTabIdx = conversations.length - 1;
  else if (activeTabIdx > idx) activeTabIdx -= 1;
  chatHistory = conversations[activeTabIdx].history.slice();
  var sysEl = document.getElementById("systemPromptInput");
  if (sysEl) sysEl.value = conversations[activeTabIdx].systemPrompt || "";
  renderTabs();
  renderTabMessages(conversations[activeTabIdx]);
  saveConvs();
}

function renderTabMessages(conv) {
  var msgs = document.getElementById("chatMessages");
  if (!msgs) return;
  var welcome = '<div class="chat-welcome" id="chatWelcome"><div class="chat-welcome-icon">✦</div><p class="chat-welcome-title">AI Gateway Console</p><p class="chat-welcome-sub">Select a model and send a message to test the gateway.</p></div>';
  if (!conv.history || !conv.history.length) {
    msgs.innerHTML = welcome;
    return;
  }
  msgs.innerHTML = "";
  conv.history.forEach(function(msg) {
    appendChatMessage(msg.role, msg.content, true);
  });
  msgs.scrollTop = msgs.scrollHeight;
}

/* 10. Export chat */
function exportChat() {
  var conv = conversations[activeTabIdx];
  if (!conv || !conv.history || !conv.history.length) {
    toast("No messages to export", "warn");
    return;
  }
  var lines = ["# " + conv.name, ""];
  conv.history.forEach(function(msg) {
    if (msg.role === "user") {
      lines.push("**You:** " + msg.content);
    } else {
      lines.push("**AI:** " + msg.content);
    }
    lines.push("");
  });
  var blob = new Blob([lines.join("\\n")], { type: "text/markdown" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = conv.name.replace(/\\s+/g, "-").toLowerCase() + ".md";
  a.click();
  URL.revokeObjectURL(url);
}

/* Cost estimator (feature #13) */
var MODEL_PRICING = {
  "claude-sonnet": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 5.0, output: 15.0 },
  "cheap-chat": { input: 0.2, output: 0.8 },
  "strong-code": { input: 2.0, output: 10.0 },
  "spa-assistant": { input: 0.5, output: 1.5 },
};
function estimateCost(modelId, inputTokens, outputTokens) {
  var pricing = MODEL_PRICING[modelId] || MODEL_PRICING["cheap-chat"];
  var cost = (inputTokens / 1e6) * pricing.input + (outputTokens / 1e6) * pricing.output;
  return cost < 0.001 ? '< $0.001' : '$' + cost.toFixed(4);
}

/* Updated appendChatMessage (features 1, 2, 5) */
function appendChatMessage(role, content, fromHistory) {
  var welcome = document.getElementById("chatWelcome");
  if (welcome) welcome.style.display = "none";
  var msgs = document.getElementById("chatMessages");
  if (!msgs) return null;
  var wrapper = document.createElement("div");
  wrapper.className = "chat-msg " + role;
  var label = document.createElement("div");
  label.className = "chat-msg-label";
  label.textContent = role === "user" ? "You" : "AI";
  var bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }
  wrapper.appendChild(label);
  wrapper.appendChild(bubble);

  // Message actions row
  var actions = document.createElement("div");
  actions.className = "chat-msg-actions";

  // Copy button
  var copyBtn = document.createElement("button");
  copyBtn.className = "chat-action-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "⎘ Copy";
  copyBtn.addEventListener("click", function() {
    navigator.clipboard.writeText(content).then(function() {
      copyBtn.textContent = "✓ Copied";
      setTimeout(function() { copyBtn.textContent = "⎘ Copy"; }, 2000);
    }).catch(function() {
      toast("Copy failed", "warn");
    });
  });
  actions.appendChild(copyBtn);

  // Retry + Regenerate buttons (assistant only, not from history restore)
  if (role === "assistant" && !fromHistory) {
    var retryBtn = document.createElement("button");
    retryBtn.className = "chat-action-btn";
    retryBtn.type = "button";
    retryBtn.textContent = "↺ Retry";
    retryBtn.title = "Resend same message";
    retryBtn.addEventListener("click", function() {
      if (chatHistory.length < 2) return;
      var userMsg = chatHistory[chatHistory.length - 2].content;
      chatHistory.splice(chatHistory.length - 2, 2);
      var allMsgs = msgs.querySelectorAll(".chat-msg");
      var toRemove = Array.from(allMsgs).slice(-2);
      toRemove.forEach(function(el) { el.remove(); });
      var textarea = document.getElementById("consolePrompt");
      if (textarea) textarea.value = userMsg;
      var form = document.getElementById("consoleChatForm");
      if (form) form.requestSubmit();
    });
    actions.appendChild(retryBtn);

    // Regenerate: keep user turn, just replace AI response
    var regenBtn = document.createElement("button");
    regenBtn.className = "chat-action-btn";
    regenBtn.type = "button";
    regenBtn.textContent = "⟳ Regenerate";
    regenBtn.title = "Get a different response";
    regenBtn.addEventListener("click", async function() {
      if (chatHistory.length < 2) return;
      // Remove last assistant message from history and DOM
      chatHistory.pop();
      wrapper.remove();
      // Send again without the user message in textarea
      var key = getStoredKey();
      if (!key) { toast("No API key stored", "warn"); return; }
      var model = document.getElementById("consoleModel")?.value || "auto";
      var task = document.getElementById("consoleTask")?.value || "chat";
      var useStream = document.getElementById("consoleStream")?.checked === true;
      var systemPromptVal = (document.getElementById("systemPromptInput")?.value || "").trim();
      function buildMsgs() {
        var m = chatHistory.slice();
        if (systemPromptVal) m = [{ role: "system", content: systemPromptVal }].concat(m);
        return m;
      }
      var newWrapper = appendChatMessage("assistant", "", false);
      if (newWrapper) newWrapper.classList.add("streaming");
      setText("consoleStatus", "Regenerating…");
      if (useStream) {
        try {
          var res = await fetch("/v1/chat", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": key },
            body: JSON.stringify({ model: model, task_type: task, stream: true, messages: buildMsgs(), temperature: getTemperature(), max_tokens: getMaxTokens() })
          });
          if (!res.ok || !res.body) { setText("consoleStatus", "Failed"); return; }
          var reader2 = res.body.getReader();
          var decoder2 = new TextDecoder();
          var acc2 = "";
          while (true) {
            var ch = await reader2.read();
            if (ch.done) break;
            var lines2 = decoder2.decode(ch.value, { stream: true }).split("\\n");
            for (var ln2 of lines2) {
              if (!ln2.startsWith("data: ")) continue;
              var d2 = ln2.slice(6).trim();
              if (d2 === "[DONE]") break;
              try {
                var j2 = JSON.parse(d2);
                var delta2 = j2.choices && j2.choices[0] && j2.choices[0].delta && j2.choices[0].delta.content;
                if (delta2) { acc2 += delta2; if (newWrapper) setStreamingText(newWrapper, acc2); }
              } catch(e2) {}
            }
          }
          if (newWrapper) { newWrapper.classList.remove("streaming"); var nb = newWrapper.querySelector(".chat-bubble"); if (nb) nb.innerHTML = renderMarkdown(acc2); }
          chatHistory.push({ role: "assistant", content: acc2 });
          conversations[activeTabIdx].history = chatHistory.slice();
          saveConvs();
          setText("consoleStatus", "Done");
        } catch(err2) {
          if (newWrapper) newWrapper.classList.remove("streaming");
          setText("consoleStatus", "Failed");
        }
      } else {
        try {
          var p2 = await fetchWithKey("/v1/chat", key, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: model, task_type: task, messages: buildMsgs(), temperature: getTemperature(), max_tokens: getMaxTokens() }) });
          var content2 = (p2 && p2.choices && p2.choices[0] && p2.choices[0].message && p2.choices[0].message.content) ? p2.choices[0].message.content : JSON.stringify(p2, null, 2);
          if (newWrapper) { newWrapper.classList.remove("streaming"); var nb2 = newWrapper.querySelector(".chat-bubble"); if (nb2) nb2.innerHTML = renderMarkdown(content2); }
          chatHistory.push({ role: "assistant", content: content2 });
          conversations[activeTabIdx].history = chatHistory.slice();
          saveConvs();
          setText("consoleStatus", "Done");
        } catch(err3) {
          if (newWrapper) newWrapper.classList.remove("streaming");
          setText("consoleStatus", "Failed");
        }
      }
    });
    actions.appendChild(regenBtn);

    // Cost estimate
    var costEl = document.createElement("span");
    costEl.className = "chat-cost-label";
    var histText = chatHistory.map(function(m) { return m.content || ''; }).join(' ');
    var inTok = Math.ceil((histText || '').length / 4);
    var outTok = Math.ceil((content || '').length / 4);
    var modelId = $("consoleModel")?.value || "cheap-chat";
    costEl.textContent = estimateCost(modelId, inTok, outTok);
    costEl.title = '~' + inTok + ' in / ~' + outTok + ' out tokens';
    actions.appendChild(costEl);

    // Webhook button — send this specific response
    var whBtn = document.createElement("button");
    whBtn.className = "chat-action-btn";
    whBtn.type = "button";
    whBtn.textContent = "🔗 Send";
    whBtn.title = "Send to webhook";
    whBtn.addEventListener("click", function() {
      var wUrl = $("webhookUrl")?.value?.trim();
      if (!wUrl) { toast("Set a webhook URL first (🔗 Webhook button)", "warn"); return; }
      var prevUser = chatHistory.length >= 2 ? chatHistory[chatHistory.length - 2].content : "";
      fireWebhook({ prompt: prevUser, response: content, model: $("consoleModel")?.value, ts: new Date().toISOString() });
    });
    actions.appendChild(whBtn);
  }

  wrapper.appendChild(actions);
  msgs.appendChild(wrapper);
  if (!fromHistory) msgs.scrollTop = msgs.scrollHeight;
  return wrapper;
}

function setStreamingText(wrapper, text) {
  var bubble = wrapper && wrapper.querySelector(".chat-bubble");
  if (bubble) bubble.textContent = text || "";
  var msgs = document.getElementById("chatMessages");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

/* ─── Prompt Library ─────────────────────────────────────── */
var PL_KEY = 'gw-prompt-lib';
var PL_DEFAULT = [
  /* ── General ── */
  { title: 'Tóm tắt văn bản', content: 'Tóm tắt nội dung sau đây một cách ngắn gọn, súc tích:\\n\\n', category: 'General' },
  { title: 'Dịch sang tiếng Anh', content: 'Dịch đoạn văn bản sau sang tiếng Anh tự nhiên:\\n\\n', category: 'General' },
  { title: 'Dịch sang tiếng Việt', content: 'Dịch đoạn văn bản sau sang tiếng Việt tự nhiên:\\n\\n', category: 'General' },
  { title: 'Giải thích đơn giản', content: 'Giải thích khái niệm sau một cách đơn giản, dễ hiểu, dùng ví dụ cụ thể:\\n\\n', category: 'General' },
  /* ── Spa ── */
  { title: 'Mô tả dịch vụ', content: 'Viết mô tả hấp dẫn cho dịch vụ spa sau. Nhấn mạnh lợi ích sức khỏe, cảm giác thư giãn, và điểm khác biệt. Tone: sang trọng, ấm áp, chuyên nghiệp.\\n\\nDịch vụ: ', category: 'Spa' },
  { title: 'Giới thiệu gói ưu đãi', content: 'Viết nội dung quảng cáo cho gói dịch vụ spa ưu đãi sau. Bao gồm: điểm nổi bật, giá trị khách hàng nhận được, lời kêu gọi hành động.\\n\\nGói: ', category: 'Spa' },
  { title: 'Phản hồi đánh giá 5 sao', content: 'Viết phản hồi chân thành, cảm ơn khách hàng cho đánh giá 5 sao sau. Tone: cảm ơn chân thành, mời quay lại.\\n\\nĐánh giá: ', category: 'Spa' },
  { title: 'Phản hồi đánh giá tiêu cực', content: 'Viết phản hồi chuyên nghiệp, đồng cảm cho đánh giá tiêu cực sau. Tone: xin lỗi chân thành, cam kết cải thiện, mời liên hệ trực tiếp.\\n\\nĐánh giá: ', category: 'Spa' },
  { title: 'Nhắc lịch hẹn', content: 'Soạn tin nhắn nhắc lịch hẹn spa ngắn gọn, thân thiện. Thông tin:\\n- Tên khách: \\n- Dịch vụ: \\n- Ngày giờ: \\n- Nhân viên: ', category: 'Spa' },
  { title: 'Xác nhận đặt lịch', content: 'Soạn tin nhắn xác nhận đặt lịch spa chuyên nghiệp. Thông tin:\\n- Tên khách: \\n- Dịch vụ: \\n- Ngày giờ: \\n- Địa chỉ: ', category: 'Spa' },
  { title: 'Chăm sóc sau liệu trình', content: 'Viết hướng dẫn chăm sóc sau liệu trình cho khách hàng vừa sử dụng dịch vụ:\\n\\nDịch vụ: ', category: 'Spa' },
  { title: 'Script tư vấn khách hàng', content: 'Viết script tư vấn qua điện thoại cho dịch vụ spa sau. Bao gồm: chào hỏi, giới thiệu, hỏi nhu cầu, đề xuất, chốt lịch.\\n\\nDịch vụ cần tư vấn: ', category: 'Spa' },
  { title: 'Caption mạng xã hội', content: 'Viết caption hấp dẫn cho bài đăng mạng xã hội về dịch vụ spa sau. Bao gồm hashtag phù hợp. Tone: gần gũi, truyền cảm hứng.\\n\\nChủ đề: ', category: 'Spa' },
  { title: 'Nội dung blog spa', content: 'Viết bài blog SEO về chủ đề spa sau. Bao gồm: mở đầu hấp dẫn, nội dung hữu ích, kết luận và CTA.\\n\\nChủ đề: ', category: 'Spa' },
  /* ── Email ── */
  { title: 'Email chăm sóc khách hàng', content: 'Soạn email chăm sóc khách hàng chuyên nghiệp, thân thiện. Chủ đề:\\n\\n', category: 'Email' },
  { title: 'Email giới thiệu dịch vụ mới', content: 'Soạn email giới thiệu dịch vụ mới đến danh sách khách hàng VIP. Tone: độc quyền, trân trọng.\\n\\nDịch vụ mới: ', category: 'Email' },
  { title: 'Email khuyến mãi', content: 'Soạn email khuyến mãi hấp dẫn cho chương trình:\\n\\n', category: 'Email' },
  { title: 'Email tái kích hoạt', content: 'Soạn email gửi lại cho khách hàng chưa quay lại trong 3 tháng. Tone: nhớ đến, quan tâm, ưu đãi đặc biệt.\\n\\n', category: 'Email' },
  /* ── Code ── */
  { title: 'Review code', content: 'Review đoạn code sau và chỉ ra: bugs, vấn đề bảo mật, hiệu năng, đề xuất cải thiện:\\n\\n\`\`\`\\n\\n\`\`\`', category: 'Code' },
  { title: 'Giải thích code', content: 'Giải thích đoạn code sau một cách đơn giản, dễ hiểu:\\n\\n\`\`\`\\n\\n\`\`\`', category: 'Code' },
  { title: 'Viết unit test', content: 'Viết unit test đầy đủ cho hàm sau:\\n\\n\`\`\`\\n\\n\`\`\`', category: 'Code' },
  { title: 'Tối ưu SQL', content: 'Phân tích và tối ưu câu SQL sau:\\n\\n\`\`\`sql\\n\\n\`\`\`', category: 'Code' },
];

function loadPromptLib() {
  try {
    var saved = JSON.parse(localStorage.getItem(PL_KEY) || 'null');
    if (saved && Array.isArray(saved) && saved.length) return saved;
  } catch (e) {}
  var defaults = PL_DEFAULT.map(function(p) {
    return { id: Date.now() + Math.random(), title: p.title, content: p.content, category: p.category, createdAt: Date.now() };
  });
  localStorage.setItem(PL_KEY, JSON.stringify(defaults));
  return defaults;
}

function savePromptLib(prompts) {
  localStorage.setItem(PL_KEY, JSON.stringify(prompts));
}

function renderPromptLib(filter) {
  var list = document.getElementById('promptLibList');
  if (!list) return;
  var prompts = loadPromptLib();
  var q = (filter || '').toLowerCase().trim();
  if (q) prompts = prompts.filter(function(p) {
    return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
  });
  if (!prompts.length) {
    list.innerHTML = '<div class="prompt-lib-empty">No prompts found.</div>';
    return;
  }
  // Group by category
  var groups = {};
  prompts.forEach(function(p) {
    var cat = p.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  var html = '';
  Object.keys(groups).forEach(function(cat) {
    html += '<div class="prompt-lib-group-label">' + cat + '</div>';
    groups[cat].forEach(function(p) {
      html += '<div class="prompt-lib-item" data-id="' + p.id + '">' +
        '<span class="prompt-lib-item-title" title="' + p.content.replace(/"/g, '&quot;').substring(0, 100) + '">' + p.title + '</span>' +
        '<button class="prompt-lib-use-btn" data-id="' + p.id + '">Use</button>' +
        '<button class="prompt-lib-del-btn" data-id="' + p.id + '" title="Delete">🗑</button>' +
        '</div>';
    });
  });
  list.innerHTML = html;
  // Bind events
  list.querySelectorAll('.prompt-lib-use-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      var all = loadPromptLib();
      var prompt = all.find(function(p) { return String(p.id) === id; });
      if (!prompt) return;
      var ta = document.getElementById('consolePrompt');
      if (ta) { ta.value = prompt.content; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; ta.focus(); }
      closePromptLib();
    });
  });
  list.querySelectorAll('.prompt-lib-del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      var all = loadPromptLib().filter(function(p) { return String(p.id) !== id; });
      savePromptLib(all);
      var searchEl = document.getElementById('promptLibSearch');
      renderPromptLib(searchEl ? searchEl.value : '');
    });
  });
  list.querySelectorAll('.prompt-lib-item-title').forEach(function(el) {
    el.addEventListener('click', function() {
      var item = el.closest('.prompt-lib-item');
      var id = item ? item.getAttribute('data-id') : null;
      var all = loadPromptLib();
      var prompt = all.find(function(p) { return String(p.id) === id; });
      if (!prompt) return;
      var ta = document.getElementById('consolePrompt');
      if (ta) { ta.value = prompt.content; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; ta.focus(); }
      closePromptLib();
    });
  });
}

function openPromptLib() {
  var overlay = document.getElementById('promptLibOverlay');
  var drawer = document.getElementById('promptLibDrawer');
  if (overlay) overlay.classList.remove('hidden');
  if (drawer) drawer.classList.remove('hidden');
  renderPromptLib('');
  var search = document.getElementById('promptLibSearch');
  if (search) { search.value = ''; search.focus(); }
}

function closePromptLib() {
  var overlay = document.getElementById('promptLibOverlay');
  var drawer = document.getElementById('promptLibDrawer');
  if (overlay) overlay.classList.add('hidden');
  if (drawer) drawer.classList.add('hidden');
}

/* ─── Boot ───────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  // Load conversations from localStorage
  loadConvs();
  renderTabs();

  // Check stored key
  const stored = getStoredKey();
  if (stored) {
    verifyKey(stored)
      .then(() => {
        showApp();
        routeFromHash();
        loadDashboard();
        // Restore conversation messages after auth
        renderTabMessages(conversations[activeTabIdx]);
        // Restore system prompt
        var sysEl = document.getElementById("systemPromptInput");
        if (sysEl) sysEl.value = conversations[activeTabIdx].systemPrompt || "";
      })
      .catch(() => {
        clearKey();
        showAuth();
      });
  } else {
    showAuth();
  }

  // Auth form submit
  $("authForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const key = ($("authKeyInput")?.value || "").trim();
    if (!key) return;

    const errEl = $("authError");
    if (errEl) errEl.classList.add("hidden");

    try {
      await verifyKey(key);
      storeKey(key);
      showApp();
      routeFromHash();
      loadDashboard();
    } catch (err) {
      if (errEl) {
        errEl.textContent = "Invalid API key: " + (err.message || "Unknown error");
        errEl.classList.remove("hidden");
      }
    }
  });

  // Sign out
  $("signOutButton")?.addEventListener("click", () => {
    clearKey();
    showAuth();
    toast("Signed out", "ok");
  });

  // Hash routing
  function routeFromHash() {
    const hash = location.hash.replace("#", "") || "setup";
    const valid = Object.keys(PAGE_TITLES);
    navigate(valid.includes(hash) ? hash : "overview");
  }
  window.addEventListener("hashchange", routeFromHash);

  // Nav click
  document.querySelectorAll(".nav-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      if (!getStoredKey()) { showAuth(); return; }
      navigate(a.dataset.page);
    });
  });

  // Refresh button
  $("refreshButton")?.addEventListener("click", () => {
    if (getStoredKey()) loadDashboard();
  });

  // Console chat form
  $("consoleChatForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const key = getStoredKey();
    if (!key) { toast("No API key stored", "warn"); return; }

    const prompt = ($("consolePrompt")?.value || "").trim();
    if (!prompt) return;

    const model = $("consoleModel")?.value || "auto";
    const task = $("consoleTask")?.value || "chat";
    const useStream = $("consoleStream")?.checked === true;
    const sendBtn = document.querySelector(".chat-send-btn");
    const systemPromptVal = ($("systemPromptInput")?.value || "").trim();

    // Compare mode (feature #6)
    if (compareMode) {
      if ($("consolePrompt")) { $("consolePrompt").value = ""; $("consolePrompt").style.height = "auto"; }
      if ($("tokenCounter")) $("tokenCounter").textContent = "";
      var mA = $("compareModelA")?.value || "auto";
      var mB = $("compareModelB")?.value || "auto";
      await Promise.all([
        sendCompareRequest("comparePaneA", mA, prompt, key, task),
        sendCompareRequest("comparePaneB", mB, prompt, key, task)
      ]);
      return;
    }

    // Check for image attachment (feature 7 + #3 paste)
    const imageInput = $("imageUploadInput");
    const pastedUrl = imageInput ? imageInput.getAttribute("data-pasted-url") : null;
    const hasImage = (imageInput && imageInput.files && imageInput.files.length > 0) || !!pastedUrl;

    chatHistory.push({ role: "user", content: prompt });
    appendChatMessage("user", prompt, false);
    if ($("consolePrompt")) { $("consolePrompt").value = ""; $("consolePrompt").style.height = "auto"; }
    if ($("tokenCounter")) $("tokenCounter").textContent = "";
    if (sendBtn) sendBtn.disabled = true;
    setText("consoleStatus", "Thinking…");

    const assistantWrapper = appendChatMessage("assistant", "", false);
    if (assistantWrapper) assistantWrapper.classList.add("streaming");

    // Vision path (feature 7 + #3 paste)
    if (hasImage) {
      // Clear pasted-url attribute after use
      if (imageInput) imageInput.removeAttribute("data-pasted-url");

      const doVisionRequest = async function(dataUrl, mimeType) {
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
        try {
          const p = await fetchWithKey("/v1/vision/analyze", key, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model,
              task_type: "vision",
              image: { data: base64, media_type: mimeType },
              prompt
            })
          });
          const content = (p && p.choices && p.choices[0] && p.choices[0].message && p.choices[0].message.content)
            ? p.choices[0].message.content
            : json(p);
          if (assistantWrapper) {
            assistantWrapper.classList.remove("streaming");
            var bubble = assistantWrapper.querySelector(".chat-bubble");
            if (bubble) bubble.innerHTML = renderMarkdown(content);
          }
          chatHistory.push({ role: "assistant", content });
          conversations[activeTabIdx].history = chatHistory.slice();
          saveConvs();
          setText("consoleStatus", "Done");
          loadDashboard();
        } catch (err) {
          if (assistantWrapper) assistantWrapper.classList.remove("streaming");
          setStreamingText(assistantWrapper, "Error: " + err.message);
          setText("consoleStatus", "Failed");
          toast("Vision request failed: " + err.message, "error");
          chatHistory.pop();
        } finally {
          if (sendBtn) sendBtn.disabled = false;
          // Clear image preview
          if (imageInput) imageInput.value = "";
          var preview = $("imagePreview");
          if (preview) preview.classList.add("hidden");
          var previewImg = $("imagePreviewImg");
          if (previewImg) previewImg.src = "";
        }
      };

      if (pastedUrl) {
        // Use the pasted data URL directly
        var mimeMatch = pastedUrl.match(/^data:([^;]+);/);
        var mimeType = mimeMatch ? mimeMatch[1] : "image/png";
        doVisionRequest(pastedUrl, mimeType);
      } else {
        // Read from file input
        const file = imageInput && imageInput.files && imageInput.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async function(ev) {
            var dataUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
            doVisionRequest(dataUrl, file.type);
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }

    // Build messages payload with optional system prompt (feature 3)
    function buildMessages() {
      var msgs = chatHistory.slice();
      if (systemPromptVal) {
        msgs = [{ role: "system", content: systemPromptVal }].concat(msgs);
      }
      return msgs;
    }

    if (useStream) {
      const started = Date.now();
      try {
        const res = await fetch("/v1/chat", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key },
          body: JSON.stringify({
            model,
            task_type: task,
            stream: true,
            messages: buildMessages(),
            temperature: getTemperature(),
            max_tokens: getMaxTokens(),
            metadata: { source: "user-dashboard" }
          })
        });
        if (!res.ok || !res.body) {
          const errPayload = await res.json().catch(() => ({}));
          throw new Error(errPayload?.error?.message || res.statusText);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let streamErr = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const evt = JSON.parse(raw);
              if (evt.error) { streamErr = evt.error; continue; }
              const text = evt.choices && evt.choices[0] && evt.choices[0].delta
                ? evt.choices[0].delta.content || ""
                : "";
              if (text) { acc += text; setStreamingText(assistantWrapper, acc); }
            } catch (_) { /* ignore */ }
          }
        }
        if (assistantWrapper) {
          assistantWrapper.classList.remove("streaming");
        }
        if (streamErr) {
          setStreamingText(assistantWrapper, "Error: " + (streamErr.message || "unknown"));
          setText("consoleStatus", "Failed");
          toast("Stream failed: " + (streamErr.message || "unknown"), "error");
          chatHistory.pop();
        } else {
          // Apply markdown after streaming completes
          var bubble = assistantWrapper && assistantWrapper.querySelector(".chat-bubble");
          if (bubble) bubble.innerHTML = renderMarkdown(acc);
          chatHistory.push({ role: "assistant", content: acc });
          conversations[activeTabIdx].history = chatHistory.slice();
          saveConvs();
          maybeFireWebhook(prompt, acc);
          setText("consoleStatus", "Done · " + (Date.now() - started) + "ms");
          loadDashboard();
        }
      } catch (err) {
        if (assistantWrapper) assistantWrapper.classList.remove("streaming");
        setStreamingText(assistantWrapper, "Error: " + err.message);
        setText("consoleStatus", "Failed");
        toast("Request failed: " + err.message, "error");
        chatHistory.pop();
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
      return;
    }

    try {
      const p = await fetchWithKey("/v1/chat", key, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          task_type: task,
          messages: buildMessages(),
          temperature: getTemperature(),
          max_tokens: getMaxTokens(),
          metadata: { source: "user-dashboard" }
        })
      });
      const content = (p && p.choices && p.choices[0] && p.choices[0].message && p.choices[0].message.content)
        ? p.choices[0].message.content
        : json(p);
      if (assistantWrapper) {
        assistantWrapper.classList.remove("streaming");
        var bubble = assistantWrapper.querySelector(".chat-bubble");
        if (bubble) bubble.innerHTML = renderMarkdown(content);
      }
      chatHistory.push({ role: "assistant", content });
      conversations[activeTabIdx].history = chatHistory.slice();
      saveConvs();
      maybeFireWebhook(prompt, content);
      setText("consoleStatus", "Done");
      loadDashboard();
    } catch (err) {
      if (assistantWrapper) assistantWrapper.classList.remove("streaming");
      setStreamingText(assistantWrapper, "Error: " + err.message);
      setText("consoleStatus", "Failed");
      toast("Request failed: " + err.message, "error");
      chatHistory.pop();
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });

  // Clear chat
  $("consoleClear")?.addEventListener("click", () => {
    chatHistory = [];
    conversations[activeTabIdx].history = [];
    saveConvs();
    var msgs = $("chatMessages");
    if (msgs) msgs.innerHTML = '<div class="chat-welcome" id="chatWelcome"><div class="chat-welcome-icon">✦</div><p class="chat-welcome-title">AI Gateway Console</p><p class="chat-welcome-sub">Select a model and send a message to test the gateway.</p></div>';
    setText("consoleStatus", "");
  });

  // New tab (feature 9)
  $("chatNewTab")?.addEventListener("click", () => { newTab(); });

  // Toggle system prompt (feature 3)
  $("toggleSystemPrompt")?.addEventListener("click", () => {
    var wrap = $("systemPromptWrap");
    if (wrap) wrap.classList.toggle("hidden");
  });

  // Save system prompt on input (feature 3)
  $("systemPromptInput")?.addEventListener("input", function() {
    if (conversations[activeTabIdx]) {
      conversations[activeTabIdx].systemPrompt = this.value;
      saveConvs();
    }
  });

  // Export chat (feature 6)
  $("exportChat")?.addEventListener("click", () => { exportChat(); });

  // Share conversation (feature #12)
  $("shareChat")?.addEventListener("click", function() {
    if (!chatHistory || chatHistory.length === 0) { toast("No conversation to share", "warn"); return; }
    try {
      var payload = JSON.stringify(chatHistory);
      var encoded = btoa(encodeURIComponent(payload));
      var url = window.location.origin + window.location.pathname + "#share=" + encoded;
      if (url.length > 20000) { toast("Conversation too long to share as URL — use Export instead", "warn"); return; }
      navigator.clipboard.writeText(url).then(function() {
        toast("Share link copied to clipboard!", "ok");
      }).catch(function() {
        prompt("Copy this share link:", url);
      });
    } catch(e) {
      toast("Failed to generate share link", "error");
    }
  });

  // Load shared conversation from URL hash
  (function() {
    var hash = window.location.hash;
    if (hash && hash.startsWith("#share=")) {
      try {
        var encoded = hash.slice(7);
        var payload = decodeURIComponent(atob(encoded));
        var history = JSON.parse(payload);
        if (Array.isArray(history) && history.length > 0) {
          chatHistory = history;
          history.forEach(function(msg) { appendChatMessage(msg.role, msg.content, true); });
          toast("Shared conversation loaded (" + history.length + " messages)", "ok");
          window.location.hash = "";
          navigate("console");
        }
      } catch(e) {
        toast("Invalid share link", "error");
      }
    }
  })();

  // Params panel (feature #7)
  $("toggleParams")?.addEventListener("click", function() {
    var panel = $("paramsPanel");
    if (panel) panel.classList.toggle("hidden");
    this.classList.toggle("active");
  });
  $("tempSlider")?.addEventListener("input", function() {
    var v = parseFloat(this.value).toFixed(2);
    if ($("tempVal")) $("tempVal").textContent = v;
  });
  $("maxTokSlider")?.addEventListener("input", function() {
    if ($("maxTokVal")) $("maxTokVal").textContent = this.value;
  });
  function getTemperature() {
    var el = $("tempSlider");
    return el ? parseFloat(el.value) : 0.7;
  }
  function getMaxTokens() {
    var el = $("maxTokSlider");
    return el ? parseInt(el.value, 10) : 1024;
  }

  // Language toggle (feature #14)
  var LANG_KEY = 'gw-lang';
  var LANG_PROMPTS = {
    vi: "Bạn là trợ lý AI thông minh của spa. Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.",
    en: "You are a helpful AI assistant. Respond in English, professionally and concisely."
  };
  var currentLang = localStorage.getItem(LANG_KEY) || 'vi';
  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    var btn = $("langToggle");
    if (btn) btn.textContent = '🌐 ' + lang.toUpperCase();
    // Auto-set system prompt if it's empty or was a lang prompt
    var sysInput = $("systemPromptInput");
    if (sysInput) {
      var current = sysInput.value.trim();
      var wasLangPrompt = current === LANG_PROMPTS.vi || current === LANG_PROMPTS.en || current === '';
      if (wasLangPrompt) {
        sysInput.value = LANG_PROMPTS[lang] || '';
        if (conversations[activeTabIdx]) conversations[activeTabIdx].systemPrompt = sysInput.value;
        saveConvs();
      }
    }
    toast('Language: ' + (lang === 'vi' ? 'Tiếng Việt' : 'English'), 'ok', 2000);
  }
  $("langToggle")?.addEventListener("click", function() {
    applyLang(currentLang === 'vi' ? 'en' : 'vi');
  });
  // Apply on load
  applyLang(currentLang);

  // Webhook (feature #11)
  var WH_KEY = 'gw-webhook-url';
  var WH_AUTO_KEY = 'gw-webhook-auto';
  var webhookUrlEl = $("webhookUrl");
  var webhookAutoEl = $("webhookAuto");
  if (webhookUrlEl) webhookUrlEl.value = localStorage.getItem(WH_KEY) || '';
  if (webhookAutoEl) webhookAutoEl.checked = localStorage.getItem(WH_AUTO_KEY) === '1';
  $("webhookUrl")?.addEventListener("input", function() { localStorage.setItem(WH_KEY, this.value); });
  $("webhookAuto")?.addEventListener("change", function() { localStorage.setItem(WH_AUTO_KEY, this.checked ? '1' : '0'); });
  $("toggleWebhook")?.addEventListener("click", function() {
    var panel = $("webhookPanel");
    if (panel) panel.classList.toggle("hidden");
    this.classList.toggle("active");
  });
  async function fireWebhook(payload) {
    var url = $("webhookUrl")?.value?.trim();
    if (!url) return;
    try {
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      toast("Webhook sent", "ok", 2000);
    } catch(e) {
      toast("Webhook failed: " + e.message, "error");
    }
  }
  function maybeFireWebhook(userPrompt, aiContent) {
    if ($("webhookAuto")?.checked && $("webhookUrl")?.value?.trim()) {
      fireWebhook({ prompt: userPrompt, response: aiContent, model: $("consoleModel")?.value, ts: new Date().toISOString() });
    }
  }

  // Compare mode (feature #6)
  var compareMode = false;
  function syncCompareModels() {
    var models = Array.from($("consoleModel")?.options || []).map(function(o) { return o; });
    ["compareModelA", "compareModelB"].forEach(function(id) {
      var sel = $(id);
      if (!sel) return;
      var current = sel.value;
      sel.innerHTML = models.map(function(o) {
        return '<option value="' + o.value + '"' + (o.value === current ? ' selected' : '') + '>' + o.textContent + '</option>';
      }).join('');
    });
  }
  $("toggleCompare")?.addEventListener("click", function() {
    compareMode = !compareMode;
    var bar = $("compareBar");
    var btn = $("toggleCompare");
    var msgs = $("chatMessages");
    if (!bar || !msgs) return;
    if (compareMode) {
      bar.classList.remove("hidden");
      if (btn) btn.classList.add("active");
      syncCompareModels();
      // Set sensible defaults: A = first model, B = second if exists
      var opts = $("consoleModel")?.options || [];
      if ($("compareModelA") && opts[0]) $("compareModelA").value = opts[0].value;
      if ($("compareModelB") && opts[1]) $("compareModelB").value = opts[1].value;
      // Switch messages area to side-by-side panes
      msgs.classList.add("compare-panes");
      msgs.innerHTML =
        '<div class="compare-pane" id="comparePaneA"><div class="compare-pane-label">Model A</div></div>' +
        '<div class="compare-pane" id="comparePaneB"><div class="compare-pane-label">Model B</div></div>';
    } else {
      bar.classList.add("hidden");
      if (btn) btn.classList.remove("active");
      msgs.classList.remove("compare-panes");
      msgs.innerHTML = '<div class="chat-welcome" id="chatWelcome"><div class="chat-welcome-icon">✦</div><p class="chat-welcome-title">AI Gateway Console</p><p class="chat-welcome-sub">Select a model and send a message to test the gateway.</p></div>';
    }
  });

  async function sendCompareRequest(paneId, model, prompt, key, task) {
    var pane = $(paneId);
    if (!pane) return;
    var label = pane.querySelector(".compare-pane-label");
    var modelName = model || "auto";
    if (label) label.textContent = "Model: " + modelName;
    var msgEl = document.createElement("div");
    msgEl.className = "chat-msg user";
    msgEl.innerHTML = '<div class="chat-bubble">' + prompt.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</div>';
    pane.appendChild(msgEl);
    var respEl = document.createElement("div");
    respEl.className = "chat-msg assistant streaming";
    respEl.innerHTML = '<div class="chat-bubble"></div>';
    pane.appendChild(respEl);
    pane.scrollTop = pane.scrollHeight;
    var bubble = respEl.querySelector(".chat-bubble");
    try {
      var res = await fetch("/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key },
        body: JSON.stringify({ model: model, task_type: task, stream: true, messages: [{ role: "user", content: prompt }] })
      });
      if (!res.ok || !res.body) { if (bubble) bubble.textContent = "Error " + res.status; respEl.classList.remove("streaming"); return; }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var acc = "";
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        var lines = decoder.decode(chunk.value, { stream: true }).split("\\n");
        for (var ln of lines) {
          if (!ln.startsWith("data: ")) continue;
          var d = ln.slice(6).trim();
          if (d === "[DONE]") break;
          try {
            var j = JSON.parse(d);
            var delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) { acc += delta; if (bubble) bubble.innerHTML = renderMarkdown(acc); }
          } catch(e) {}
        }
      }
      respEl.classList.remove("streaming");
      pane.scrollTop = pane.scrollHeight;
    } catch(err) {
      if (bubble) bubble.textContent = "Error: " + err.message;
      respEl.classList.remove("streaming");
    }
  }

  // Prompt Library
  document.getElementById('togglePromptLib') && document.getElementById('togglePromptLib').addEventListener('click', openPromptLib);
  document.getElementById('promptLibClose') && document.getElementById('promptLibClose').addEventListener('click', closePromptLib);
  document.getElementById('promptLibOverlay') && document.getElementById('promptLibOverlay').addEventListener('click', closePromptLib);
  document.getElementById('promptLibSearch') && document.getElementById('promptLibSearch').addEventListener('input', function() {
    renderPromptLib(this.value);
  });
  document.getElementById('promptLibReset') && document.getElementById('promptLibReset').addEventListener('click', function() {
    if (!confirm('Restore all default spa templates? Your custom prompts will be replaced.')) return;
    localStorage.removeItem(PL_KEY);
    renderPromptLib('');
    toast('Default spa templates restored', 'ok');
  });
  document.getElementById('promptLibAdd') && document.getElementById('promptLibAdd').addEventListener('click', function() {
    var form = document.getElementById('promptLibForm');
    if (form) form.classList.toggle('hidden');
  });
  document.getElementById('plCancel') && document.getElementById('plCancel').addEventListener('click', function() {
    var form = document.getElementById('promptLibForm');
    if (form) form.classList.add('hidden');
  });
  document.getElementById('plSave') && document.getElementById('plSave').addEventListener('click', function() {
    var titleEl = document.getElementById('plTitle');
    var contentEl = document.getElementById('plContent');
    var categoryEl = document.getElementById('plCategory');
    var title = (titleEl ? titleEl.value : '').trim();
    var content = (contentEl ? contentEl.value : '').trim();
    var category = categoryEl ? categoryEl.value : 'General';
    if (!title || !content) { toast('Title and content are required', 'warn'); return; }
    var all = loadPromptLib();
    all.unshift({ id: Date.now() + Math.random(), title: title, content: content, category: category, createdAt: Date.now() });
    savePromptLib(all);
    if (titleEl) titleEl.value = '';
    if (contentEl) contentEl.value = '';
    var form = document.getElementById('promptLibForm');
    if (form) form.classList.add('hidden');
    renderPromptLib('');
    toast('Prompt saved', 'ok');
  });

  // Keyboard shortcuts (feature #4)
  document.addEventListener("keydown", function(e) {
    // Only fire when Console is active
    if ($("page-console") && $("page-console").classList.contains("hidden")) return;
    var focused = document.activeElement;
    var inInput = focused && (focused.tagName === "TEXTAREA" || focused.tagName === "INPUT");
    // Ctrl+K — clear conversation
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      var clearBtn = $("consoleClear");
      if (clearBtn) clearBtn.click();
      return;
    }
    // Ctrl+E — export
    if (e.ctrlKey && e.key === "e") {
      e.preventDefault();
      exportChat();
      return;
    }
    // Ctrl+/ — toggle prompt library
    if (e.ctrlKey && e.key === "/") {
      e.preventDefault();
      var drawer = $("promptLibDrawer");
      if (drawer && !drawer.classList.contains("hidden")) closePromptLib();
      else openPromptLib();
      return;
    }
    // Ctrl+L — focus message input
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      var ta = $("consolePrompt");
      if (ta) { ta.focus(); ta.select(); }
      return;
    }
    // Ctrl+F — open chat search
    if (e.ctrlKey && e.key === "f") {
      var searchBar = $("chatSearchBar");
      if (searchBar) { e.preventDefault(); openChatSearch(); return; }
    }
    // Escape — close search or prompt library
    if (e.key === "Escape") {
      var searchBar2 = $("chatSearchBar");
      if (searchBar2 && !searchBar2.classList.contains("hidden")) { closeChatSearch(); return; }
      var drawer = $("promptLibDrawer");
      if (drawer && !drawer.classList.contains("hidden")) { closePromptLib(); return; }
    }
  });

  // Preset prompts (feature 4)
  document.querySelectorAll(".chat-preset-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var preset = btn.getAttribute("data-preset") || "";
      var ta = $("consolePrompt");
      if (ta) { ta.value = preset + " "; ta.focus(); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
    });
  });

  // Image upload (feature 7)
  $("imageUploadBtn")?.addEventListener("click", () => {
    $("imageUploadInput")?.click();
  });
  $("imageUploadInput")?.addEventListener("change", function() {
    var file = this.files && this.files[0];
    if (!file) return;
    var preview = $("imagePreview");
    var previewImg = $("imagePreviewImg");
    if (!preview || !previewImg) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      previewImg.src = ev.target && ev.target.result ? String(ev.target.result) : "";
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
  $("removeImage")?.addEventListener("click", () => {
    var imageInput = $("imageUploadInput");
    if (imageInput) imageInput.value = "";
    var preview = $("imagePreview");
    if (preview) preview.classList.add("hidden");
    var previewImg = $("imagePreviewImg");
    if (previewImg) previewImg.src = "";
  });

  // Clipboard paste image (feature #3)
  document.addEventListener("paste", function(e) {
    if (!$("page-console") || $("page-console").classList.contains("hidden")) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (!file) return;
        var preview = $("imagePreview");
        var previewImg = $("imagePreviewImg");
        if (!preview || !previewImg) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var dataUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
          previewImg.src = dataUrl;
          preview.classList.remove("hidden");
          // Store as data-url on input for submit handler to pick up
          var imgInput = $("imageUploadInput");
          if (imgInput) imgInput.setAttribute("data-pasted-url", dataUrl);
          toast("Image pasted — send to analyze with Vision", "ok", 3000);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  });

  // Conversation search (feature #9)
  function openChatSearch() {
    var bar = $("chatSearchBar");
    var input = $("chatSearchInput");
    if (!bar) return;
    bar.classList.remove("hidden");
    if (input) { input.value = ""; input.focus(); }
    applyChatSearch("");
  }
  function closeChatSearch() {
    var bar = $("chatSearchBar");
    if (bar) bar.classList.add("hidden");
    applyChatSearch(""); // restore all messages
  }
  function applyChatSearch(query) {
    var msgs = $("chatMessages");
    var countEl = $("chatSearchCount");
    if (!msgs) return;
    var q = query.trim().toLowerCase();
    var rows = msgs.querySelectorAll(".chat-msg");
    var matchCount = 0;
    rows.forEach(function(row) {
      var bubble = row.querySelector(".chat-bubble");
      if (!bubble) return;
      // Restore original text (strip highlights)
      bubble.innerHTML = bubble.innerHTML.replace(/<mark class="chat-search-highlight">([\\s\\S]*?)<\\/mark>/g, "$1");
      if (!q) { row.classList.remove("search-hidden"); return; }
      var text = bubble.textContent || "";
      if (text.toLowerCase().includes(q)) {
        row.classList.remove("search-hidden");
        matchCount++;
        // Highlight occurrences
        var escaped = q.replace(/[\\^$.|?*+(){}[\]]/g, '\\$&');
        bubble.innerHTML = bubble.innerHTML.replace(
          new RegExp(escaped, 'gi'),
          function(m) { return '<mark class="chat-search-highlight">' + m + '</mark>'; }
        );
      } else {
        row.classList.add("search-hidden");
      }
    });
    if (countEl) countEl.textContent = q ? matchCount + ' match' + (matchCount !== 1 ? 'es' : '') : '';
  }
  $("chatSearchInput")?.addEventListener("input", function() { applyChatSearch(this.value); });
  $("chatSearchClose")?.addEventListener("click", closeChatSearch);

  // Drag & drop image upload (feature #8)
  function handleDroppedFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    var preview = $("imagePreview");
    var previewImg = $("imagePreviewImg");
    if (!preview || !previewImg) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
      previewImg.src = dataUrl;
      preview.classList.remove("hidden");
      var imgInput = $("imageUploadInput");
      if (imgInput) imgInput.setAttribute("data-pasted-url", dataUrl);
      toast("Image ready — send to analyze", "ok", 2500);
    };
    reader.readAsDataURL(file);
  }
  var chatContainer = document.querySelector(".chat-container");
  if (chatContainer) {
    chatContainer.addEventListener("dragover", function(e) {
      e.preventDefault();
      this.classList.add("drag-over");
    });
    chatContainer.addEventListener("dragleave", function(e) {
      if (!this.contains(e.relatedTarget)) this.classList.remove("drag-over");
    });
    chatContainer.addEventListener("drop", function(e) {
      e.preventDefault();
      this.classList.remove("drag-over");
      if (!$("page-console") || $("page-console").classList.contains("hidden")) return;
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) handleDroppedFile(files[0]);
    });
  }

  // Token counter helper (~4 chars per token approximation)
  function estimateTokens(text) {
    return Math.max(0, Math.ceil((text || '').length / 4));
  }
  function updateTokenCounter() {
    var ta = $("consolePrompt");
    var el = $("tokenCounter");
    if (!ta || !el) return;
    var msgTokens = estimateTokens(ta.value);
    var historyText = chatHistory.map(function(m) { return m.content || ''; }).join(' ');
    var systemText = ($("systemPromptInput")?.value || '');
    var totalTokens = estimateTokens(historyText + ' ' + systemText) + msgTokens;
    if (msgTokens === 0) { el.textContent = ''; return; }
    el.textContent = '~' + msgTokens + ' tokens · ~' + totalTokens + ' total';
  }

  // Textarea — auto-resize + Enter to send
  var chatTextarea = $("consolePrompt");
  if (chatTextarea) {
    chatTextarea.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 160) + "px";
      updateTokenCounter();
    });
    chatTextarea.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        var form = $("consoleChatForm");
        if (form) form.requestSubmit();
      }
    });
  }

  // Logs pagination
  $("logsPrevBtn")?.addEventListener("click", () => {
    if (logsPage > 1) { logsPage -= 1; loadDashboard(); }
  });
  $("logsNextBtn")?.addEventListener("click", () => {
    logsPage += 1; loadDashboard();
  });

  // New key creation
  $("newKeyButton")?.addEventListener("click", () => {
    $("newKeyForm")?.classList.remove("hidden");
    $("newKeyName")?.focus();
  });
  $("newKeyCancel")?.addEventListener("click", () => {
    $("newKeyForm")?.classList.add("hidden");
    if ($("newKeyName")) $("newKeyName").value = "";
  });
  $("newKeyForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const name = ($("newKeyName")?.value || "").trim();
    if (!name) { toast("Enter a key name first", "warn"); return; }
    try {
      const res = await apiFetch("/dashboard/api/my/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      const raw = res?.data?.raw_key;
      if (raw) {
        $("rawKeyValue").textContent = raw;
        $("rawKeyBanner")?.classList.remove("hidden");
      }
      $("newKeyForm")?.classList.add("hidden");
      if ($("newKeyName")) $("newKeyName").value = "";
      toast("Key created — copy it now, shown only once", "warn", 7000);
      loadDashboard();
    } catch (err) {
      toast("Create key failed: " + err.message, "error");
    }
  });
  $("rawKeyCopy")?.addEventListener("click", async () => {
    const v = $("rawKeyValue")?.textContent || "";
    try {
      await navigator.clipboard.writeText(v);
      toast("Copied to clipboard", "ok");
    } catch (_) {
      toast("Copy failed — select manually", "warn");
    }
  });
  $("rawKeyClose")?.addEventListener("click", () => {
    $("rawKeyBanner")?.classList.add("hidden");
    if ($("rawKeyValue")) $("rawKeyValue").textContent = "";
  });

  document.querySelectorAll(".tool-option").forEach(function(button) {
    button.addEventListener("click", function() {
      selectedSetupTool = button.dataset.tool || "claude-code";
      document.querySelectorAll(".tool-option").forEach(function(item) {
        item.classList.toggle("active", item === button);
      });
      renderSetup();
    });
  });

  document.querySelectorAll(".mode-control button").forEach(function(button) {
    button.addEventListener("click", function() {
      selectedSetupMode = button.dataset.mode || "balanced";
      document.querySelectorAll(".mode-control button").forEach(function(item) {
        item.classList.toggle("active", item === button);
      });
      renderSetup();
    });
  });

  $("copySetupConfig")?.addEventListener("click", async function() {
    const value = $("setupConfig")?.textContent || "";
    try {
      await navigator.clipboard.writeText(value);
      toast("Đã copy cấu hình", "ok");
    } catch (_) {
      toast("Không thể copy tự động", "warn");
    }
  });

  $("runDiagnostics")?.addEventListener("click", runSetupDiagnostics);
  $("openPlayground")?.addEventListener("click", function() {
    localStorage.setItem("gw-preferred-model", setupModel(selectedSetupTool, selectedSetupMode));
    navigate("console");
    const modelSelect = $("consoleModel");
    if (modelSelect) {
      const preferred = setupModel(selectedSetupTool, selectedSetupMode);
      modelSelect.value = Array.from(modelSelect.options).some(function(option) {
        return option.value === preferred;
      }) ? preferred : "auto";
    }
    const taskSelect = $("consoleTask");
    if (taskSelect) taskSelect.value = SETUP_TOOLS[selectedSetupTool].task;
  });
});
`;
