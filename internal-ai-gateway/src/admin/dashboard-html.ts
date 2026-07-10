export const adminHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Internal AI Gateway — Admin</title>
    <link rel="stylesheet" href="/admin/app.css" />
  </head>
  <body>
    <div class="shell" id="app">
      <aside class="sidebar" aria-label="Admin navigation">
        <div class="brand">
          <div class="brand-mark">AI</div>
          <div><strong>AI Gateway</strong><span>Admin console</span></div>
        </div>

        <nav class="nav" aria-label="Admin sections">
          <a href="#overview" class="nav-item active" data-page="overview" aria-current="page">
            <span class="nav-dot"></span>Overview
          </a>

          <div class="nav-group-label">Access</div>
          <a href="#users" class="nav-item" data-page="users"><span class="nav-dot"></span>Users</a>
          <a href="#clients" class="nav-item" data-page="clients"><span class="nav-dot"></span>Clients</a>
          <a href="#keys" class="nav-item" data-page="keys"><span class="nav-dot"></span>API Keys</a>
          <a href="#policies" class="nav-item" data-page="policies"><span class="nav-dot"></span>Policies</a>

          <div class="nav-group-label">System</div>
          <a href="#models" class="nav-item" data-page="models"><span class="nav-dot"></span>Models</a>
          <a href="#registry" class="nav-item" data-page="registry"><span class="nav-dot"></span>Registry</a>
          <a href="#routing" class="nav-item" data-page="routing"><span class="nav-dot"></span>Routing</a>
          <a href="#audit" class="nav-item" data-page="audit"><span class="nav-dot"></span>Audit &amp; Usage</a>
          <a href="#analytics" class="nav-item" data-page="analytics"><span class="nav-dot"></span>Analytics</a>
          <a href="#webhooks" class="nav-item" data-page="webhooks"><span class="nav-dot"></span>Webhooks</a>
          <a href="#integration" class="nav-item" data-page="integration"><span class="nav-dot"></span>Integration</a>

          <a href="#console" class="nav-item nav-item-console" data-page="console"><span class="nav-dot"></span>Console</a>
        </nav>

        <div class="sidebar-foot">
          <button class="button ghost small logout-btn" id="logoutButton" type="button">Logout</button>
        </div>
      </aside>

      <main class="main" id="mainContent">
        <!-- Top bar -->
        <header class="topbar">
          <div>
            <p class="kicker">Internal AI Gateway</p>
            <h1 id="pageTitle">Overview</h1>
          </div>
          <div class="topbar-actions">
            <div id="adminTokenSection" class="admin-token">
              <label>
                <span>Admin token</span>
                <input id="adminTokenInput" type="password" placeholder="ADMIN_TOKEN" autocomplete="off" />
              </label>
              <button class="button primary small" id="loginButton" type="button">Login</button>
            </div>
            <div id="sessionBadge" class="session-badge hidden">
              <span class="pill ok" id="sessionLabel">Authenticated</span>
            </div>
            <button class="button primary small" id="onboardButton" type="button">+ Onboard User</button>
            <button class="icon-button" id="refreshButton" type="button" title="Refresh data" aria-label="Refresh">
              <span id="refreshIcon">↻</span>
              <span id="refreshSpinner" class="spinner hidden" aria-hidden="true"></span>
            </button>
          </div>
        </header>

        <!-- OVERVIEW -->
        <section class="page" id="page-overview">
          <div class="status-grid">
            <article class="stat-card">
              <span class="label">Gateway</span>
              <strong id="gatewayStatus">Checking…</strong>
              <small id="gatewayDetail">/health</small>
            </article>
            <article class="stat-card">
              <span class="label">Providers</span>
              <strong id="providerCount">0</strong>
              <small id="providerDetail">configured</small>
            </article>
            <article class="stat-card">
              <span class="label">Models</span>
              <strong id="modelCount">0</strong>
              <small>routes</small>
            </article>
            <article class="stat-card accent">
              <span class="label">Daily usage</span>
              <strong id="usageCount">0</strong>
              <small>requests today</small>
            </article>
            <article class="stat-card">
              <span class="label">Error rate 24h</span>
              <strong id="ccErrorRate">0%</strong>
              <small id="ccLatency">p95 latency 0ms</small>
            </article>
            <article class="stat-card">
              <span class="label">Month cost</span>
              <strong id="ccMonthCost">$0.0000</strong>
              <small id="ccMonthUsage">0 requests</small>
            </article>
            <article class="stat-card">
              <span class="label">Active keys</span>
              <strong id="ccActiveKeys">0</strong>
              <small id="ccTotals">0 users · 0 clients</small>
            </article>
          </div>

          <div class="command-grid">
            <div class="panel">
              <div class="section-head">
                <div>
                  <h2>Alert Center</h2>
                  <p>Recent errors, quota warnings and admin actions.</p>
                </div>
              </div>
              <div class="alert-list" id="overviewAlerts">
                <div class="empty-state">No alerts.</div>
              </div>
            </div>
            <div class="panel">
              <div class="section-head">
                <div>
                  <h2>Top Clients</h2>
                  <p>Highest usage this month.</p>
                </div>
              </div>
              <div class="rank-list" id="topClientsList">
                <div class="empty-state">No usage yet.</div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Provider Readiness</h2>
                <p>Secrets and adapters reported by the gateway.</p>
              </div>
              <span id="lastUpdated" class="timestamp">Never updated</span>
            </div>
            <div class="provider-list" id="providerList">
              <div class="empty-state">Click Refresh to load data.</div>
            </div>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Provider Health (last 24h)</h2>
                <p>Computed from recent audit logs.</p>
              </div>
            </div>
            <div class="provider-health-list" id="recentProviderHealth">
              <div class="empty-state">No recent activity.</div>
            </div>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Model Routing</h2>
                <p>Aliases exposed to clients.</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Model</th><th>Provider</th><th>Provider model</th><th>Task types</th>
                  </tr>
                </thead>
                <tbody id="modelRows"><tr><td colspan="4" class="empty-td">No data</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- USERS -->
        <section class="page hidden" id="page-users">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Users</h2>
                <p>Create service users for internal apps.</p>
              </div>
            </div>
            <form id="userForm" class="inline-form" aria-label="Create user">
              <label>
                <span>Email</span>
                <input name="email" type="email" placeholder="user@example.com" required autocomplete="off" />
              </label>
              <label>
                <span>Name</span>
                <input name="name" placeholder="Display name" required autocomplete="off" />
              </label>
              <label>
                <span>Role</span>
                <select name="role">
                  <option value="service">service</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                  <option value="owner">owner</option>
                </select>
              </label>
              <div class="form-actions">
                <button class="button primary" type="submit">Create User</button>
              </div>
            </form>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>ID / Email</th><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody id="userRows"><tr><td colspan="5" class="empty-td">No users yet</td></tr></tbody>
              </table>
            </div>
            <div class="panel subtle-panel" id="userDetailPanel">
              <div class="section-head">
                <div>
                  <h2>User Detail</h2>
                  <p>Select a user to inspect keys, clients and current usage.</p>
                </div>
              </div>
              <div id="userDetailContent" class="detail-grid">
                <div class="empty-state">No user selected.</div>
              </div>
            </div>
          </div>
        </section>

        <!-- CLIENTS -->
        <section class="page hidden" id="page-clients">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Clients</h2>
                <p>Create clients representing internal applications.</p>
              </div>
            </div>
            <form id="clientForm" class="inline-form" aria-label="Create client">
              <label>
                <span>Client name</span>
                <input name="name" placeholder="My Service" required autocomplete="off" />
              </label>
              <label>
                <span>Owner user ID</span>
                <input name="ownerUserId" placeholder="usr_…" required autocomplete="off" />
              </label>
              <label>
                <span>Type</span>
                <select name="type">
                  <option value="service">service</option>
                  <option value="workflow">workflow</option>
                  <option value="spa-system">spa-system</option>
                  <option value="coding-tool">coding-tool</option>
                  <option value="human">human</option>
                </select>
              </label>
              <div class="form-actions">
                <button class="button primary" type="submit">Create Client</button>
              </div>
            </form>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>ID / Name</th><th>Type</th><th>Owner</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody id="clientRows"><tr><td colspan="5" class="empty-td">No clients yet</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- API KEYS -->
        <section class="page hidden" id="page-keys">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>API Keys</h2>
                <p>Create, revoke, and rotate gateway API keys. Raw keys are shown once.</p>
              </div>
            </div>
            <form id="keyForm" class="inline-form" aria-label="Create API key">
              <label>
                <span>User ID</span>
                <input name="userId" placeholder="usr_…" required autocomplete="off" />
              </label>
              <label>
                <span>Client ID</span>
                <input name="clientId" placeholder="cli_…" required autocomplete="off" />
              </label>
              <label>
                <span>Key name</span>
                <input name="name" placeholder="production-key" required autocomplete="off" />
              </label>
              <label>
                <span>Mode</span>
                <select name="mode">
                  <option value="live">live</option>
                  <option value="test">test</option>
                </select>
              </label>
              <label>
                <span>Expires at</span>
                <input name="expiresAt" type="datetime-local" autocomplete="off" />
              </label>
              <div class="form-actions wide">
                <button class="button primary" type="submit">Create Key</button>
              </div>
            </form>
            <pre class="secret-output" id="newKeyOutput" aria-live="polite">No new key created.</pre>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Name / ID</th><th>Prefix</th><th>User</th><th>Client</th><th>Status</th><th>Last Used</th><th>Actions</th></tr>
                </thead>
                <tbody id="keyRows"><tr><td colspan="7" class="empty-td">No keys yet</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- POLICIES -->
        <section class="page hidden" id="page-policies">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Policies</h2>
                <p>Policy priority: API key → client → user → global.</p>
              </div>
              <button class="button primary" id="newPolicyButton" type="button">+ New Policy</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Scope</th><th>Models</th><th>Tasks</th><th>Rate/min</th><th>Max input</th></tr>
                </thead>
                <tbody id="policyRows"><tr><td colspan="5" class="empty-td">No policies yet</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- MODELS -->
        <section class="page hidden" id="page-models">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Models</h2>
                <p>Model routing table — read only. Configure in model config files.</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Model alias</th><th>Provider</th><th>Provider model</th><th>Task types</th></tr>
                </thead>
                <tbody id="modelsPageRows"><tr><td colspan="4" class="empty-td">No data</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- REGISTRY -->
        <section class="page hidden" id="page-registry">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Model Registry</h2>
                <p>Scanned models from 9router. Smart routing uses enabled models by task type and priority.</p>
              </div>
              <button class="button primary" id="scanModelsButton" type="button">Scan 9router</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Enabled</th><th>Provider model</th><th>Tasks</th><th>Tags</th><th>Priority</th><th>Seen</th><th>Save</th></tr>
                </thead>
                <tbody id="registryRows"><tr><td colspan="7" class="empty-td">No registry data</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ROUTING -->
        <section class="page hidden" id="page-routing">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Routing Rules</h2>
                <p>Rules override model=auto per API key, client, user, or global scope.</p>
              </div>
            </div>
            <form id="routingRuleForm" class="inline-form" aria-label="Create routing rule">
              <label>
                <span>Scope type</span>
                <select name="scopeType">
                  <option value="global">global</option>
                  <option value="client">client</option>
                  <option value="user">user</option>
                  <option value="api_key">api_key</option>
                </select>
              </label>
              <label>
                <span>Scope ID</span>
                <input name="scopeId" value="global" placeholder="global / cli_… / usr_… / key_…" required autocomplete="off" />
              </label>
              <label>
                <span>Capability</span>
                <select name="capability">
                  <option value="chat">chat</option>
                  <option value="coding">coding</option>
                  <option value="review">review</option>
                  <option value="workflow">workflow</option>
                  <option value="spa-chat">spa-chat</option>
                  <option value="image-generation">image-generation</option>
                  <option value="vision">vision</option>
                  <option value="embedding">embedding</option>
                  <option value="speech-to-text">speech-to-text</option>
                  <option value="text-to-speech">text-to-speech</option>
                </select>
              </label>
              <label>
                <span>Provider model</span>
                <input name="providerModel" value="kr/claude-haiku-4.5" required autocomplete="off" />
              </label>
              <label>
                <span>Provider</span>
                <select name="provider">
                  <option value="9router">9router</option>
                  <option value="kiro-cli">kiro-cli</option>
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                </select>
              </label>
              <label>
                <span>Cost tier</span>
                <select name="costTier">
                  <option value="cheap">cheap</option>
                  <option value="balanced">balanced</option>
                  <option value="strong">strong</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <input name="priority" type="number" min="0" max="200" value="100" />
              </label>
              <div class="form-actions">
                <button class="button primary" type="submit">Save Rule</button>
              </div>
            </form>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Scope</th><th>Capability</th><th>Provider</th><th>Provider model</th><th>Tier</th><th>Priority</th><th>Status</th></tr>
                </thead>
                <tbody id="routingRows"><tr><td colspan="7" class="empty-td">No routing rules</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Routing Studio</h2>
                <p>Dry-run a request without calling providers. Use it before changing policies or routing rules.</p>
              </div>
            </div>
            <form id="routingDryRunForm" class="inline-form" aria-label="Routing dry run">
              <label>
                <span>API key ID</span>
                <input name="apiKeyId" placeholder="key_…" required autocomplete="off" />
              </label>
              <label>
                <span>Model</span>
                <input name="model" value="auto" required autocomplete="off" />
              </label>
              <label>
                <span>Task type</span>
                <select name="taskType">
                  <option value="chat">chat</option>
                  <option value="coding">coding</option>
                  <option value="review">review</option>
                  <option value="workflow">workflow</option>
                  <option value="spa-chat">spa-chat</option>
                  <option value="image-generation">image-generation</option>
                  <option value="vision">vision</option>
                </select>
              </label>
              <div class="form-actions">
                <button class="button primary" type="submit">Dry Run</button>
              </div>
            </form>
            <pre class="output compact-output" id="routingDryRunOutput">No dry-run yet.</pre>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Provider Health</h2>
                <p>Summary from model registry health status.</p>
              </div>
            </div>
            <form id="providerOpsForm" class="inline-form" aria-label="Provider operations">
              <label>
                <span>Provider</span>
                <select name="provider">
                  <option value="9router">9router</option>
                  <option value="kiro-cli">kiro-cli</option>
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                </select>
              </label>
              <label>
                <span>Enabled</span>
                <select name="enabled">
                  <option value="">No change</option>
                  <option value="true">Enable all models</option>
                  <option value="false">Disable all models</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <input name="priority" type="number" min="0" max="200" placeholder="No change" />
              </label>
              <label>
                <span>Reason</span>
                <input name="reason" placeholder="maintenance / cost control / incident" required autocomplete="off" />
              </label>
              <div class="form-actions wide">
                <button class="button primary" type="submit">Apply Provider Change</button>
              </div>
            </form>
            <pre class="output compact-output" id="providerOpsOutput">No provider operation yet.</pre>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Provider</th><th>Total</th><th>Enabled</th><th>Healthy</th><th>Degraded</th><th>Down</th><th>Unknown</th><th>Errors</th></tr>
                </thead>
                <tbody id="providerHealthRows"><tr><td colspan="8" class="empty-td">No provider health data</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- AUDIT & USAGE -->
        <section class="page hidden" id="page-audit">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Audit &amp; Usage</h2>
                <p>Recent request log and daily usage rollups.</p>
              </div>
            </div>
            <div>
              <h3 class="sub-heading">Usage Summary</h3>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>Client</th><th>Requests</th><th>Input</th><th>Output</th><th>Cost</th></tr>
                  </thead>
                  <tbody id="usageSummaryRows"><tr><td colspan="5" class="empty-td">No summary</td></tr></tbody>
                </table>
              </div>
            </div>
            <div class="two-col three-col-fluid">
              <div>
                <h3 class="sub-heading">Alert Center</h3>
                <div id="auditAlertList" class="alert-list">
                  <div class="empty-state">No alerts.</div>
                </div>
              </div>
              <div>
                <h3 class="sub-heading">Audit Logs</h3>
                <form id="auditFilterForm" class="inline-form audit-filter" aria-label="Filter audit logs">
                  <label>
                    <span>Status</span>
                    <select name="status">
                      <option value="">All</option>
                      <option value="ok">OK</option>
                      <option value="error">Error</option>
                    </select>
                  </label>
                  <label>
                    <span>Model</span>
                    <input name="model" placeholder="model name" autocomplete="off" />
                  </label>
                  <label>
                    <span>From</span>
                    <input name="from" type="date" />
                  </label>
                  <label>
                    <span>To</span>
                    <input name="to" type="date" />
                  </label>
                  <div class="form-actions">
                    <button class="button primary small" type="submit">Apply</button>
                    <button class="button ghost small" id="auditFilterReset" type="button">Reset</button>
                  </div>
                </form>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Time</th><th>Client</th><th>Model</th><th>Provider</th><th>Status</th><th>Latency</th></tr>
                    </thead>
                    <tbody id="auditRows"><tr><td colspan="6" class="empty-td">No logs</td></tr></tbody>
                  </table>
                </div>
                <div class="pagination" id="auditPagination">
                  <button class="button ghost small" id="auditPrevBtn" type="button" disabled>Prev</button>
                  <span id="auditPageInfo" class="muted">Page 1</span>
                  <button class="button ghost small" id="auditNextBtn" type="button" disabled>Next</button>
                </div>
              </div>
              <div>
                <h3 class="sub-heading">Daily Usage</h3>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Client</th><th>Model</th><th>Req</th><th>Tokens</th></tr>
                    </thead>
                    <tbody id="usageRows"><tr><td colspan="5" class="empty-td">No data</td></tr></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ANALYTICS -->
        <section class="page hidden" id="page-analytics">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Analytics</h2>
                <p>Request volume, top providers and models.</p>
              </div>
              <div class="period-selector">
                <button class="period-btn active" data-days="7" type="button">7d</button>
                <button class="period-btn" data-days="30" type="button">30d</button>
                <button class="period-btn" data-days="90" type="button">90d</button>
              </div>
            </div>

            <div class="analytics-cards">
              <div class="stat-card"><span class="label">Total Requests</span><strong id="an-total-requests">—</strong></div>
              <div class="stat-card"><span class="label">Total Tokens</span><strong id="an-total-tokens">—</strong></div>
              <div class="stat-card"><span class="label">Est. Cost</span><strong id="an-total-cost">—</strong></div>
              <div class="stat-card"><span class="label">Avg Latency</span><strong id="an-avg-latency">—</strong></div>
            </div>

            <div class="chart-row">
              <div class="chart-card">
                <h3 class="chart-title">Requests per Day</h3>
                <div id="chart-requests-by-day" class="chart-area"></div>
              </div>
              <div class="chart-card">
                <h3 class="chart-title">By Provider</h3>
                <div id="chart-by-provider" class="chart-area"></div>
              </div>
            </div>
            <div class="chart-row">
              <div class="chart-card chart-wide">
                <h3 class="chart-title">Top Models</h3>
                <div id="chart-by-model" class="chart-area"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- WEBHOOKS -->
        <section class="page hidden" id="page-webhooks">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Webhooks</h2>
                <p>Receive HTTP callbacks for key lifecycle, quota warnings, provider events.</p>
              </div>
              <button class="button primary" id="wh-new-btn" type="button">+ New Webhook</button>
            </div>

            <div id="wh-form" class="panel hidden" style="margin-top:12px">
              <h3>New Webhook</h3>
              <div class="form-row">
                <input id="wh-name" class="input" placeholder="Name" />
                <input id="wh-url" class="input" placeholder="https://hooks.example.com/..." />
              </div>
              <div class="form-row">
                <input id="wh-secret" class="input" placeholder="HMAC secret (optional)" />
              </div>
              <div class="form-row">
                <label class="form-label">Events:</label>
                <label><input type="checkbox" class="wh-event-cb" value="key.created" /> key.created</label>
                <label><input type="checkbox" class="wh-event-cb" value="key.revoked" /> key.revoked</label>
                <label><input type="checkbox" class="wh-event-cb" value="quota.warning" /> quota.warning</label>
                <label><input type="checkbox" class="wh-event-cb" value="provider.down" /> provider.down</label>
                <label><input type="checkbox" class="wh-event-cb" value="admin.action" /> admin.action</label>
              </div>
              <div class="form-actions">
                <button class="button primary" id="wh-create-btn" type="button">Create</button>
                <button class="button ghost" id="wh-cancel-btn" type="button">Cancel</button>
              </div>
            </div>

            <div class="table-wrap" style="margin-top:12px">
              <table id="wh-table" class="table">
                <thead>
                  <tr>
                    <th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Last triggered</th><th>Failures</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody id="wh-tbody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- INTEGRATION -->
        <section class="page hidden" id="page-integration">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Integration</h2>
                <p>Client configuration templates and TypeScript SDK.</p>
              </div>
            </div>
            <div class="form-row" style="margin-top:12px">
              <label>
                <span>Client</span>
                <select id="int-client-select">
                  <option value="claude-code">claude-code</option>
                  <option value="cursor">cursor</option>
                  <option value="n8n">n8n</option>
                  <option value="ai-spa">ai-spa</option>
                </select>
              </label>
              <a class="button ghost" id="sdk-download" href="/sdk/gateway-client.ts" download>Download SDK (gateway-client.ts)</a>
            </div>
            <pre class="output" id="int-config-output" aria-live="polite">Select a client to view configuration.</pre>
            <h3 style="margin-top:16px">SDK usage</h3>
            <pre class="output" id="sdk-usage-snippet">import { GatewayClient } from './gateway-client';

