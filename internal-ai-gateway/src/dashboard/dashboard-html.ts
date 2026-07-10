export const dashboardHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Gateway — Dashboard</title>
    <link rel="stylesheet" href="/dashboard/app.css" />
  </head>
  <body>

    <!-- Auth screen (shown when no API key stored) -->
    <div id="authScreen" class="auth-screen hidden">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark">AI</div>
          <div>
            <strong>AI Gateway</strong>
            <span>User Dashboard</span>
          </div>
        </div>
        <h1>Kết nối tài khoản</h1>
        <p class="auth-desc">Nhập API key được cấp để cấu hình công cụ và sử dụng AI Gateway.</p>
        <form id="authForm" aria-label="Authenticate with API key">
          <label>
            <span>API key của bạn</span>
            <input
              id="authKeyInput"
              type="password"
              placeholder="gw_live_…"
              autocomplete="off"
              required
            />
          </label>
          <button class="button primary" type="submit">Tiếp tục</button>
          <p id="authError" class="auth-error hidden" role="alert"></p>
        </form>
      </div>
    </div>

    <!-- Main app (shown when authenticated) -->
    <div id="appShell" class="shell hidden">
      <aside class="sidebar" aria-label="Dashboard navigation">
        <div class="brand">
          <div class="brand-mark">AI</div>
          <div>
            <strong>AI Gateway</strong>
            <span>Dashboard</span>
          </div>
        </div>

        <div class="user-chip" id="userChip">
          <div class="user-avatar" id="userAvatar">?</div>
          <div class="user-info">
            <strong id="userName">Loading…</strong>
            <span id="userRole" class="muted">—</span>
          </div>
        </div>

        <nav class="nav" aria-label="Dashboard sections">
          <a href="#setup" class="nav-item active" data-page="setup" aria-current="page">
            <span class="nav-dot"></span>Bắt đầu
          </a>
          <a href="#overview" class="nav-item" data-page="overview">
            <span class="nav-dot"></span>Overview
          </a>
          <a href="#keys" class="nav-item" data-page="keys">
            <span class="nav-dot"></span>API Keys
          </a>
          <a href="#policy" class="nav-item" data-page="policy">
            <span class="nav-dot"></span>Policy
          </a>
          <a href="#models" class="nav-item" data-page="models">
            <span class="nav-dot"></span>Models
          </a>
          <a href="#logs" class="nav-item" data-page="logs">
            <span class="nav-dot"></span>Logs
          </a>
          <a href="#console" class="nav-item nav-item-console" data-page="console">
            <span class="nav-dot"></span>Console
          </a>
        </nav>

        <div class="sidebar-foot">
          <button class="button ghost small logout-btn" id="signOutButton" type="button">Sign out</button>
        </div>
      </aside>

      <main class="main" id="mainContent">
        <header class="topbar">
          <div>
            <p class="kicker">AI Gateway</p>
            <h1 id="pageTitle">Overview</h1>
          </div>
          <div class="topbar-actions">
            <button class="icon-button" id="refreshButton" type="button" title="Refresh" aria-label="Refresh data">
              <span id="refreshIcon">↻</span>
              <span id="refreshSpinner" class="spinner hidden" aria-hidden="true"></span>
            </button>
          </div>
        </header>

        <!-- SETUP -->
        <section class="page" id="page-setup">
          <div class="setup-hero">
            <div>
              <p class="kicker">Thiết lập nhanh</p>
              <h2>Kết nối công cụ AI trong vài bước</h2>
              <p>Chọn công cụ, copy cấu hình và kiểm tra kết nối. Gateway tự chọn model phù hợp qua <code>model=auto</code>.</p>
            </div>
            <div class="setup-progress" aria-label="Tiến độ thiết lập">
              <span class="setup-step active">1 Chọn công cụ</span>
              <span class="setup-step" id="setupStepConfig">2 Cấu hình</span>
              <span class="setup-step" id="setupStepTest">3 Kiểm tra</span>
            </div>
          </div>

          <div class="tool-picker" id="toolPicker" role="group" aria-label="Chọn công cụ cần kết nối">
            <button class="tool-option active" type="button" data-tool="claude-code">
              <strong>Claude Code</strong><span>Lập trình trong terminal</span>
            </button>
            <button class="tool-option" type="button" data-tool="cursor">
              <strong>Cursor</strong><span>IDE và AI coding</span>
            </button>
            <button class="tool-option" type="button" data-tool="n8n">
              <strong>n8n</strong><span>Workflow tự động</span>
            </button>
            <button class="tool-option" type="button" data-tool="ai-spa">
              <strong>AI Spa</strong><span>Chat, ảnh và nghiệp vụ spa</span>
            </button>
          </div>

          <div class="setup-grid">
            <section class="panel setup-config-panel">
              <div class="section-head">
                <div>
                  <h2 id="setupToolTitle">Claude Code</h2>
                  <p id="setupToolDescription">Cấu hình biến môi trường rồi mở lại terminal.</p>
                </div>
                <button class="button ghost small" id="copySetupConfig" type="button">Copy cấu hình</button>
              </div>
              <div class="mode-control" role="group" aria-label="Chế độ sử dụng">
                <button type="button" data-mode="economy">Tiết kiệm</button>
                <button type="button" data-mode="balanced" class="active">Cân bằng</button>
                <button type="button" data-mode="quality">Chất lượng cao</button>
              </div>
              <pre class="setup-code" id="setupConfig">Đang tạo cấu hình...</pre>
              <ol class="setup-instructions" id="setupInstructions"></ol>
            </section>

            <aside class="panel diagnostic-panel">
              <div class="section-head">
                <div>
                  <h2>Kiểm tra kết nối</h2>
                  <p>Kiểm tra key, policy và định tuyến trước khi sử dụng.</p>
                </div>
              </div>
              <div id="diagnosticResults" class="diagnostic-list">
                <div class="empty-state">Chưa chạy kiểm tra.</div>
              </div>
              <button class="button primary" id="runDiagnostics" type="button">Chạy kiểm tra</button>
              <button class="button ghost" id="openPlayground" type="button">Thử ngay trong Playground</button>
            </aside>
          </div>
        </section>

        <!-- OVERVIEW -->
        <section class="page hidden" id="page-overview">
          <div class="status-grid">
            <article class="stat-card">
              <span class="label">Status</span>
              <strong id="keyStatus">—</strong>
              <small id="keyPrefix">—</small>
            </article>
            <article class="stat-card">
              <span class="label">Rate limit</span>
              <strong id="rateLimit">—</strong>
              <small>requests / minute</small>
            </article>
            <article class="stat-card">
              <span class="label">Requests today</span>
              <strong id="todayRequests">—</strong>
              <small id="todayTokens">tokens used</small>
            </article>
            <article class="stat-card accent">
              <span class="label">Client</span>
              <strong id="clientName">—</strong>
              <small id="clientType">—</small>
            </article>
            <article class="stat-card" id="rate-limit-card">
              <span class="label">Rate Limit</span>
              <strong id="rl-current">—</strong>
              <small id="rl-sub">— / min</small>
              <div class="rl-bar-wrap">
                <div class="rl-bar" id="rl-bar"></div>
              </div>
              <small class="stat-hint" id="rl-reset"></small>
            </article>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Token Budget</h2>
                <p>Your quota usage and 30-day request history.</p>
              </div>
              <span id="lastUpdated" class="timestamp">Never updated</span>
            </div>

            <div class="budget-card" id="budget-card">
              <div class="budget-header">
                <span class="budget-label">Monthly Token Budget</span>
                <span class="budget-value" id="budget-pct">—</span>
              </div>
              <div class="budget-bar-wrap">
                <div class="budget-bar" id="budget-bar"></div>
              </div>
              <div class="budget-detail" id="budget-detail">Loading…</div>
            </div>

            <div class="budget-card" id="daily-budget-card" style="display:none">
              <div class="budget-header">
                <span class="budget-label">Daily Request Limit</span>
                <span class="budget-value" id="daily-pct">—</span>
              </div>
              <div class="budget-bar-wrap">
                <div class="budget-bar" id="daily-bar"></div>
              </div>
              <div class="budget-detail" id="daily-detail"></div>
            </div>

            <div class="usage-chart" id="usageChart">
              <div class="empty-state">No usage data yet.</div>
            </div>
          </div>

          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Recent Activity</h2>
                <p>Your last 5 requests.</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Time</th><th>Model</th><th>Provider</th><th>Status</th><th>Latency</th><th>Tokens</th></tr>
                </thead>
                <tbody id="recentRows"><tr><td colspan="6" class="empty-td">No recent activity</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- API KEYS -->
        <section class="page hidden" id="page-keys">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Your API Keys</h2>
                <p>Keys associated with your account. Raw key values are not shown here.</p>
              </div>
              <button class="button primary" id="newKeyButton" type="button">+ New Key</button>
            </div>

            <form id="newKeyForm" class="inline-form hidden" aria-label="Create new API key">
              <label>
                <span>Key name</span>
                <input id="newKeyName" name="name" placeholder="e.g. my-laptop" required autocomplete="off" />
              </label>
              <div class="form-actions">
                <button class="button primary" type="submit">Create Key</button>
                <button class="button ghost" id="newKeyCancel" type="button">Cancel</button>
              </div>
            </form>

            <div id="rawKeyBanner" class="raw-key-banner hidden">
              <strong>Your new API key — copy now, shown only once:</strong>
              <pre id="rawKeyValue"></pre>
              <div class="form-actions">
                <button class="button primary" id="rawKeyCopy" type="button">Copy</button>
                <button class="button ghost" id="rawKeyClose" type="button">Close</button>
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Prefix</th><th>Mode</th><th>Status</th><th>Last used</th><th>Created</th></tr>
                </thead>
                <tbody id="keysRows"><tr><td colspan="6" class="empty-td">No keys found</td></tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- POLICY -->
        <section class="page hidden" id="page-policy">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Your Policy</h2>
                <p>What you are allowed to do with this API key.</p>
              </div>
            </div>
            <div class="policy-grid" id="policyGrid">
              <div class="empty-state">No policy data loaded.</div>
            </div>
          </div>
        </section>

        <!-- LOGS -->
        <section class="page hidden" id="page-logs">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Request Logs</h2>
                <p>Your last 100 requests through the gateway.</p>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Time</th><th>Model</th><th>Provider</th><th>Status</th><th>Latency</th><th>In tokens</th><th>Out tokens</th></tr>
                </thead>
                <tbody id="logsRows"><tr><td colspan="7" class="empty-td">No logs</td></tr></tbody>
              </table>
            </div>
            <div class="pagination">
              <button class="button ghost small" id="logsPrevBtn" type="button" disabled>Prev</button>
              <span id="logsPageInfo" class="muted">Page 1</span>
              <button class="button ghost small" id="logsNextBtn" type="button" disabled>Next</button>
            </div>
          </div>
        </section>

        <!-- MODELS -->
        <section class="page hidden" id="page-models">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>Available Models</h2>
                <p>Models your API key is allowed to use. Click "Use in Console" to test one.</p>
              </div>
            </div>
            <div id="models-grid" class="models-grid">
              <div class="empty-state">Loading models…</div>
            </div>
          </div>
        </section>

        <!-- CONSOLE -->
        <section class="page hidden" id="page-console">
          <div class="chat-container">

            <!-- Tab bar -->
            <div class="chat-tabs" id="chatTabs">
              <!-- tabs rendered by JS -->
              <button class="chat-new-tab" id="chatNewTab" type="button" title="New conversation">+</button>
            </div>

            <!-- Toolbar -->
            <div class="chat-toolbar">
              <div class="chat-toolbar-selects">
                <select id="consoleModel" class="chat-select">
                  <option value="auto">auto (loading…)</option>
                </select>
                <select id="consoleTask" class="chat-select">
                  <option value="chat">chat</option>
                  <option value="spa-chat">spa-chat</option>
                  <option value="workflow">workflow</option>
                  <option value="review">review</option>
                  <option value="coding">coding</option>
                </select>
                <label class="chat-stream-label">
                  <input type="checkbox" id="consoleStream" />
                  <span>Stream</span>
                </label>
                <button class="chat-tool-btn" id="toggleSystemPrompt" type="button" title="System prompt">⚙ System</button>
                <button class="chat-tool-btn" id="togglePromptLib" title="Prompt Library">📚 Library</button>
                <button class="chat-tool-btn" id="toggleCompare" type="button" title="Compare two models">⇔ Compare</button>
                <button class="chat-tool-btn" id="toggleParams" type="button" title="Temperature & max tokens">🎛 Params</button>
                <button class="chat-tool-btn" id="toggleWebhook" type="button" title="Webhook settings">🔗 Webhook</button>
                <button class="chat-tool-btn" id="langToggle" type="button" title="Switch language">🌐 VI</button>
              </div>
              <div class="chat-toolbar-actions">
                <span id="consoleStatus" class="muted chat-status" aria-live="polite"></span>
                <button class="chat-tool-btn" id="exportChat" type="button" title="Export conversation">↓ Export</button>
                <button class="chat-tool-btn" id="shareChat" type="button" title="Share conversation link">🔗 Share</button>
                <button class="button ghost small" id="consoleClear" type="button">Clear</button>
              </div>
            </div>

            <!-- System prompt (collapsible) -->
            <div class="chat-system-prompt-wrap hidden" id="systemPromptWrap">
              <textarea
                id="systemPromptInput"
                class="chat-system-input"
                placeholder="System prompt (optional) — e.g. You are a helpful spa assistant…"
                rows="3"
              ></textarea>
            </div>

            <!-- Prompt Library overlay + drawer -->
            <div class="prompt-lib-overlay hidden" id="promptLibOverlay"></div>
            <div class="prompt-lib-drawer hidden" id="promptLibDrawer">
              <div class="prompt-lib-header">
                <span class="prompt-lib-title">📚 Prompt Library</span>
                <button class="prompt-lib-close" id="promptLibClose" type="button">×</button>
              </div>
              <div class="prompt-lib-toolbar">
                <button class="prompt-lib-add-btn" id="promptLibAdd" type="button">+ New</button>
                <button class="prompt-lib-reset-btn" id="promptLibReset" type="button" title="Restore default spa templates">↺ Restore defaults</button>
                <input type="text" class="prompt-lib-search" id="promptLibSearch" placeholder="Search…" autocomplete="off" />
              </div>
              <div class="prompt-lib-new-form hidden" id="promptLibForm">
                <input type="text" id="plTitle" placeholder="Title *" autocomplete="off" />
                <select id="plCategory">
                  <option value="General">General</option>
                  <option value="Spa">Spa</option>
                  <option value="Email">Email</option>
                  <option value="Code">Code</option>
                  <option value="Custom">Custom</option>
                </select>
                <textarea id="plContent" rows="4" placeholder="Prompt content *"></textarea>
                <div class="prompt-lib-form-actions">
                  <button class="prompt-lib-save-btn" id="plSave" type="button">Save</button>
                  <button class="prompt-lib-cancel-btn" id="plCancel" type="button">Cancel</button>
                </div>
              </div>
              <div class="prompt-lib-list" id="promptLibList"></div>
            </div>

            <!-- Preset prompts -->
            <div class="chat-presets" id="chatPresets">
              <button class="chat-preset-btn" data-preset="Tóm tắt nội dung sau đây một cách ngắn gọn:" type="button">📝 Tóm tắt</button>
              <button class="chat-preset-btn" data-preset="Dịch sang tiếng Anh tự nhiên:" type="button">🌐 Dịch EN</button>
              <button class="chat-preset-btn" data-preset="Viết mô tả hấp dẫn cho dịch vụ spa sau:" type="button">💆 Mô tả spa</button>
              <button class="chat-preset-btn" data-preset="Phản hồi chuyên nghiệp cho đánh giá khách hàng:" type="button">⭐ Phản hồi</button>
              <button class="chat-preset-btn" data-preset="Soạn tin nhắn nhắc lịch hẹn spa cho khách:" type="button">📅 Nhắc hẹn</button>
              <button class="chat-preset-btn" data-preset="Soạn email chuyên nghiệp về:" type="button">✉ Email</button>
              <button class="chat-preset-btn" data-preset="Review đoạn code sau:" type="button">💻 Review code</button>
            </div>

            <!-- Webhook panel (hidden until toggled) -->
            <div class="params-panel hidden" id="webhookPanel">
              <label class="params-row" style="flex:1;min-width:280px">
                <span>Webhook URL</span>
                <input type="url" id="webhookUrl" class="params-input" placeholder="https://n8n.example.com/webhook/…" autocomplete="off" />
              </label>
              <label class="params-row">
                <input type="checkbox" id="webhookAuto" />
                <span>Auto-send every response</span>
              </label>
            </div>

            <!-- Params panel (hidden until toggled) -->
            <div class="params-panel hidden" id="paramsPanel">
              <label class="params-row">
                <span>Temperature <strong id="tempVal">0.7</strong></span>
                <input type="range" id="tempSlider" min="0" max="2" step="0.05" value="0.7" class="params-slider" />
              </label>
              <label class="params-row">
                <span>Max tokens <strong id="maxTokVal">1024</strong></span>
                <input type="range" id="maxTokSlider" min="128" max="8192" step="64" value="1024" class="params-slider" />
              </label>
            </div>

            <!-- Compare toolbar (hidden until compare mode active) -->
            <div class="compare-bar hidden" id="compareBar">
              <div class="compare-bar-inner">
                <span class="compare-label">Model A</span>
                <select id="compareModelA" class="chat-select"></select>
                <span class="compare-label">Model B</span>
                <select id="compareModelB" class="chat-select"></select>
              </div>
            </div>

            <!-- Search bar (hidden until Ctrl+F) -->
            <div class="chat-search-bar hidden" id="chatSearchBar">
              <input type="text" id="chatSearchInput" placeholder="Search messages…" autocomplete="off" />
              <span id="chatSearchCount" class="chat-search-count"></span>
              <button class="chat-search-close" id="chatSearchClose" type="button">×</button>
            </div>

            <!-- Messages area -->
            <div class="chat-messages" id="chatMessages" aria-live="polite">
              <div class="chat-welcome" id="chatWelcome">
                <div class="chat-welcome-icon">✦</div>
                <p class="chat-welcome-title">AI Gateway Console</p>
                <p class="chat-welcome-sub">Select a model and send a message to test the gateway.</p>
              </div>
            </div>

            <!-- Input bar -->
            <form id="consoleChatForm" class="chat-input-bar" aria-label="Send message">
              <button class="chat-attach-btn" id="imageUploadBtn" type="button" title="Attach image">📎</button>
              <input type="file" id="imageUploadInput" accept="image/*" class="hidden" aria-label="Upload image" />
              <div class="chat-input-wrap">
                <div class="chat-image-preview hidden" id="imagePreview">
                  <img id="imagePreviewImg" src="" alt="Preview" />
                  <button class="chat-image-remove" id="removeImage" type="button" title="Remove image" aria-label="Remove image">×</button>
                </div>
                <textarea
                  id="consolePrompt"
                  class="chat-textarea"
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows="1"
                  autocomplete="off"
                ></textarea>
                <div class="token-counter" id="tokenCounter"></div>
              </div>
              <button class="chat-send-btn" type="submit" title="Send message" aria-label="Send">↑</button>
            </form>
          </div>
        </section>
      </main>
    </div>

    <!-- Toast container -->
    <div class="toast-container" id="toastContainer" aria-live="polite" aria-atomic="true"></div>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" id="hljs-theme" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="/dashboard/app.js?v=3" type="module"></script>
  </body>
</html>`;
