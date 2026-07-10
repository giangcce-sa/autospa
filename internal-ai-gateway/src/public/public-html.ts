export const guideHtml = `<!doctype html>
<html lang="vi" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hướng dẫn kết nối — Somail Gateway</title>
  <meta name="description" content="Cấu hình Claude Code, Cursor, n8n và AI Spa với Somail Gateway.">
  <link rel="canonical" href="https://somail.us/guide">
  <link rel="stylesheet" href="/public-tools.css?v=20260618-1">
</head>
<body>
  <a class="skip" href="#content">Bỏ qua điều hướng</a>
  <header class="topbar">
    <a class="brand" href="/"><span>SG</span> Somail Gateway</a>
    <nav><a class="active" href="/guide">Hướng dẫn</a><a href="/check">Kiểm tra key</a><a href="/v1/catalog">API Catalog</a><a href="/dashboard">Dashboard</a></nav>
  </header>
  <main id="content" class="guide-shell">
    <aside class="guide-nav">
      <p class="eyebrow">Bắt đầu</p>
      <a href="#overview">Thông tin chung</a><a href="#models">Model</a><a href="#clients">Cấu hình client</a><a href="#examples">Request mẫu</a><a href="#troubleshoot">Xử lý lỗi</a>
    </aside>
    <article class="guide-content">
      <section class="guide-hero" id="overview">
        <div><p class="eyebrow">Somail Gateway / Guide</p><h1>Kết nối công cụ AI trong vài phút.</h1><p>Một API key, một gateway, nhiều model. Policy, quota và audit được áp dụng tự động.</p></div>
        <a class="button secondary" href="/check">Kiểm tra API key →</a>
      </section>
      <section>
        <h2>Thông tin chung</h2>
        <div class="facts">
          <div><span>OpenAI Base URL</span><code id="openai-base">…</code><button data-copy="#openai-base">Copy</button></div>
          <div><span>Anthropic Base URL</span><code id="anthropic-base">…</code><button data-copy="#anthropic-base">Copy</button></div>
          <div><span>Xác thực</span><code>x-api-key hoặc Bearer</code></div>
          <div><span>Model mặc định</span><code>auto</code></div>
        </div>
      </section>
      <section id="models">
        <div class="section-heading"><div><p class="eyebrow">Registry trực tiếp</p><h2>Model đang khả dụng</h2></div><span class="live" id="model-count">Đang tải</span></div>
        <div class="tabs" id="model-tabs"></div>
        <div class="model-list" id="model-list"><div class="skeleton"></div><div class="skeleton short"></div></div>
      </section>
      <section id="clients">
        <p class="eyebrow">Client setup</p><h2>Chọn công cụ đang dùng</h2>
        <div class="tabs" id="client-tabs">
          <button class="active" data-client="claude-code">Claude Code</button><button data-client="cursor">Cursor</button><button data-client="n8n">n8n</button><button data-client="ai-spa">AI Spa</button>
        </div>
        <div class="setup-panel">
          <div class="setup-copy"><h3 id="client-title">Claude Code</h3><p id="client-note">Dùng biến môi trường Anthropic-compatible.</p><ol id="client-steps"></ol></div>
          <div class="code-wrap"><button class="copy-code" data-copy="#client-code">Copy</button><pre><code id="client-code">Đang tải cấu hình…</code></pre></div>
        </div>
      </section>
      <section id="examples">
        <p class="eyebrow">API request</p><h2>Thử bằng curl</h2>
        <div class="code-wrap"><button class="copy-code" data-copy="#curl-code">Copy</button><pre><code id="curl-code">Đang tạo request…</code></pre></div>
      </section>
      <section id="troubleshoot">
        <p class="eyebrow">Troubleshooting</p><h2>Lỗi thường gặp</h2>
        <div class="trouble-grid">
          <article><strong>401 — Invalid API key</strong><p>Kiểm tra key còn active, chưa hết hạn và không có khoảng trắng khi copy.</p></article>
          <article><strong>403 — Policy denied</strong><p>Model hoặc capability không nằm trong policy của key. Liên hệ admin để cấp quyền.</p></article>
          <article><strong>429 — Rate or quota limit</strong><p>Chờ hết cửa sổ rate limit hoặc kiểm tra quota tại trang kiểm tra key.</p></article>
          <article><strong>Provider unavailable</strong><p>Thử model <code>auto</code> để gateway chọn route khác, sau đó kiểm tra trang Status.</p></article>
        </div>
      </section>
    </article>
  </main>
  <script src="/guide.js?v=20260618-1"></script>
</body></html>`;

export const checkHtml = `<!doctype html>
<html lang="vi" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Kiểm tra API key — Somail Gateway</title>
  <meta name="description" content="Kiểm tra trạng thái, policy và quota API key Somail Gateway.">
  <link rel="canonical" href="https://somail.us/check">
  <link rel="stylesheet" href="/public-tools.css?v=20260618-1">
</head>
<body class="check-page">
  <a class="skip" href="#content">Bỏ qua điều hướng</a>
  <header class="topbar">
    <a class="brand" href="/"><span>SG</span> Somail Gateway</a>
    <nav><a href="/guide">Hướng dẫn</a><a class="active" href="/check">Kiểm tra key</a><a href="/dashboard">Dashboard</a></nav>
  </header>
  <main id="content" class="check-shell">
    <section class="check-card">
      <p class="eyebrow">Self-service diagnostics</p>
      <h1>Kiểm tra API key</h1>
      <p class="lead">Xem trạng thái, policy và usage hiện tại. API key chỉ được dùng để xác thực request này, không được lưu hoặc ghi log.</p>
      <form id="check-form">
        <label for="api-key">API key của bạn</label>
        <div class="key-input"><input id="api-key" type="password" placeholder="gw_live_…" autocomplete="off" spellcheck="false" required><button type="button" id="toggle-key" aria-label="Hiện API key">Hiện</button></div>
        <button class="button primary full" id="check-button" type="submit">Kiểm tra key</button>
      </form>
      <p class="privacy-note">Giới hạn một lần kiểm tra mỗi 10 giây trên mỗi địa chỉ IP.</p>
      <div id="check-result" class="result" hidden aria-live="polite"></div>
    </section>
  </main>
  <script src="/check.js?v=20260618-1"></script>
</body></html>`;