const client = new GatewayClient({
  baseUrl: 'http://localhost:8787',
  apiKey: 'gw_live_xxx',
});

const res = await client.chat([
  { role: 'user', content: 'Hello!' }
], { model: 'auto', taskType: 'chat' });

console.log(res.content);
</pre>
          </div>
        </section>

        <!-- CONSOLE -->
        <section class="page hidden" id="page-console">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Request Console</h2>
                <p>Send a controlled test request through /v1/chat.</p>
              </div>
            </div>
            <form id="chatForm" class="console-grid" aria-label="Test request">
              <label>
                <span>Client API key</span>
                <input id="apiKeyInput" type="password" autocomplete="off" placeholder="gw_live_…" />
              </label>
              <label>
                <span>Model</span>
                <select id="modelInput">
                  <option value="auto">auto</option>
                  <option value="cheap-chat">cheap-chat</option>
                  <option value="kiro-pro">kiro-pro</option>
                  <option value="strong-code">strong-code</option>
                  <option value="spa-assistant">spa-assistant</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="claude-sonnet">claude-sonnet</option>
                </select>
              </label>
              <label>
                <span>Task type</span>
                <select id="taskInput">
                  <option value="chat">chat</option>
                  <option value="spa-chat">spa-chat</option>
                  <option value="workflow">workflow</option>
                  <option value="review">review</option>
                  <option value="coding">coding</option>
                  <option value="test-generation">test-generation</option>
                  <option value="repo-analysis">repo-analysis</option>
                  <option value="vision">vision</option>
                  <option value="image-generation">image-generation</option>
                  <option value="image-edit">image-edit</option>
                  <option value="embedding">embedding</option>
                  <option value="rerank">rerank</option>
                  <option value="speech-to-text">speech-to-text</option>
                  <option value="text-to-speech">text-to-speech</option>
                </select>
              </label>
              <label class="wide">
                <span>Prompt</span>
                <textarea id="promptInput" rows="7">Check the current gateway status and list the next implementation risk.</textarea>
              </label>
              <div class="form-actions wide">
                <button class="button primary" type="submit">Send Test</button>
                <button class="button ghost" id="clearButton" type="button">Clear Output</button>
                <span id="consoleStatus" class="muted" aria-live="polite"></span>
              </div>
            </form>
            <pre class="output" id="responseOutput" aria-live="polite">No request sent yet.</pre>
          </div>
        </section>
      </main>
    </div>

    <!-- Onboard dialog modal -->
    <dialog class="modal" id="onboardDialog" aria-labelledby="onboardDialogTitle">
      <div class="modal-header">
        <h2 id="onboardDialogTitle">Onboard New User</h2>
        <button class="icon-button" id="closeOnboardDialog" type="button" aria-label="Close">✕</button>
      </div>
      <form id="onboardForm" class="policy-form" aria-label="Onboard user">
        <label>
          <span>Email</span>
          <input id="ob-email" name="email" type="email" placeholder="user@example.com" required autocomplete="off" />
        </label>
        <label>
          <span>Full name</span>
          <input id="ob-name" name="name" placeholder="Nguyen Van A" required autocomplete="off" />
        </label>
        <label>
          <span>Client name</span>
          <input id="ob-client-name" name="clientName" placeholder="Same as full name" autocomplete="off" />
        </label>
        <label>
          <span>Role</span>
          <select id="ob-role" name="role">
            <option value="member">member</option>
            <option value="service">service</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </label>
        <label>
          <span>Client type</span>
          <select id="ob-client-type" name="clientType">
            <option value="human">human</option>
            <option value="coding-tool">coding-tool</option>
            <option value="workflow">workflow</option>
            <option value="spa-system">spa-system</option>
            <option value="service">service</option>
          </select>
        </label>
        <label>
          <span>Key name <small class="muted">(label for this key)</small></span>
          <input id="ob-keyname" name="keyName" placeholder="default" value="default" required autocomplete="off" />
        </label>
        <label>
          <span>Key mode</span>
          <select id="ob-key-mode" name="keyMode">
            <option value="live">live</option>
            <option value="test">test</option>
          </select>
        </label>
        <label>
          <span>Config target</span>
          <select id="ob-config-client" name="configClient">
            <option value="cursor">Cursor</option>
            <option value="claude-code">Claude Code</option>
            <option value="n8n">n8n</option>
            <option value="ai-spa">AI Spa</option>
          </select>
        </label>
        <label class="check wide">
          <input id="ob-create-policy" name="createPolicy" type="checkbox" checked />
          <span>Create API-key policy</span>
        </label>
        <div class="builder-box wide">
          <span class="builder-title">Onboarding policy</span>
          <label>
            <span>Allowed models</span>
            <input id="ob-allowed-models" value="auto,cheap-chat,strong-code,spa-assistant" autocomplete="off" />
          </label>
          <label>
            <span>Allowed task types</span>
            <input id="ob-allowed-tasks" value="chat,coding,review,workflow,spa-chat" autocomplete="off" />
          </label>
          <div class="builder-checks" id="ob-provider-builder">
            <label class="check"><input type="checkbox" value="9router" /> <span>9router</span></label>
            <label class="check"><input type="checkbox" value="kiro-cli" /> <span>kiro-cli</span></label>
            <label class="check"><input type="checkbox" value="openai" /> <span>openai</span></label>
            <label class="check"><input type="checkbox" value="anthropic" /> <span>anthropic</span></label>
          </div>
          <div class="builder-checks" id="ob-cost-builder">
            <label class="check"><input type="checkbox" value="cheap" /> <span>cheap</span></label>
            <label class="check"><input type="checkbox" value="balanced" /> <span>balanced</span></label>
            <label class="check"><input type="checkbox" value="strong" /> <span>strong</span></label>
          </div>
        </div>
        <label>
          <span>Rate limit / min</span>
          <input id="ob-rate-limit" type="number" min="1" value="60" />
        </label>
        <label>
          <span>Max input chars</span>
          <input id="ob-max-input" type="number" min="1" value="60000" />
        </label>
        <div class="form-actions wide" id="onboardActions">
          <button class="button primary" type="submit" id="onboardSubmitBtn">Create User, Key &amp; Policy</button>
          <button class="button ghost" id="cancelOnboardDialog" type="button">Cancel</button>
        </div>
        <div id="onboardResult" class="onboard-result hidden">
          <p class="onboard-result-label">Key and config created — copy now, raw key is shown only once:</p>
          <pre id="onboardRawKey" class="secret-output"></pre>
          <pre id="onboardConfigOutput" class="output compact-output"></pre>
          <div class="form-actions wide">
            <button class="button primary" id="onboardCopyBtn" type="button">Copy Key</button>
            <button class="button ghost" id="onboardDoneBtn" type="button">Done</button>
          </div>
        </div>
      </form>
    </dialog>

    <!-- Policy dialog modal -->
    <dialog class="modal" id="policyDialog" aria-labelledby="policyDialogTitle">
      <div class="modal-header">
        <h2 id="policyDialogTitle">New Policy</h2>
        <button class="icon-button" id="closePolicyDialog" type="button" aria-label="Close dialog">✕</button>
      </div>
      <form id="policyForm" class="policy-form" method="dialog" aria-label="Policy form">
        <label>
          <span>Scope type</span>
          <select name="scopeType">
            <option value="api_key">api_key</option>
            <option value="client">client</option>
            <option value="user">user</option>
            <option value="global">global</option>
          </select>
        </label>
        <label>
          <span>Scope ID</span>
          <input name="scopeId" placeholder="key_… / cli_… / usr_… / global" required autocomplete="off" />
        </label>
        <label>
          <span>Allowed models <small class="muted">(comma-separated)</small></span>
          <input name="allowedModels" placeholder="auto,cheap-chat,kiro-pro" required />
        </label>
        <label>
          <span>Allowed task types <small class="muted">(comma-separated)</small></span>
          <input name="allowedTaskTypes" placeholder="chat,coding,workflow" required />
        </label>
        <div class="builder-box wide">
          <span class="builder-title">Task presets</span>
          <div class="builder-checks" id="policyTaskBuilder">
            <label class="check"><input type="checkbox" value="chat" /> <span>chat</span></label>
            <label class="check"><input type="checkbox" value="coding" /> <span>coding</span></label>
            <label class="check"><input type="checkbox" value="review" /> <span>review</span></label>
            <label class="check"><input type="checkbox" value="workflow" /> <span>workflow</span></label>
            <label class="check"><input type="checkbox" value="spa-chat" /> <span>spa-chat</span></label>
            <label class="check"><input type="checkbox" value="image-generation" /> <span>image</span></label>
            <label class="check"><input type="checkbox" value="vision" /> <span>vision</span></label>
            <label class="check"><input type="checkbox" value="speech-to-text" /> <span>speech-to-text</span></label>
            <label class="check"><input type="checkbox" value="text-to-speech" /> <span>text-to-speech</span></label>
          </div>
        </div>
        <div class="builder-box wide">
          <span class="builder-title">Provider and cost guardrails</span>
          <div class="builder-checks" id="policyProviderBuilder">
            <label class="check"><input type="checkbox" value="9router" /> <span>9router</span></label>
            <label class="check"><input type="checkbox" value="kiro-cli" /> <span>kiro-cli</span></label>
            <label class="check"><input type="checkbox" value="openai" /> <span>openai</span></label>
            <label class="check"><input type="checkbox" value="anthropic" /> <span>anthropic</span></label>
          </div>
          <div class="builder-checks" id="policyCostBuilder">
            <label class="check"><input type="checkbox" value="cheap" /> <span>cheap</span></label>
            <label class="check"><input type="checkbox" value="balanced" /> <span>balanced</span></label>
            <label class="check"><input type="checkbox" value="strong" /> <span>strong</span></label>
          </div>
          <small class="muted">Leave provider or cost unchecked to allow all.</small>
        </div>
        <label>
          <span>Rate limit / min</span>
          <input name="rateLimitPerMinute" type="number" min="1" value="60" required />
        </label>
        <label>
          <span>Max input chars</span>
          <input name="maxInputCharacters" type="number" min="1" value="60000" required />
        </label>
        <label class="check">
          <input name="allowTools" type="checkbox" />
          <span>Allow tools</span>
        </label>
        <label class="check">
          <input name="logPrompts" type="checkbox" />
          <span>Log prompts</span>
        </label>
        <div class="form-actions wide">
          <button class="button primary" type="submit">Save Policy</button>
          <button class="button ghost" id="cancelPolicyDialog" type="button">Cancel</button>
        </div>
      </form>
    </dialog>

    <!-- Toast container -->
    <div class="toast-container" id="toastContainer" aria-live="polite" aria-atomic="true"></div>

    <script src="/admin/app.js?v=2" type="module"></script>
  </body>
</html>`;
