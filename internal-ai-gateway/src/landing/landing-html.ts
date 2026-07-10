export const landingHtml = `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Somail Gateway — Internal AI gateway for your tools</title>
  <meta name="description" content="Internal AI gateway for Claude Code, Cursor, n8n and AI Spa. Centralize API keys, policy, smart routing, usage and audit." />
  <meta name="theme-color" content="#f6f5f2" />
  <meta name="color-scheme" content="light dark" />
  <link rel="canonical" href="https://somail.us/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Somail Gateway" />
  <meta property="og:description" content="One internal gateway for AI clients, 9router and multiple providers." />
  <meta property="og:url" content="https://somail.us/" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23C8963E'/%3E%3Ctext x='32' y='39' text-anchor='middle' font-family='Arial' font-size='22' font-weight='700' fill='white'%3ESG%3C/text%3E%3C/svg%3E" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/landing.css?v=20260621-section-headers-v1" />
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>

  <!-- ── Navbar ───────────────────────────────────────────────────────── -->
  <nav id="main-nav">
    <div class="nav-inner">
      <a href="/" class="nav-brand">
        <div class="nav-logo">SG</div>
        <span class="nav-wordmark">Somail Gateway</span>
      </a>
      <div class="nav-links" id="nav-links">
        <a href="#platform" class="nav-link">Platform</a>
        <a href="#models" class="nav-link">Models</a>
        <a href="#integrations" class="nav-link">Integrations</a>
        <a href="/guide" class="nav-link">Guide</a>
        <a href="/check" class="nav-link">Check key</a>
        <a href="/v1/catalog" class="nav-link" data-track="cta_catalog">API Catalog</a>
        <a href="/admin" class="nav-link">Admin</a>
        <a href="/dashboard" class="nav-link nav-link-cta">Dashboard &rarr;</a>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
          <span class="theme-icon-sun">&#9728;</span>
          <span class="theme-icon-moon">&#127769;</span>
        </button>
      </div>
      <div class="nav-right-mobile">
        <button class="theme-toggle" id="theme-toggle-mobile" aria-label="Toggle theme">
          <span class="theme-icon-sun">&#9728;</span>
          <span class="theme-icon-moon">&#127769;</span>
        </button>
        <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>

  <!-- Mobile dropdown -->
  <div class="nav-mobile-dropdown" id="nav-mobile-dropdown">
    <a href="#platform" class="nav-mobile-link">Platform</a>
    <a href="#models" class="nav-mobile-link">Models</a>
    <a href="#integrations" class="nav-mobile-link">Integrations</a>
    <a href="/guide" class="nav-mobile-link">Guide</a>
    <a href="/check" class="nav-mobile-link">Check key</a>
    <a href="/v1/catalog" class="nav-mobile-link">API Catalog</a>
    <a href="/admin" class="nav-mobile-link">Admin</a>
    <a href="/dashboard" class="nav-mobile-link nav-mobile-cta">Dashboard &rarr;</a>
  </div>

  <!-- ── Hero ──────────────────────────────────────────────────────────── -->
  <main id="main-content">
  <section class="hero" id="platform">
    <div class="hero-grid"></div>
    <div class="hero-vignette"></div>
    <div class="hero-orb-1"></div>
    <div class="hero-orb-2"></div>
    <div class="hero-content">
      <div class="kicker"><span class="status-dot" id="hero-status-dot"></span><span id="hero-status-text">Checking gateway</span></div>
      <h1>
        Somail Gateway
      </h1>
      <p class="hero-offer">One internal endpoint for every AI client.</p>
      <p class="hero-subtitle">
        Connect Claude Code, Cursor, n8n and AI Spa to one controlled gateway.
        Tier 1 handles access, policy and audit; 9router handles provider translation and fallback.
      </p>
      <div class="hero-ctas">
        <a href="/dashboard" class="btn-primary" data-track="cta_dashboard">Open Dashboard &rarr;</a>
        <a href="/v1/catalog" class="btn-secondary" data-track="cta_catalog">Explore API</a>
      </div>

      <!-- Terminal window -->
      <div class="terminal-wrap">
        <div class="hero-badge" id="hero-badge">
          <span class="badge-dot"></span><span id="hero-live-summary">Live gateway status</span>
        </div>
        <div class="terminal">
          <div class="term-titlebar">
            <span class="term-dot term-dot-r"></span>
            <span class="term-dot term-dot-y"></span>
            <span class="term-dot term-dot-g"></span>
            <span class="term-title">somail.us &mdash; sandbox demo</span>
          </div>
          <div class="term-body" id="term-body"></div>
          <div class="term-demo-row" id="term-demo-row">
            <span class="term-prompt-sym">&#10095;</span>
            <input id="term-demo-input" class="term-demo-input" type="text" placeholder="Ask the gateway anything..." maxlength="240" autocomplete="off" />
            <button id="term-demo-btn" class="term-demo-btn">Send</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Provider marquee ───────────────────────────────────────────────────── -->
  <section class="marquee-section" id="models">
    <div class="section-header compact-header">
      <span class="section-eyebrow">Live model registry</span>
      <h2 class="section-title"><span id="model-count-heading">Loading</span> <span class="section-title-accent">enabled models</span></h2>
      <p class="section-subtitle">Scanned from the configured routing backend. Availability depends on connected provider accounts.</p>
    </div>

    <!-- Row 1 — scrolls left -->
    <div class="marquee-track">
      <div class="marquee-inner left" id="model-marquee">
        <span class="marquee-pill skeleton-pill">Loading models</span>
      </div>
    </div>

    <!-- Row 2 — scrolls right -->
    <div class="marquee-track">
      <div class="marquee-inner right" id="capability-marquee">
        <span class="marquee-pill skeleton-pill">Loading capabilities</span>
      </div>
    </div>
  </section>

  <!-- ── Stats bar ───────────────────────────────────────────────────────────── -->
  <section class="stats-section">
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number stat-live" id="provider-count">—</div>
        <div class="stat-label">Configured providers</div>
      </div>
      <div class="stat-item">
        <div class="stat-number stat-live" id="live-model-count">—</div>
        <div class="stat-label">Enabled registry models</div>
      </div>
      <div class="stat-item">
        <div class="stat-number stat-live" id="request-count-7d">—</div>
        <div class="stat-label">Requests in 7 days</div>
      </div>
      <div class="stat-item">
        <div class="stat-number stat-live" id="capability-count">—</div>
        <div class="stat-label">Gateway capabilities</div>
      </div>
    </div>
  </section>

  <!-- ── How it works ─────────────────────────────────────────────────────────── -->
  <section class="how-section">
    <div class="section-header fade-up">
      <span class="section-eyebrow">How it works</span>
      <h2 class="section-title">Up and running in <span class="section-title-accent">three steps</span></h2>
      <p class="section-subtitle">No SDK changes. No provider juggling. Just one unified interface.</p>
    </div>
    <div class="steps-grid">
      <div class="step fade-up">
        <div class="step-num">1</div>
        <h3>Admin creates users &amp; API keys</h3>
        <p>Provision access for your team via the Admin console. Assign policies, rate limits, and model allowlists per key.</p>
      </div>
      <div class="step fade-up">
        <div class="step-num">2</div>
        <h3>Team calls one unified endpoint</h3>
        <p>A single <code>/v1/chat</code> endpoint accepts every request. Specify <code>model: "auto"</code> or name a specific model.</p>
      </div>
      <div class="step fade-up">
        <div class="step-num">3</div>
        <h3>Gateway routes, logs &amp; enforces</h3>
        <p>Smart routing selects the best provider, logs every request, and enforces your policies automatically.</p>
      </div>
    </div>
  </section>

  <!-- ── Comparison ──────────────────────────────────────────────────────────── -->
  <section class="compare-section">
    <div class="section-header fade-up">
      <span class="section-eyebrow">Why a gateway?</span>
      <h2 class="section-title">Direct API vs <span class="section-title-accent">Somail Gateway</span></h2>
      <p class="section-subtitle">Same models. Dramatically better control.</p>
    </div>
    <div class="compare-grid fade-up">
      <div class="compare-col compare-before">
        <div class="compare-col-header">
          <span class="compare-badge compare-badge-no">Without</span>
          <h3>Direct provider calls</h3>
        </div>
        <ul class="compare-list">
          <li><span class="cmp-x">&#10005;</span> API keys scattered across every service</li>
          <li><span class="cmp-x">&#10005;</span> No cost visibility until the bill arrives</li>
          <li><span class="cmp-x">&#10005;</span> Provider outage = your app is down</li>
          <li><span class="cmp-x">&#10005;</span> Zero audit trail or request logging</li>
          <li><span class="cmp-x">&#10005;</span> Each team manages their own keys &amp; limits</li>
          <li><span class="cmp-x">&#10005;</span> Model changes require code deploys</li>
        </ul>
      </div>
      <div class="compare-col compare-after">
        <div class="compare-col-header">
          <span class="compare-badge compare-badge-yes">With Gateway</span>
          <h3>Somail Gateway</h3>
        </div>
        <ul class="compare-list">
          <li><span class="cmp-check">&#10003;</span> One key per app, full rotation &amp; audit</li>
          <li><span class="cmp-check">&#10003;</span> Real-time token &amp; cost tracking per key</li>
          <li><span class="cmp-check">&#10003;</span> Auto-fallback to next available provider</li>
          <li><span class="cmp-check">&#10003;</span> Every request logged with latency &amp; tokens</li>
          <li><span class="cmp-check">&#10003;</span> Per-key rate limits &amp; monthly token budgets</li>
          <li><span class="cmp-check">&#10003;</span> Swap models via Admin CP &mdash; zero redeploy</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ── Wave divider ─────────────────────────────────────────────────────────── -->
  <div class="wave-divider wave-to-dark">
    <svg viewBox="0 0 1440 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,48 C360,0 1080,48 1440,0 L1440,48 Z" fill="#0c1425"/>
    </svg>
  </div>

  <!-- ── Architecture visual ────────────────────────────────────────────────── -->
  <section class="arch-section">
    <div class="section-header fade-up">
      <span class="section-eyebrow">Architecture</span>
      <h2 class="section-title">Three clear <span class="section-title-accent">ownership layers</span></h2>
      <p class="section-subtitle">Your gateway controls access. 9router translates and falls back. Provider accounts stay replaceable.</p>
    </div>
    <div class="architecture-lanes fade-up">
      <article class="architecture-lane">
        <span class="lane-index">Tier 1</span>
        <h3>Somail Gateway</h3>
        <p>Multi-user auth, API keys, policy, quota, request IDs, audit and AI Spa integration.</p>
      </article>
      <span class="lane-arrow" aria-hidden="true">&darr;</span>
      <article class="architecture-lane">
        <span class="lane-index">Tier 2</span>
        <h3>9router on VPS</h3>
        <p>OpenAI format translation, provider account selection, fallback and media provider routing.</p>
      </article>
      <span class="lane-arrow" aria-hidden="true">&darr;</span>
      <article class="architecture-lane">
        <span class="lane-index">Tier 3</span>
        <h3>Provider accounts</h3>
        <p>Kiro, ChatGPT/Codex, Anthropic, GLM and future providers configured behind 9router.</p>
      </article>
    </div>
    <div class="arch-diagram-wrap fade-up">
      <svg class="arch-svg" viewBox="0 0 780 260" xmlns="http://www.w3.org/2000/svg" aria-label="Architecture diagram">
        <!-- Your Apps box -->
        <rect x="10" y="100" width="150" height="60" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
        <text x="85" y="126" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="Inter,sans-serif" font-size="13" font-weight="600">Your Apps</text>
        <text x="85" y="146" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-family="IBM Plex Mono,monospace" font-size="10">any HTTP client</text>

        <!-- Arrow from Apps to Gateway -->
        <line x1="162" y1="130" x2="270" y2="130" stroke="rgba(200,150,62,0.65)" stroke-width="1.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.2s" repeatCount="indefinite"/>
        </line>
        <polygon points="270,125 282,130 270,135" fill="#C8963E"/>

        <!-- Gateway box (glowing) -->
        <rect x="284" y="82" width="170" height="96" rx="12" fill="rgba(200,150,62,0.14)" stroke="#C8963E" stroke-width="2"/>
        <rect x="284" y="82" width="170" height="96" rx="12" fill="none" stroke="rgba(200,150,62,0.12)" stroke-width="12" style="filter:blur(6px)"/>
        <text x="369" y="121" text-anchor="middle" fill="#E8B96A" font-family="Be Vietnam Pro,sans-serif" font-size="14" font-weight="700">Somail Gateway</text>
        <text x="369" y="141" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="IBM Plex Mono,monospace" font-size="10">somail.us</text>
        <text x="369" y="158" text-anchor="middle" fill="rgba(232,185,106,0.85)" font-family="IBM Plex Mono,monospace" font-size="10">auth · route · log</text>

        <!-- Arrows from Gateway to Providers -->
        <!-- To Anthropic (top) -->
        <line x1="456" y1="105" x2="558" y2="55" stroke="rgba(200,150,62,0.45)" stroke-width="1.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.4s" repeatCount="indefinite"/>
        </line>
        <polygon points="551,48 563,53 554,61" fill="rgba(200,150,62,0.8)"/>
        <!-- To OpenAI -->
        <line x1="456" y1="120" x2="558" y2="107" stroke="rgba(200,150,62,0.45)" stroke-width="1.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.0s" repeatCount="indefinite"/>
        </line>
        <polygon points="551,102 563,106 553,113" fill="rgba(200,150,62,0.8)"/>
        <!-- To Kiro -->
        <line x1="456" y1="140" x2="558" y2="160" stroke="rgba(200,150,62,0.45)" stroke-width="1.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.6s" repeatCount="indefinite"/>
        </line>
        <polygon points="551,155 563,159 554,167" fill="rgba(200,150,62,0.8)"/>
        <!-- To 9router -->
        <line x1="456" y1="158" x2="558" y2="210" stroke="rgba(200,150,62,0.45)" stroke-width="1.5" stroke-dasharray="5,4">
          <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.8s" repeatCount="indefinite"/>
        </line>
        <polygon points="552,204 564,209 554,217" fill="rgba(200,150,62,0.8)"/>

        <!-- Provider boxes -->
        <!-- Anthropic -->
        <rect x="564" y="25" width="130" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(200,150,62,0.55)" stroke-width="1.5"/>
        <text x="629" y="47" text-anchor="middle" fill="#E8B96A" font-family="Be Vietnam Pro,sans-serif" font-size="12" font-weight="600">Anthropic</text>
        <text x="629" y="62" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="IBM Plex Mono,monospace" font-size="10">claude-*</text>

        <!-- OpenAI -->
        <rect x="564" y="84" width="130" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(200,150,62,0.55)" stroke-width="1.5"/>
        <text x="629" y="106" text-anchor="middle" fill="#E8B96A" font-family="Be Vietnam Pro,sans-serif" font-size="12" font-weight="600">OpenAI</text>
        <text x="629" y="121" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="IBM Plex Mono,monospace" font-size="10">gpt-*</text>

        <!-- Kiro -->
        <rect x="564" y="138" width="130" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(200,150,62,0.55)" stroke-width="1.5"/>
        <text x="629" y="160" text-anchor="middle" fill="#E8B96A" font-family="Be Vietnam Pro,sans-serif" font-size="12" font-weight="600">Kiro CLI</text>
        <text x="629" y="175" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="IBM Plex Mono,monospace" font-size="10">kiro-*</text>

        <!-- 9router -->
        <rect x="564" y="192" width="130" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(200,150,62,0.55)" stroke-width="1.5"/>
        <text x="629" y="214" text-anchor="middle" fill="#E8B96A" font-family="Be Vietnam Pro,sans-serif" font-size="12" font-weight="600">9router</text>
        <text x="629" y="229" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="IBM Plex Mono,monospace" font-size="10">auto</text>
      </svg>
    </div>
  </section>

  <!-- ── Wave divider ─────────────────────────────────────────────────────────── -->
  <div class="wave-divider wave-to-light">
    <svg viewBox="0 0 1440 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 C360,48 1080,0 1440,48 L1440,0 Z" fill="#171612"/>
    </svg>
  </div>

  <!-- ── Features grid ───────────────────────────────────────────────────────── -->
  <section class="features-section">
    <div class="section-header fade-up">
      <span class="section-eyebrow">Features</span>
      <h2 class="section-title">Everything you need, <span class="section-title-accent">nothing you don&rsquo;t</span></h2>
      <p class="section-subtitle">Production-ready AI infrastructure for internal teams.</p>
    </div>
    <div class="features-grid">
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F500;</span>
        <h3>Smart Routing</h3>
        <p>Auto-routes to the best model per task type. Say <code>auto</code> and let the gateway decide.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F511;</span>
        <h3>API Key Management</h3>
        <p>Create, rotate, and revoke keys with full audit trail. Raw key shown once &mdash; never stored in plaintext.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F4CA;</span>
        <h3>Usage Analytics</h3>
        <p>Daily and monthly tracking per client, model, and provider. Spot trends and control costs.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F6E1;&#xFE0F;</span>
        <h3>Policy Enforcement</h3>
        <p>Rate limits, token budgets, model allowlists &mdash; per API key, client, or user.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F9FE;</span>
        <h3>Audit metadata</h3>
        <p>Request ID, client, route, latency, token usage, cost estimate and error status are stored in SQLite and JSONL.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x26A1;</span>
        <h3>Provider separation</h3>
        <p>Tier 1 stays stable while 9router provider accounts and fallback order can change independently.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F510;</span>
        <h3>Scrypt Hashing</h3>
        <p>API keys hashed with scrypt &mdash; never SHA256. Timing-safe comparison for every auth check.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F504;</span>
        <h3>Lazy Key Upgrade</h3>
        <p>Legacy keys auto-upgrade to scrypt on next use &mdash; zero downtime migration.</p>
      </div>
      <div class="feature-card fade-up">
        <span class="feature-icon">&#x1F4E1;</span>
        <h3>Multi-user</h3>
        <p>Users, clients, and API keys fully isolated. Each client gets its own policy scope.</p>
      </div>
    </div>
  </section>

  <!-- ── Code section ─────────────────────────────────────────────────────────── -->
  <section class="code-section" id="integrations">
    <div class="section-header fade-up">
      <span class="section-eyebrow">Integration</span>
      <h2 class="section-title">Works with any <span class="section-title-accent">HTTP client</span></h2>
      <p class="section-subtitle">Use the native gateway API or OpenAI-compatible clients.</p>
    </div>
    <div class="code-wrap fade-up">
      <div class="code-tabs">
        <button class="code-tab active" data-tab="curl">curl</button>
        <button class="code-tab" data-tab="js">JavaScript</button>
        <button class="code-tab" data-tab="cursor">Cursor</button>
        <button class="code-tab" data-tab="n8n">n8n</button>
      </div>
      <div class="code-block-wrap">
        <div class="code-block active" id="tab-curl">
          <code><span class="hl-cm"># Send a chat request via curl</span>
<span class="hl-kw">curl</span> https://somail.us/v1/chat <span class="hl-flag">\\</span>
  <span class="hl-flag">-H</span> <span class="hl-str">"x-api-key: gw_live_YOUR_KEY"</span> <span class="hl-flag">\\</span>
  <span class="hl-flag">-H</span> <span class="hl-str">"content-type: application/json"</span> <span class="hl-flag">\\</span>
  <span class="hl-flag">-d</span> <span class="hl-str">'{
    "model": "auto",
    "task_type": "coding",
    "messages": [{ "role": "user", "content": "Review this code..." }]
  }'</span></code>
        </div>
        <div class="code-block" id="tab-js">
          <code><span class="hl-cm">// JavaScript — works in Node.js, browsers, Deno, Bun</span>
<span class="hl-kw">const</span> response = <span class="hl-kw">await</span> <span class="hl-kw">fetch</span>(<span class="hl-str">"https://somail.us/v1/chat"</span>, {
  method: <span class="hl-str">"POST"</span>,
  headers: {
    <span class="hl-key">"x-api-key"</span>: <span class="hl-str">"gw_live_YOUR_KEY"</span>,
    <span class="hl-key">"content-type"</span>: <span class="hl-str">"application/json"</span>
  },
  body: <span class="hl-kw">JSON</span>.stringify({
    model: <span class="hl-str">"auto"</span>,
    task_type: <span class="hl-str">"coding"</span>,
    messages: [{ role: <span class="hl-str">"user"</span>, content: <span class="hl-str">"Review this code..."</span> }]
  })
});

<span class="hl-kw">const</span> data = <span class="hl-kw">await</span> response.json();</code>
        </div>
        <div class="code-block" id="tab-cursor">
          <code><span class="hl-cm"># Cursor custom OpenAI provider</span>
Base URL: <span class="hl-str">https://somail.us/v1</span>
API Key:  <span class="hl-str">gw_live_YOUR_KEY</span>
Model:    <span class="hl-str">auto</span>

The gateway applies the Cursor client policy and resolves
the provider model through routing rules or the registry.</code>
        </div>
        <div class="code-block" id="tab-n8n">
          <code><span class="hl-cm"># n8n HTTP Request node</span>
Method: <span class="hl-str">POST</span>
URL:    <span class="hl-str">https://somail.us/v1/chat/completions</span>
Header: <span class="hl-str">Authorization: Bearer gw_live_YOUR_KEY</span>
Body:   <span class="hl-str">{"model":"auto","messages":[...]}</span></code>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Use cases ─────────────────────────────────────────────────────────── -->
  <section class="usecases-section">
    <div class="section-header fade-up">
      <span class="section-eyebrow">Internal clients</span>
      <h2 class="section-title">One control plane, <span class="section-title-accent">four workflows</span></h2>
      <p class="section-subtitle">Each client gets its own key, policy, quota and routing behavior.</p>
    </div>
    <div class="usecases-grid">
      <div class="usecase-card fade-up">
        <div class="usecase-icon">&#x1F4BB;</div>
        <h3>Claude Code &amp; Cursor</h3>
        <p>Route coding and review tasks through one compatible endpoint, with independent client policies and model selection.</p>
        <div class="usecase-tags">
          <span>auto</span><span>strong-code</span><span>coding</span>
        </div>
      </div>
      <div class="usecase-card fade-up">
        <div class="usecase-icon">&#x1F4AC;</div>
        <h3>n8n workflows</h3>
        <p>Call chat, image and future media endpoints from HTTP Request nodes without embedding provider credentials in workflows.</p>
        <div class="usecase-tags">
          <span>cheap-chat</span><span>workflow</span><span>OpenAI-compatible</span>
        </div>
      </div>
      <div class="usecase-card fade-up">
        <div class="usecase-icon">&#x1F9E0;</div>
        <h3>AI Spa</h3>
        <p>Separate spa-chat, vision and image-generation policies from coding tools while keeping shared audit and usage reporting.</p>
        <div class="usecase-tags">
          <span>claude-opus</span><span>analysis</span><span>audit-log</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Usage & security ─────────────────────────────────────────────────── -->
  <section class="operations-section" id="security">
    <div class="operations-grid">
      <div class="usage-panel fade-up">
        <span class="section-eyebrow">Usage, last 7 days</span>
        <h2 class="section-title">Operational data, <span class="section-title-accent">not vanity metrics</span></h2>
        <p class="section-subtitle">Aggregate request and token totals load from the gateway. Client identifiers remain private.</p>
        <div class="usage-total-row">
          <div><strong id="usage-requests">—</strong><span>requests</span></div>
          <div><strong id="usage-tokens">—</strong><span>tokens</span></div>
          <div><strong id="usage-cost">—</strong><span>estimated cost</span></div>
        </div>
        <div class="usage-chart" id="usage-chart" aria-label="Seven day request chart">
          <div class="chart-empty">Loading usage summary</div>
        </div>
      </div>
      <div class="security-panel fade-up">
        <span class="section-eyebrow">Security boundary</span>
        <h2 class="section-title">Provider secrets stay <span class="section-title-accent">behind the gateway</span></h2>
        <ul class="security-list">
          <li><strong>Scrypt API key hashes</strong><span>Raw keys are shown once and never stored in plaintext.</span></li>
          <li><strong>Scoped policy resolution</strong><span>API key, client, user and global policies resolve in priority order.</span></li>
          <li><strong>Timeout and request limits</strong><span>Provider calls and body size have explicit operational bounds.</span></li>
          <li><strong>Audit without prompt analytics</strong><span>Landing analytics stores event name and path only. It never stores demo prompts.</span></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ── Final CTA ──────────────────────────────────────────────────────────── -->
  <section class="cta-section">
    <div class="fade-up">
      <h2 class="section-title">Ready to unify <span class="section-title-accent">your AI stack?</span></h2>
      <p class="section-subtitle">Deploy in minutes with Docker.</p>
      <div class="cta-buttons">
        <a href="/dashboard" class="btn-teal" data-track="cta_dashboard">Open Dashboard &rarr;</a>
        <a href="/v1/catalog" class="btn-outline-teal" data-track="cta_catalog">View API Catalog</a>
      </div>
    </div>
  </section>
  </main>

  <!-- ── Footer ────────────────────────────────────────────────────────────── -->
  <footer>
    <div class="footer-brand">
      <div class="nav-brand" style="text-decoration:none">
        <div class="nav-logo">SG</div>
        <span class="nav-wordmark">Somail Gateway</span>
      </div>
      <p class="footer-tagline">somail.us &mdash; Internal AI Infrastructure</p>
    </div>
    <div class="footer-right">
      <span class="footer-copy">&copy; 2026 somail.us</span>
      <div class="footer-links">
        <a href="/admin" class="footer-link">Admin</a>
        <a href="/dashboard" class="footer-link">Dashboard</a>
        <a href="/ready/details" class="footer-link">Status</a>
        <a href="/guide" class="footer-link">Guide</a>
        <a href="/check" class="footer-link">Check key</a>
        <a href="/v1/catalog" class="footer-link">API Catalog</a>
      </div>
    </div>
  </footer>

  <!-- ── Sticky CTA ─────────────────────────────────────────────────────────── -->
  <div class="sticky-bar" id="sticky-bar">
    <span class="sticky-bar-text">&#9889; somail.us &mdash; Gateway ready</span>
    <div class="sticky-bar-actions">
      <a href="/dashboard" class="sticky-bar-btn">Open Dashboard &rarr;</a>
      <button class="sticky-bar-close" id="sticky-bar-close" aria-label="Dismiss">&times;</button>
    </div>
  </div>

  <script src="/landing.js?v=20260621-section-headers-v1"></script>
</body>
</html>`;
