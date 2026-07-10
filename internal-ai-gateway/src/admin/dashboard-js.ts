export const adminJs = `
/* ─── Utilities ─────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const providerLabels = {
  anthropic: "Anthropic",
  openai: "OpenAI-compatible",
  "kiro-cli": "Kiro CLI",
  "9router": "9router"
};

function getToken() {
  return ($("adminTokenInput")?.value || "").trim() ||
    sessionStorage.getItem("gatewayAdminToken") || "";
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v;
}

function json(v) {
  return JSON.stringify(v, null, 2);
}

function csv(v) {
  return String(v || "").split(",").map(s => s.trim()).filter(Boolean);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/* ─── Toast system ───────────────────────────────────────── */
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

/* ─── Fetch helper ───────────────────────────────────────── */
async function fetchJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["content-type"] && !headers["Content-Type"]) {
    headers["content-type"] = "application/json";
  }
  if (url.startsWith("/admin/api")) {
    const tok = getToken();
    if (tok) headers["x-admin-token"] = tok;
    const sess = sessionStorage.getItem("gatewayAdminSession");
    if (sess) headers["x-admin-session"] = sess;
  }
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

async function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

/* ─── SPA routing ────────────────────────────────────────── */
const PAGE_TITLES = {
  overview: "Overview",
  users: "Users",
  clients: "Clients",
  keys: "API Keys",
  policies: "Policies",
  models: "Models",
  registry: "Registry",
  routing: "Routing",
  audit: "Audit & Usage",
  analytics: "Analytics",
  console: "Console"
};

/* ─── Audit pagination/filter state ──────────────────────── */
var auditPage = 1;
var auditFilters = {};
var analyticsDays = 7;
var adminDataCache = { users: [], clients: [], keys: [], policies: [], control: null };

function navigate(pageId) {
  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  // Show target page
  const target = $("page-" + pageId);
  if (target) target.classList.remove("hidden");

  // Update nav active state
  document.querySelectorAll(".nav-item").forEach(a => {
    a.classList.toggle("active", a.dataset.page === pageId);
    a.setAttribute("aria-current", a.dataset.page === pageId ? "page" : "false");
  });

  // Update page title
  const title = PAGE_TITLES[pageId] || pageId;
  setText("pageTitle", title);
  document.title = title + " — AI Gateway Admin";

  // Update hash without scrolling
  history.replaceState(null, "", "#" + pageId);
}

/* ─── Spinner on refresh ─────────────────────────────────── */
function setRefreshing(loading) {
  const icon = $("refreshIcon");
  const spinner = $("refreshSpinner");
  if (!icon || !spinner) return;
  icon.classList.toggle("hidden", loading);
  spinner.classList.toggle("hidden", !loading);
}

/* ─── Pill helper ────────────────────────────────────────── */
function pill(ok, labels = ["Ready", "Missing"]) {
  return ok
    ? \`<span class="pill ok">\${labels[0]}</span>\`
    : \`<span class="pill warn">\${labels[1]}</span>\`;
}

function renderAlertList(targetId, alerts) {
  const target = $(targetId);
  if (!target) return;
  if (!alerts || !alerts.length) {
    target.innerHTML = '<div class="empty-state">No alerts.</div>';
    return;
  }
  target.innerHTML = alerts.slice(0, 10).map(a => {
    const sev = a.severity === "high" ? "bad" : a.severity === "warn" ? "warn" : "ok";
    return \`<div class="alert-item">
      <span class="pill \${sev}">\${escapeHtml(a.type || "event")}</span>
      <div>
        <strong>\${escapeHtml(a.subject || "-")}</strong>
        <span>\${escapeHtml(a.detail || "")}</span>
      </div>
      <small class="muted">\${a.created_at ? new Date(a.created_at).toLocaleString() : "-"}</small>
    </div>\`;
  }).join("");
}

function renderRankList(targetId, rows, keyName) {
  const target = $(targetId);
  if (!target) return;
  if (!rows || !rows.length) {
    target.innerHTML = '<div class="empty-state">No usage yet.</div>';
    return;
  }
  target.innerHTML = rows.map((row, idx) => \`<div class="rank-item">
    <span class="rank-num">\${idx + 1}</span>
    <code>\${escapeHtml(row[keyName] || "-")}</code>
    <span class="muted">\${Number(row.requests || 0).toLocaleString()} req · $\${Number(row.cost || 0).toFixed(4)}</span>
  </div>\`).join("");
}

function renderControlCenter(data) {
  if (!data) return;
  setText("ccErrorRate", (data.reliability_24h?.error_rate ?? 0) + "%");
  setText("ccLatency", "p95 latency " + (data.reliability_24h?.p95_latency_ms ?? 0) + "ms");
  setText("ccMonthCost", "$" + Number(data.month_usage?.cost || 0).toFixed(4));
  setText("ccMonthUsage", Number(data.month_usage?.requests || 0).toLocaleString() + " requests");
  setText("ccActiveKeys", String(data.totals?.active_api_keys ?? 0));
  setText("ccTotals", (data.totals?.users ?? 0) + " users · " + (data.totals?.clients ?? 0) + " clients");
  setText("usageCount", String(data.today_usage?.requests ?? 0));
  renderAlertList("overviewAlerts", data.alerts || []);
  renderAlertList("auditAlertList", data.alerts || []);
  renderRankList("topClientsList", data.top_clients || [], "client_id");
}

function selectedBuilderValues(id) {
  return Array.from(document.querySelectorAll("#" + id + " input:checked")).map(input => input.value);
}

function syncPolicyTaskBuilder() {
  const input = document.querySelector("#policyForm input[name='allowedTaskTypes']");
  if (input) input.value = selectedBuilderValues("policyTaskBuilder").join(",");
}

function renderUserDetail(userId) {
  const box = $("userDetailContent");
  if (!box) return;
  const user = adminDataCache.users.find(u => u.id === userId);
  if (!user) {
    box.innerHTML = '<div class="empty-state">User not found.</div>';
    return;
  }
  const clients = adminDataCache.clients.filter(c => c.owner_user_id === userId);
  const keys = adminDataCache.keys.filter(k => k.user_id === userId);
  const policies = adminDataCache.policies.filter(p => p.scope_id === userId || clients.some(c => c.id === p.scope_id) || keys.some(k => k.id === p.scope_id));
  box.innerHTML = \`
    <article class="detail-card"><span class="label">User</span><strong>\${escapeHtml(user.name)}</strong><small>\${escapeHtml(user.email)}</small></article>
    <article class="detail-card"><span class="label">Clients</span><strong>\${clients.length}</strong><small>\${clients.map(c => escapeHtml(c.name)).join(", ") || "-"}</small></article>
    <article class="detail-card"><span class="label">Keys</span><strong>\${keys.filter(k => k.status === "active").length}</strong><small>\${keys.length} total</small></article>
    <article class="detail-card"><span class="label">Policies</span><strong>\${policies.length}</strong><small>\${policies.map(p => p.scope_type + ":" + p.scope_id).join(", ") || "-"}</small></article>
  \`;
}

/* ─── Auth state ─────────────────────────────────────────── */
function updateAuthUI() {
  const hasSession = !!sessionStorage.getItem("gatewayAdminToken");
  const tokenSection = $("adminTokenSection");
  const sessionBadge = $("sessionBadge");
  if (tokenSection) tokenSection.classList.toggle("hidden", hasSession);
  if (sessionBadge) sessionBadge.classList.toggle("hidden", !hasSession);
}

/* ─── Refresh public data (no auth needed) ───────────────── */
async function refreshPublic() {
  try {
    const h = await fetchJson("/health");
    setText("gatewayStatus", h.status === "ok" ? "Online" : "Unknown");
    setText("gatewayDetail", "HTTP service responding");
  } catch (e) {
    setText("gatewayStatus", "Offline");
    setText("gatewayDetail", e.message);
  }

  try {
    const ready = await fetchJson("/ready");
    const providers = ready.providers || {};
    const entries = Object.entries(providers);
    const count = entries.filter(([, ok]) => ok).length;
    setText("providerCount", String(count));
    setText("providerDetail", count + " of " + entries.length + " configured");
    $("providerList").innerHTML = entries.map(([p, ok]) => \`
      <article class="provider">
        <div class="provider-title">
          <strong>\${providerLabels[p] || p}</strong>
          \${pill(ok)}
        </div>
        <code>provider=\${p}</code>
      </article>\`).join("") || '<div class="empty-state">No providers configured.</div>';
  } catch (e) {
    $("providerList").innerHTML = \`<article class="provider"><strong>Unable to load providers</strong><span class="muted">\${e.message}</span></article>\`;
  }

  try {
    const models = await fetchJson("/v1/models");
    const list = models.data || [];
    setText("modelCount", String(list.length));
    const rows = list.map(m => \`<tr>
      <td><code>\${m.id}</code></td>
      <td>\${providerLabels[m.provider] || m.provider || "-"}</td>
      <td><code>\${m.provider_model || "-"}</code></td>
      <td>\${m.allowed_task_types ? m.allowed_task_types.join(", ") : "Any"}</td>
    </tr>\`).join("");
    $("modelRows").innerHTML = rows || '<tr><td colspan="4" class="empty-td">No models</td></tr>';
    $("modelsPageRows").innerHTML = rows || '<tr><td colspan="4" class="empty-td">No models</td></tr>';
  } catch (e) {
    $("modelRows").innerHTML = \`<tr><td colspan="4">\${e.message}</td></tr>\`;
  }
}

/* ─── Refresh admin data (auth required) ─────────────────── */
async function refreshAdmin() {
  if (!getToken()) return;

  let users, clients, keys, policies, audit, usage, registry, routingRules, providerHealth, usageSummary, recentHealth, controlCenter;
  try {
    const params = new URLSearchParams();
    params.set("page", String(auditPage));
    params.set("limit", "50");
    if (auditFilters.status) params.set("status", auditFilters.status);
    if (auditFilters.model) params.set("model", auditFilters.model);
    if (auditFilters.from) params.set("from", auditFilters.from);
    if (auditFilters.to) params.set("to", auditFilters.to);

    [users, clients, keys, policies, audit, usage, registry, routingRules, providerHealth, usageSummary, recentHealth, controlCenter] = await Promise.all([
      fetchJson("/admin/api/users"),
      fetchJson("/admin/api/clients"),
      fetchJson("/admin/api/api-keys"),
      fetchJson("/admin/api/policies"),
      fetchJson("/admin/api/audit-logs?" + params.toString()),
      fetchJson("/admin/api/usage/daily"),
      fetchJson("/admin/api/model-registry"),
      fetchJson("/admin/api/routing-rules"),
      fetchJson("/admin/api/provider-health"),
      fetchJson("/admin/api/usage/summary?groupBy=client&days=7"),
      fetchJson("/admin/api/provider-health/recent"),
      fetchJson("/admin/api/control-center")
    ]);
  } catch (e) {
    toast("Failed to load admin data: " + e.message, "error");
    return;
  }

  adminDataCache = {
    users: users.data || [],
    clients: clients.data || [],
    keys: keys.data || [],
    policies: policies.data || [],
    control: controlCenter.data || null
  };
  renderControlCenter(adminDataCache.control);

  // Users
  $("userRows").innerHTML = users.data.map(u => \`<tr>
    <td><code>\${u.id}</code><br><span class="muted">\${u.email}</span></td>
    <td>\${u.name}</td>
    <td>\${u.role}</td>
    <td>\${u.status === "active" ? '<span class="pill ok">active</span>' : '<span class="pill bad">suspended</span>'}</td>
    <td>
      <button class="button ghost small" data-view-user="\${u.id}">Inspect</button>
      <button class="button ghost small" data-user-status="\${u.id}" data-status="\${u.status === "active" ? "suspended" : "active"}">
        \${u.status === "active" ? "Suspend" : "Activate"}
      </button>
    </td>
  </tr>\`).join("") || '<tr><td colspan="5" class="empty-td">No users</td></tr>';

  // Clients
  $("clientRows").innerHTML = clients.data.map(c => \`<tr>
    <td><code>\${c.id}</code><br><span class="muted">\${c.name}</span></td>
    <td>\${c.type}</td>
    <td><code>\${c.owner_user_id}</code></td>
    <td>\${c.status === "active" ? '<span class="pill ok">active</span>' : '<span class="pill bad">suspended</span>'}</td>
    <td>
      <button class="button ghost small" data-client-status="\${c.id}" data-status="\${c.status === "active" ? "suspended" : "active"}">
        \${c.status === "active" ? "Suspend" : "Activate"}
      </button>
    </td>
  </tr>\`).join("") || '<tr><td colspan="5" class="empty-td">No clients</td></tr>';

  // Keys
  $("keyRows").innerHTML = keys.data.map(k => \`<tr>
    <td>\${k.name}<br><code>\${k.id}</code></td>
    <td><code>\${k.key_prefix}</code></td>
    <td><code>\${k.user_id}</code></td>
    <td><code>\${k.client_id}</code></td>
    <td>\${k.status === "active" ? '<span class="pill ok">active</span>' : '<span class="pill bad">revoked</span>'}</td>
    <td class="muted">\${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "-"}</td>
    <td>
      <button class="button ghost small" data-revoke="\${k.id}">Revoke</button>
      <button class="button ghost small" data-rotate="\${k.id}">Rotate</button>
    </td>
  </tr>\`).join("") || '<tr><td colspan="7" class="empty-td">No keys</td></tr>';

  // Policies
  $("policyRows").innerHTML = policies.data.map(p => \`<tr>
    <td>\${p.scope_type}:<code>\${p.scope_id}</code></td>
    <td><code>\${JSON.parse(p.allowed_models).join(", ")}</code></td>
    <td>\${JSON.parse(p.allowed_task_types).join(", ")}</td>
    <td>\${p.rate_limit_per_minute}/min</td>
    <td>\${p.max_input_characters.toLocaleString()}</td>
  </tr>\`).join("") || '<tr><td colspan="5" class="empty-td">No policies</td></tr>';

  // Audit logs (paginated shape: { data, total, page, pages, limit })
  $("auditRows").innerHTML = (audit.data || []).map(a => \`<tr>
    <td class="muted">\${new Date(a.created_at).toLocaleString()}</td>
    <td><code>\${a.client_id || "-"}</code></td>
    <td>\${a.model || "-"}</td>
    <td>\${a.provider || "-"}</td>
    <td>\${a.status === "ok" ? '<span class="pill ok">ok</span>' : '<span class="pill bad">error</span>'}</td>
    <td class="muted">\${a.latency_ms ? a.latency_ms + "ms" : "-"}</td>
  </tr>\`).join("") || '<tr><td colspan="6" class="empty-td">No logs</td></tr>';

  // Audit pagination controls
  const auditPages = audit.pages || 1;
  const auditTotal = audit.total || 0;
  setText("auditPageInfo", "Page " + (audit.page || 1) + " of " + auditPages + " (" + auditTotal + " total)");
  const prevBtn = $("auditPrevBtn");
  const nextBtn = $("auditNextBtn");
  if (prevBtn) prevBtn.disabled = (audit.page || 1) <= 1;
  if (nextBtn) nextBtn.disabled = (audit.page || 1) >= auditPages;

  // Recent provider health (Overview)
  const recentList = $("recentProviderHealth");
  if (recentList) {
    const rows = (recentHealth && recentHealth.data) || [];
    if (!rows.length) {
      recentList.innerHTML = '<div class="empty-state">No recent activity.</div>';
    } else {
      recentList.innerHTML = rows.map(r => {
        const rate = r.success_rate;
        const cls = rate >= 95 ? "health-good" : rate >= 80 ? "health-warn" : "health-bad";
        const lastErr = r.last_error_at ? new Date(r.last_error_at).toLocaleString() : "—";
        return \`<div class="provider-health-card">
          <div class="ph-title">
            <strong>\${providerLabels[r.provider] || r.provider}</strong>
            <span class="pill \${cls}">\${rate}%</span>
          </div>
          <small class="muted">\${r.total} reqs · \${r.errors} errors</small>
          <small class="muted">avg \${r.avg_latency_ms}ms</small>
          <small class="muted">last error: \${lastErr}</small>
        </div>\`;
      }).join("");
    }
  }

  // Usage
  $("usageRows").innerHTML = usage.data.map(u => \`<tr>
    <td>\${u.date}</td>
    <td><code>\${u.client_id || "-"}</code></td>
    <td>\${u.model || "-"}</td>
    <td>\${u.request_count}</td>
    <td>\${((u.input_tokens || 0) + (u.output_tokens || 0)).toLocaleString()}</td>
  </tr>\`).join("") || '<tr><td colspan="5" class="empty-td">No usage data</td></tr>';

  $("usageSummaryRows").innerHTML = usageSummary.data.map(u => \`<tr>
    <td><code>\${u.bucket || "-"}</code></td>
    <td>\${u.request_count}</td>
    <td>\${(u.input_tokens || 0).toLocaleString()}</td>
    <td>\${(u.output_tokens || 0).toLocaleString()}</td>
    <td>\${Number(u.estimated_cost || 0).toFixed(6)}</td>
  </tr>\`).join("") || '<tr><td colspan="5" class="empty-td">No summary</td></tr>';

  // Usage count for overview
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = usage.data.filter(u => u.date === today);
  const todayReqs = todayRows.reduce((s, u) => s + (u.request_count || 0), 0);
  setText("usageCount", String(todayReqs));

  // Registry
  $("registryRows").innerHTML = registry.data.map(m => \`<tr>
    <td>
      <label class="check">
        <input type="checkbox" data-reg-enabled="\${m.id}" \${m.enabled ? "checked" : ""} />
        <span>on</span>
      </label>
    </td>
    <td><code>\${m.provider_model}</code><br><span class="muted">\${m.provider}</span></td>
    <td><input data-reg-tasks="\${m.id}" value="\${m.task_types.join(",")}" style="min-width:140px" /></td>
    <td><input data-reg-tags="\${m.id}" value="\${m.tags.join(",")}" style="min-width:100px" /></td>
    <td><input type="number" min="0" max="200" data-reg-priority="\${m.id}" value="\${m.priority}" style="min-width:70px" /></td>
    <td class="muted">\${m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString() : "-"}</td>
    <td><button class="button ghost small" data-reg-save="\${m.id}">Save</button></td>
  </tr>\`).join("") || '<tr><td colspan="7" class="empty-td">No registry data</td></tr>';

  $("routingRows").innerHTML = routingRules.data.map(r => \`<tr>
    <td>\${r.scope_type}:<code>\${r.scope_id}</code></td>
    <td>\${r.capability}</td>
    <td>\${r.provider}</td>
    <td><code>\${r.provider_model}</code></td>
    <td>\${r.cost_tier || "-"}</td>
    <td>\${r.priority}</td>
    <td>\${r.enabled ? '<span class="pill ok">enabled</span>' : '<span class="pill bad">off</span>'}</td>
  </tr>\`).join("") || '<tr><td colspan="7" class="empty-td">No routing rules</td></tr>';

  $("providerHealthRows").innerHTML = providerHealth.data.map(p => \`<tr>
    <td>\${p.provider}</td>
    <td>\${p.total}</td>
    <td>\${p.enabled}</td>
    <td>\${p.healthy}</td>
    <td>\${p.degraded}</td>
    <td>\${p.down}</td>
    <td>\${p.unknown}</td>
    <td>\${p.error_count}</td>
  </tr>\`).join("") || '<tr><td colspan="8" class="empty-td">No provider health data</td></tr>';
}

/* ─── Full refresh ───────────────────────────────────────── */
async function refresh() {
  setRefreshing(true);
  try {
    await refreshPublic();
    if (getToken()) await refreshAdmin();
    setText("lastUpdated", "Updated " + new Date().toLocaleTimeString());
  } finally {
    setRefreshing(false);
  }
}

/* ─── Boot ───────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  // Restore saved token
  const saved = sessionStorage.getItem("gatewayAdminToken");
  if (saved && $("adminTokenInput")) $("adminTokenInput").value = saved;
  const savedKey = localStorage.getItem("gatewayAdminApiKey");
  if (savedKey && $("apiKeyInput")) $("apiKeyInput").value = savedKey;
  updateAuthUI();

  // Hash-based routing
  function routeFromHash() {
    const hash = location.hash.replace("#", "") || "overview";
    const valid = Object.keys(PAGE_TITLES);
    navigate(valid.includes(hash) ? hash : "overview");
  }
  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();

  // Nav click — prevent default scroll, use SPA routing
  document.querySelectorAll(".nav-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      navigate(a.dataset.page);
    });
  });

  // Refresh button
  $("refreshButton")?.addEventListener("click", refresh);

  // Login button
  $("loginButton")?.addEventListener("click", async () => {
    const tok = ($("adminTokenInput")?.value || "").trim();
    if (!tok) { toast("Enter an admin token first", "warn"); return; }
    try {
      await fetchJson("/admin/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminToken: tok })
      });
      sessionStorage.setItem("gatewayAdminToken", tok);
      updateAuthUI();
      toast("Logged in successfully", "ok");
      refresh();
    } catch (e) {
      toast("Login failed: " + e.message, "error");
    }
  });

  // Logout button
  $("logoutButton")?.addEventListener("click", async () => {
    try {
      await fetchJson("/admin/api/logout", { method: "POST" });
    } catch (_) { /* ignore */ }
    sessionStorage.removeItem("gatewayAdminToken");
    if ($("adminTokenInput")) $("adminTokenInput").value = "";
    updateAuthUI();
    toast("Logged out", "ok");
  });

  // Scan models
  $("scanModelsButton")?.addEventListener("click", async () => {
    setText("lastUpdated", "Scanning 9router models…");
    try {
      const r = await postJson("/admin/api/model-registry/scan", {});
      toast("Scanned " + r.scanned + " model(s) from 9router", "ok");
      refresh();
    } catch (e) {
      toast("Scan failed: " + e.message, "error");
    }
  });

  // Create user
  $("userForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await postJson("/admin/api/users", formData(e.target));
      e.target.reset();
      toast("User created successfully", "ok");
      refresh();
    } catch (err) {
      toast("Create user failed: " + err.message, "error");
    }
  });

  // Create client
  $("clientForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    try {
      await postJson("/admin/api/clients", { name: o.name, type: o.type, ownerUserId: o.ownerUserId });
      e.target.reset();
      toast("Client created successfully", "ok");
      refresh();
    } catch (err) {
      toast("Create client failed: " + err.message, "error");
    }
  });

  // Create API key
  $("keyForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    try {
      const r = await postJson("/admin/api/api-keys", {
        userId: o.userId,
        clientId: o.clientId,
        name: o.name,
        mode: o.mode,
        expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null
      });
      $("newKeyOutput").textContent = json(r.data);
      e.target.reset();
      toast("API key created — copy the raw key now, it will not be shown again", "warn", 7000);
      refresh();
    } catch (err) {
      toast("Create key failed: " + err.message, "error");
    }
  });

  // Policy dialog
  const policyDialog = $("policyDialog");
  $("newPolicyButton")?.addEventListener("click", () => policyDialog?.showModal());
  $("closePolicyDialog")?.addEventListener("click", () => policyDialog?.close());
  $("cancelPolicyDialog")?.addEventListener("click", () => policyDialog?.close());
  document.querySelectorAll("#policyTaskBuilder input").forEach(input => {
    input.addEventListener("change", syncPolicyTaskBuilder);
  });

  // Save policy form
  $("policyForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    try {
      await fetchJson("/admin/api/policies", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scopeType: o.scopeType,
          scopeId: o.scopeId,
          allowedModels: csv(o.allowedModels),
          allowedTaskTypes: csv(o.allowedTaskTypes),
          allowedProviders: selectedBuilderValues("policyProviderBuilder"),
          allowedCostTiers: selectedBuilderValues("policyCostBuilder"),
          rateLimitPerMinute: Number(o.rateLimitPerMinute),
          maxInputCharacters: Number(o.maxInputCharacters),
          allowTools: !!o.allowTools,
          logPrompts: !!o.logPrompts
        })
      });
      policyDialog?.close();
      toast("Policy saved successfully", "ok");
      refresh();
    } catch (err) {
      toast("Save policy failed: " + err.message, "error");
    }
  });

  $("routingRuleForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    try {
      await fetchJson("/admin/api/routing-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scopeType: o.scopeType,
          scopeId: o.scopeId,
          capability: o.capability,
          provider: o.provider,
          providerModel: o.providerModel,
          costTier: o.costTier,
          priority: Number(o.priority || 100),
          enabled: true
        })
      });
      toast("Routing rule saved", "ok");
      refresh();
    } catch (err) {
      toast("Save routing rule failed: " + err.message, "error");
    }
  });

  $("routingDryRunForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    try {
      const result = await postJson("/admin/api/routing/dry-run", {
        apiKeyId: o.apiKeyId,
        model: o.model || "auto",
        taskType: o.taskType || "chat"
      });
      $("routingDryRunOutput").textContent = json(result.data);
      toast("Dry-run complete", "ok");
    } catch (err) {
      $("routingDryRunOutput").textContent = json(err.payload || { error: err.message, status: err.status });
      toast("Dry-run failed: " + err.message, "error");
    }
  });

  $("providerOpsForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const o = formData(e.target);
    const payload = {
      provider: o.provider,
      reason: o.reason
    };
    if (o.enabled === "true") payload.enabled = true;
    if (o.enabled === "false") payload.enabled = false;
    if (o.priority !== "") payload.priority = Number(o.priority);
    try {
      const result = await fetchJson("/admin/api/provider-ops", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      $("providerOpsOutput").textContent = json(result.data);
      toast("Provider operation applied", "ok");
      refresh();
    } catch (err) {
      $("providerOpsOutput").textContent = json(err.payload || { error: err.message, status: err.status });
      toast("Provider operation failed: " + err.message, "error");
    }
  });

  // Console form
  $("chatForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const apiKey = ($("apiKeyInput")?.value || "").trim();
    const prompt = ($("promptInput")?.value || "").trim();
    if (!apiKey || !prompt) {
      toast("API key and prompt are required", "warn");
      return;
    }
    localStorage.setItem("gatewayAdminApiKey", apiKey);
    setText("consoleStatus", "Sending…");
    $("responseOutput").textContent = "Waiting…";
    try {
      const task = $("taskInput")?.value;
      const isImage = task === "image-generation" || task === "image-edit";
      const model = $("modelInput")?.value;
      const p = await fetchJson(isImage ? "/v1/images/generations" : "/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(isImage
          ? { model, task_type: task, prompt, metadata: { source: "admin-console" } }
          : { model, task_type: task, messages: [{ role: "user", content: prompt }], metadata: { source: "admin-console" } }
        )
      });
      $("responseOutput").textContent = json(p);
      setText("consoleStatus", "Request complete");
      toast("Request completed", "ok");
      refresh();
    } catch (err) {
      $("responseOutput").textContent = json(err.payload || { error: err.message, status: err.status });
      setText("consoleStatus", "Request failed");
      toast("Request failed: " + err.message, "error");
    }
  });

  // Clear output
  $("clearButton")?.addEventListener("click", () => {
    $("responseOutput").textContent = "No request sent yet.";
    setText("consoleStatus", "");
  });

  // Event delegation — table action buttons
  document.body.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-revoke], button[data-rotate], button[data-user-status], button[data-client-status], button[data-reg-save], button[data-view-user]");
    if (!btn) return;

    if (btn.dataset.viewUser) {
      renderUserDetail(btn.dataset.viewUser);
      return;
    }
    if (btn.dataset.revoke) {
      try {
        await postJson("/admin/api/api-keys/" + btn.dataset.revoke + "/revoke", {});
        toast("Key revoked", "ok");
        refresh();
      } catch (err) {
        toast("Revoke failed: " + err.message, "error");
      }
    }
    if (btn.dataset.rotate) {
      try {
        const r = await postJson("/admin/api/api-keys/" + btn.dataset.rotate + "/rotate", {});
        $("newKeyOutput").textContent = json(r.data);
        navigate("keys");
        toast("Key rotated — copy the new raw key from the output above", "warn", 7000);
        refresh();
      } catch (err) {
        toast("Rotate failed: " + err.message, "error");
      }
    }
    if (btn.dataset.userStatus) {
      try {
        await fetchJson("/admin/api/users/" + btn.dataset.userStatus, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: btn.dataset.status })
        });
        toast("User status updated", "ok");
        refresh();
      } catch (err) {
        toast("Update failed: " + err.message, "error");
      }
    }
    if (btn.dataset.clientStatus) {
      try {
        await fetchJson("/admin/api/clients/" + btn.dataset.clientStatus, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: btn.dataset.status })
        });
        toast("Client status updated", "ok");
        refresh();
      } catch (err) {
        toast("Update failed: " + err.message, "error");
      }
    }
    if (btn.dataset.regSave) {
      const id = btn.dataset.regSave;
      const q = (attr) => document.querySelector("[data-reg-" + attr + "='" + id + "']");
      try {
        await fetchJson("/admin/api/model-registry", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id,
            enabled: q("enabled")?.checked,
            priority: Number(q("priority")?.value),
            taskTypes: csv(q("tasks")?.value),
            tags: csv(q("tags")?.value)
          })
        });
        toast("Registry row saved", "ok");
        refresh();
      } catch (err) {
        toast("Save failed: " + err.message, "error");
      }
    }
  });

  // Audit filter form
  $("auditFilterForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const o = formData(e.target);
    auditFilters = {
      status: o.status || "",
      model: o.model || "",
      from: o.from || "",
      to: o.to || ""
    };
    auditPage = 1;
    refreshAdmin();
  });
  $("auditFilterReset")?.addEventListener("click", () => {
    auditFilters = {};
    auditPage = 1;
    const f = $("auditFilterForm");
    if (f) f.reset();
    refreshAdmin();
  });
  $("auditPrevBtn")?.addEventListener("click", () => {
    if (auditPage > 1) { auditPage -= 1; refreshAdmin(); }
  });
  $("auditNextBtn")?.addEventListener("click", () => {
    auditPage += 1; refreshAdmin();
  });

  // Period selector (analytics)
  document.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      analyticsDays = parseInt(btn.getAttribute("data-days") || "7", 10);
      loadAnalytics();
    });
  });

  // Analytics loader hook on nav (Analytics page)
  document.querySelectorAll('.nav-item[data-page="analytics"]').forEach(a => {
    a.addEventListener("click", () => {
      if (getToken()) loadAnalytics();
    });
  });

  // Initial load
  refresh();
});

/* ─── Analytics ─────────────────────────────────────────── */
async function loadAnalytics() {
  try {
    const data = await fetchJson("/admin/api/analytics/overview?days=" + analyticsDays);
    renderAnalyticsSummary(data);
    renderLineChart("chart-requests-by-day", data.by_date, "date", "request_count", "#0f766e");
    renderBarChart("chart-by-provider", data.by_provider, "provider", "request_count", "#0d9488");
    renderBarChart("chart-by-model", data.by_model, "model", "request_count", "#14b8a6");
  } catch (e) {
    toast("Failed to load analytics: " + e.message, "error");
  }
}

function renderAnalyticsSummary(data) {
  let totalReqs = 0, totalIn = 0, totalOut = 0, totalCost = 0;
  (data.by_date || []).forEach(r => {
    totalReqs += Number(r.request_count) || 0;
    totalIn += Number(r.input_tokens) || 0;
    totalOut += Number(r.output_tokens) || 0;
    totalCost += Number(r.estimated_cost) || 0;
  });
  setText("an-total-requests", totalReqs.toLocaleString());
  setText("an-total-tokens", (totalIn + totalOut).toLocaleString());
  setText("an-total-cost", "$" + totalCost.toFixed(4));
  setText("an-avg-latency", "—");
}

function renderLineChart(containerId, rows, xKey, yKey, color) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0;font-size:13px;">No data</p>';
    return;
  }

  const W = 400, H = 140, PAD = { top: 10, right: 10, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = rows.map(r => Number(r[yKey]) || 0);
  const maxVal = Math.max.apply(null, values) || 1;
  const n = rows.length;

  const points = rows.map((r, i) => {
    const x = PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = PAD.top + innerH - ((Number(r[yKey]) || 0) / maxVal) * innerH;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");

  let xLabels = "";
  [0, Math.floor(n / 2), n - 1].forEach(i => {
    if (i >= 0 && i < n) {
      const x = PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const label = String(rows[i][xKey] || "").slice(-5);
      xLabels += '<text x="' + x.toFixed(0) + '" y="' + (H - 4) + '" text-anchor="middle" fill="var(--muted)" font-size="10">' + label + '</text>';
    }
  });

  const yLabel = '<text x="' + (PAD.left - 4) + '" y="' + (PAD.top + 4) + '" text-anchor="end" fill="var(--muted)" font-size="10">' + maxVal + '</text>';

  const areaPoints = "M " + PAD.left + "," + (PAD.top + innerH) + " L " + rows.map((r, i) => {
    const x = PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = PAD.top + innerH - ((Number(r[yKey]) || 0) / maxVal) * innerH;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" L ") + " L " + (PAD.left + innerW) + "," + (PAD.top + innerH) + " Z";

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px" preserveAspectRatio="none">' +
    '<defs><linearGradient id="lg-' + containerId + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.2"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + areaPoints + '" fill="url(#lg-' + containerId + ')"/>' +
    '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    xLabels + yLabel +
    '</svg>';
}

function renderBarChart(containerId, rows, xKey, yKey, color) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sorted = (rows || []).slice().sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0)).slice(0, 8);
  if (!sorted.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0;font-size:13px;">No data</p>';
    return;
  }

  const W = 400, H = 140, PAD = { top: 10, right: 10, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = sorted.length;
  const barW = Math.max(innerW / n - 6, 8);
  const maxVal = Math.max.apply(null, sorted.map(r => Number(r[yKey]) || 0)) || 1;

  const bars = sorted.map((r, i) => {
    const x = PAD.left + i * (innerW / n) + (innerW / n - barW) / 2;
    const h = ((Number(r[yKey]) || 0) / maxVal) * innerH;
    const y = PAD.top + innerH - h;
    const label = String(r[xKey] || "").slice(0, 10);
    const valLabel = String(Number(r[yKey]) || 0);
    return '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + barW.toFixed(0) + '" height="' + Math.max(h, 2).toFixed(0) + '" fill="' + color + '" rx="2"/>' +
      '<text x="' + (x + barW / 2).toFixed(0) + '" y="' + (H - 4) + '" text-anchor="middle" fill="var(--muted)" font-size="9">' + label + '</text>' +
      (h > 16 ? '<text x="' + (x + barW / 2).toFixed(0) + '" y="' + (y - 3).toFixed(0) + '" text-anchor="middle" fill="var(--muted)" font-size="9">' + valLabel + '</text>' : '');
  }).join("");

  container.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px" preserveAspectRatio="none">' + bars + '</svg>';
}

/* ─── Webhooks ──────────────────────────────────────────── */
async function loadWebhooks() {
  try {
    const res = await fetchJson("/admin/api/webhooks");
    renderWebhooks(res.data || []);
  } catch (e) {
    toast("Failed to load webhooks: " + e.message, "error");
  }
}

function renderWebhooks(rows) {
  const tbody = document.getElementById("wh-tbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No webhooks configured</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function (r) {
    var events = [];
    try { events = JSON.parse(r.events) || []; } catch (e) { events = []; }
    var enabled = r.enabled ? "Enabled" : "Disabled";
    var lastT = r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : "—";
    return '<tr>' +
      '<td>' + escapeHtml(r.name) + '</td>' +
      '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(r.url) + '</td>' +
      '<td>' + escapeHtml(events.join(", ")) + '</td>' +
      '<td>' + enabled + '</td>' +
      '<td>' + lastT + '</td>' +
      '<td>' + (r.failure_count || 0) + '</td>' +
      '<td>' +
        '<button class="button ghost small" data-wh-toggle="' + r.id + '" data-wh-enabled="' + (r.enabled ? "1" : "0") + '" type="button">' + (r.enabled ? "Disable" : "Enable") + '</button> ' +
        '<button class="button ghost small" data-wh-delete="' + r.id + '" type="button">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join("");

  tbody.querySelectorAll("[data-wh-toggle]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var id = btn.getAttribute("data-wh-toggle");
      var enabled = btn.getAttribute("data-wh-enabled") === "1";
      try {
        await fetchJson("/admin/api/webhooks/" + id, { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) });
        loadWebhooks();
      } catch (e) {
        toast("Toggle failed: " + e.message, "error");
      }
    });
  });
  tbody.querySelectorAll("[data-wh-delete]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var id = btn.getAttribute("data-wh-delete");
      if (!confirm("Delete this webhook?")) return;
      try {
        await fetchJson("/admin/api/webhooks/" + id, { method: "DELETE" });
        loadWebhooks();
      } catch (e) {
        toast("Delete failed: " + e.message, "error");
      }
    });
  });
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('.nav-item[data-page="webhooks"]').forEach(function (a) {
    a.addEventListener("click", function () { if (getToken()) loadWebhooks(); });
  });

  var newBtn = document.getElementById("wh-new-btn");
  var form = document.getElementById("wh-form");
  var cancelBtn = document.getElementById("wh-cancel-btn");
  var createBtn = document.getElementById("wh-create-btn");
  if (newBtn && form) {
    newBtn.addEventListener("click", function () { form.classList.remove("hidden"); });
  }
  if (cancelBtn && form) {
    cancelBtn.addEventListener("click", function () { form.classList.add("hidden"); });
  }
  if (createBtn) {
    createBtn.addEventListener("click", async function () {
      var name = (document.getElementById("wh-name") || {}).value || "";
      var url = (document.getElementById("wh-url") || {}).value || "";
      var secret = (document.getElementById("wh-secret") || {}).value || "";
      var events = [];
      document.querySelectorAll(".wh-event-cb").forEach(function (cb) {
        if (cb.checked) events.push(cb.value);
      });
      if (!name || !url || events.length === 0) {
        toast("Name, URL, and at least one event required", "error");
        return;
      }
      try {
        var payload = { name: name, url: url, events: events };
        if (secret) payload.secret = secret;
        await fetchJson("/admin/api/webhooks", { method: "POST", body: JSON.stringify(payload) });
        if (form) form.classList.add("hidden");
        loadWebhooks();
        toast("Webhook created", "ok");
      } catch (e) {
        toast("Create failed: " + e.message, "error");
      }
    });
  }

  /* ─── Integration ──────────────────────────────────────── */
  document.querySelectorAll('.nav-item[data-page="integration"]').forEach(function (a) {
    a.addEventListener("click", function () {
      if (getToken()) loadIntegration();
    });
  });
  var sel = document.getElementById("int-client-select");
  if (sel) {
    sel.addEventListener("change", loadIntegration);
  }

  initOnboardWizard();
});

/* ─── Onboard wizard (wired in DOMContentLoaded below) ──── */
function initOnboardWizard() {
  var dialog = document.getElementById("onboardDialog");
  var form = document.getElementById("onboardForm");
  var result = document.getElementById("onboardResult");
  var actions = document.getElementById("onboardActions");
  var rawKeyEl = document.getElementById("onboardRawKey");
  var configEl = document.getElementById("onboardConfigOutput");

  function resetOnboard() {
    if (form) form.reset();
    if (result) result.classList.add("hidden");
    if (actions) actions.classList.remove("hidden");
    var keyNameInput = document.getElementById("ob-keyname");
    if (keyNameInput) keyNameInput.value = "default";
    var createPolicyInput = document.getElementById("ob-create-policy");
    if (createPolicyInput) createPolicyInput.checked = true;
    var allowedModelsInput = document.getElementById("ob-allowed-models");
    if (allowedModelsInput) allowedModelsInput.value = "auto,cheap-chat,strong-code,spa-assistant";
    var allowedTasksInput = document.getElementById("ob-allowed-tasks");
    if (allowedTasksInput) allowedTasksInput.value = "chat,coding,review,workflow,spa-chat";
    var rateLimitInput = document.getElementById("ob-rate-limit");
    if (rateLimitInput) rateLimitInput.value = "60";
    var maxInput = document.getElementById("ob-max-input");
    if (maxInput) maxInput.value = "60000";
    document.querySelectorAll("#ob-provider-builder input, #ob-cost-builder input").forEach(function (input) {
      input.checked = false;
    });
    if (rawKeyEl) rawKeyEl.textContent = "";
    if (configEl) configEl.textContent = "";
  }

  var btn = document.getElementById("onboardButton");
  if (btn) btn.addEventListener("click", function () {
    resetOnboard();
    if (dialog) dialog.showModal();
  });

  var closeBtn = document.getElementById("closeOnboardDialog");
  if (closeBtn) closeBtn.addEventListener("click", function () { if (dialog) dialog.close(); });

  var cancelBtn = document.getElementById("cancelOnboardDialog");
  if (cancelBtn) cancelBtn.addEventListener("click", function () { if (dialog) dialog.close(); });

  var doneBtn = document.getElementById("onboardDoneBtn");
  if (doneBtn) doneBtn.addEventListener("click", function () {
    if (dialog) dialog.close();
    refresh();
  });

  if (form) form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var submitBtn = document.getElementById("onboardSubmitBtn");
    if (submitBtn) submitBtn.disabled = true;
    try {
      var email = (document.getElementById("ob-email") || {}).value || "";
      var name = (document.getElementById("ob-name") || {}).value || "";
      var role = (document.getElementById("ob-role") || {}).value || "member";
      var keyName = (document.getElementById("ob-keyname") || {}).value || "default";
      var clientName = (document.getElementById("ob-client-name") || {}).value || "";
      var clientType = (document.getElementById("ob-client-type") || {}).value || "human";
      var keyMode = (document.getElementById("ob-key-mode") || {}).value || "live";
      var configClient = (document.getElementById("ob-config-client") || {}).value || "cursor";
      var createPolicy = !!((document.getElementById("ob-create-policy") || {}).checked);
      var allowedModels = csv((document.getElementById("ob-allowed-models") || {}).value || "auto");
      var allowedTaskTypes = csv((document.getElementById("ob-allowed-tasks") || {}).value || "chat");
      var allowedProviders = selectedBuilderValues("ob-provider-builder");
      var allowedCostTiers = selectedBuilderValues("ob-cost-builder");
      var rateLimitPerMinute = Number((document.getElementById("ob-rate-limit") || {}).value || 60);
      var maxInputCharacters = Number((document.getElementById("ob-max-input") || {}).value || 60000);
      var res = await fetchJson("/admin/api/onboard", {
        method: "POST",
        body: JSON.stringify({
          email: email,
          name: name,
          role: role,
          clientName: clientName || undefined,
          clientType: clientType,
          keyName: keyName,
          keyMode: keyMode,
          createPolicy: createPolicy,
          allowedModels: allowedModels,
          allowedTaskTypes: allowedTaskTypes,
          allowedProviders: allowedProviders,
          allowedCostTiers: allowedCostTiers,
          rateLimitPerMinute: rateLimitPerMinute,
          maxInputCharacters: maxInputCharacters,
          configClient: configClient
        })
      });
      var rawKey = (res && res.data && res.data.apiKey && res.data.apiKey.raw_key) || "";
      if (rawKeyEl) rawKeyEl.textContent = rawKey;
      if (configEl) configEl.textContent = json({
        user: res.data.user,
        client: res.data.client,
        policy: res.data.policy,
        config: res.data.clientConfig
      });
      if (result) result.classList.remove("hidden");
      if (actions) actions.classList.add("hidden");
      toast("User, key and config created", "ok");
    } catch (err) {
      toast("Onboard failed: " + err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  var copyBtn = document.getElementById("onboardCopyBtn");
  if (copyBtn) copyBtn.addEventListener("click", async function () {
    var key = rawKeyEl ? rawKeyEl.textContent : "";
    try {
      await navigator.clipboard.writeText(key);
      toast("Copied to clipboard", "ok");
    } catch (_) {
      toast("Copy failed — select manually", "warn");
    }
  });
}

async function loadIntegration() {
  var sel = document.getElementById("int-client-select");
  var out = document.getElementById("int-config-output");
  if (!sel || !out) return;
  try {
    var res = await fetchJson("/admin/api/client-config/" + sel.value);
    out.textContent = JSON.stringify(res.data, null, 2);
  } catch (e) {
    out.textContent = "Failed to load config: " + e.message;
  }
}
`;
