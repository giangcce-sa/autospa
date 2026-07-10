import { brandTokensCss } from '../shared/brand-tokens.js';

export const dashboardCss = brandTokensCss + `

:root {
  --bg: #f5f2ee;
  --panel: #fff;
  --panel-strong: #faf7f3;
  --ink: #1a1008;
  --muted: #667085;
  --line: #e8ddd0;
  --accent: #C8963E;
  --accent-dark: #A07628;
  --accent-soft: #FDF6E3;
  --danger: #b42318;
  --warn: #b54708;
  --ok: #087443;
  --radius: 9px;
  font-family: "Be Vietnam Pro", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); min-width: 320px; }

/* ── Auth screen ── */
.auth-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}
.auth-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 40px;
  width: min(440px, 100%);
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,.07);
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.auth-brand strong, .auth-brand span { display: block; }
.auth-brand strong { font-size: 16px; }
.auth-brand span { font-size: 12px; color: var(--muted); }
.auth-card h1 { font-size: 26px; margin: 0; }
.auth-desc { color: var(--muted); font-size: 14px; margin: 0; }
.auth-error { color: var(--danger); font-size: 13px; margin: 0; }
#authForm { display: flex; flex-direction: column; gap: 14px; }
#authForm .button { margin-top: 4px; }

/* ── Shell layout ── */
.shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
}

/* ── Sidebar ── */
.sidebar {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  background: #101828;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 12px;
  border-right: 1px solid #1f2d3d;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
}
.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #C8963E;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 13px;
  flex-shrink: 0;
}
.brand strong, .brand span { display: block; }
.brand strong { font-size: 15px; line-height: 1.2; }
.brand span { color: #94a3b8; font-size: 12px; margin-top: 1px; }

/* User chip */
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,.06);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 4px;
}
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #C8963E;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 13px;
  flex-shrink: 0;
}
.user-info { min-width: 0; }
.user-info strong { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-info .muted { font-size: 11px; }

/* Nav */
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  text-decoration: none;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  transition: background .12s, color .12s;
}
.nav-item:hover { background: rgba(255,255,255,.07); color: #e2e8f0; }
.nav-item.active { background: rgba(200,150,62,.18); color: #e8b96a; font-weight: 600; }
.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: .6;
  flex-shrink: 0;
}
.nav-item-console {
  margin-top: 10px;
  border-top: 1px solid #1f2d3d;
  padding-top: 14px;
}
.sidebar-foot { padding: 8px 4px; }

/* ── Main ── */
.main {
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1200px;
  width: 100%;
}

/* ── Topbar ── */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.kicker {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}
h1 { margin: 0; font-size: clamp(20px, 3vw, 30px); line-height: 1.1; }
h2 { margin: 0; font-size: 17px; }
p { margin: 0; }
.topbar-actions { display: flex; align-items: center; gap: 10px; }

/* ── Buttons ── */
.button, .icon-button {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: var(--radius);
  min-height: 38px;
  padding: 0 14px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background .12s, border-color .12s;
}
.icon-button { width: 38px; padding: 0; font-size: 18px; }
.button.primary { background: var(--accent); border-color: var(--accent); color: #fff; width: 100%; min-height: 42px; }
.button.primary:hover { background: var(--accent-dark); border-color: var(--accent-dark); }
.button.ghost { background: transparent; }
.button.ghost:hover, .icon-button:hover { border-color: #8898aa; background: var(--panel-strong); }
.button.small, .icon-button.small { min-height: 32px; font-size: 12px; padding: 0 10px; }
.icon-button.small { width: 32px; }
.logout-btn { color: #94a3b8; border-color: #2d3748; background: transparent; width: 100%; }
.logout-btn:hover { color: #e2e8f0; background: rgba(255,255,255,.06); }

/* ── Spinner ── */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(200,150,62,.25);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Pages ── */
.page { display: flex; flex-direction: column; gap: 20px; }
.page.hidden { display: none; }

/* ── Stat cards ── */
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.stat-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.stat-card strong { font-size: 24px; line-height: 1.1; }
.stat-card small, .muted { color: var(--muted); font-size: 13px; }
.stat-card.accent { border-color: rgba(200,150,62,.3); background: var(--accent-soft); }
.label { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.timestamp { color: var(--muted); font-size: 12px; }

/* ── Panel ── */
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.section-head p { color: var(--muted); font-size: 13px; margin-top: 5px; }
.empty-state { color: var(--muted); font-size: 13px; padding: 8px 0; }

/* ── Usage chart (bar) ── */
.usage-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 80px;
  overflow-x: auto;
}
.usage-bar {
  flex: 1;
  min-width: 8px;
  max-width: 32px;
  background: var(--accent-soft);
  border-radius: 3px 3px 0 0;
  position: relative;
  cursor: default;
  transition: background .12s;
}
.usage-bar:hover { background: var(--accent); }
.usage-bar::after {
  content: attr(data-tip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #1f2937;
  color: #d1fae5;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 11px;
  display: none;
  pointer-events: none;
  z-index: 10;
}
.usage-bar:hover::after { display: block; }

/* ── Policy grid ── */
.policy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.policy-item {
  background: var(--panel-strong);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.policy-item .label { margin-bottom: 4px; }
.policy-value { font-size: 15px; font-weight: 700; }
.policy-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-dark);
  font-size: 11px;
  font-weight: 600;
}

/* ── Tables ── */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
table { width: 100%; min-width: 540px; border-collapse: collapse; font-size: 13px; }
th, td { padding: 11px 13px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { background: var(--panel-strong); color: #475467; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
tr:last-child td { border-bottom: 0; }
.empty-td { color: var(--muted); font-style: italic; }
code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }

/* ── Forms ── */
label:not(.check) { display: grid; gap: 5px; color: #344054; font-size: 12px; font-weight: 700; }
label span { display: block; }
input, select, textarea {
  width: 100%;
  border: 1px solid #b7c1cc;
  border-radius: var(--radius);
  background: #fff;
  color: var(--ink);
  min-height: 38px;
  padding: 8px 11px;
  font: inherit;
  font-size: 13px;
}
input:focus, select:focus, textarea:focus {
  outline: 3px solid rgba(200,150,62,.16);
  border-color: var(--accent);
}
textarea { resize: vertical; min-height: 130px; line-height: 1.5; }
.console-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-actions { display: flex; align-items: center; gap: 10px; }
.wide { grid-column: 1 / -1; }

/* ── Output ── */
.output {
  margin: 0;
  min-height: 100px;
  max-height: 460px;
  overflow: auto;
  border-radius: var(--radius);
  border: 1px solid #1f2937;
  background: #111827;
  color: #d1fae5;
  padding: 14px;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* ── Pills ── */
.pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.pill.ok { background: #dcfae6; color: var(--ok); }
.pill.warn { background: #fef0c7; color: var(--warn); }
.pill.bad { background: #fee4e2; color: var(--danger); }

/* ── Toasts ── */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  z-index: 1000;
  pointer-events: none;
}
.toast {
  pointer-events: all;
  min-width: 240px;
  max-width: 360px;
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  animation: toastIn .2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}
.toast.ok { background: #087443; }
.toast.error { background: var(--danger); }
.toast.warn { background: var(--warn); }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ── Hidden ── */
.hidden { display: none !important; }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .status-grid { grid-template-columns: repeat(2, 1fr); }
  .policy-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 760px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; flex-direction: row; flex-wrap: wrap; padding: 12px; gap: 10px; }
  .brand { flex: 1; }
  .user-chip { display: none; }
  .nav { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .nav-item-console { margin-top: 0; border-top: none; padding-top: 9px; }
  .sidebar-foot { display: none; }
  .main { padding: 16px; }
  .status-grid, .policy-grid, .console-grid { grid-template-columns: 1fr; }
  .topbar { flex-direction: column; }
}

/* Raw key banner */
.raw-key-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 12px 0; }
.raw-key-banner pre { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin: 8px 0; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; white-space: pre-wrap; }
.raw-key-banner strong { color: #92400e; }

/* Pagination */
.pagination { display: flex; align-items: center; gap: 12px; margin-top: 12px; }

/* Rate limit bar */
.rl-bar-wrap { height: 4px; background: var(--border); border-radius: 2px; margin-top: 8px; overflow: hidden; }
.rl-bar { height: 100%; width: 0%; background: var(--accent); border-radius: 2px; transition: width 0.3s ease; }
.rl-bar.warn { background: #f59e0b; }
.rl-bar.danger { background: #ef4444; }
.stat-hint { font-size: 11px; color: var(--muted, #6b7280); margin-top: 4px; display: block; }

/* ── Budget bar ── */
.budget-card { background: var(--panel-strong); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
.budget-card:last-of-type { margin-bottom: 0; }
.budget-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.budget-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
.budget-value { font-size: 20px; font-weight: 800; color: var(--ink); }
.budget-bar-wrap { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.budget-bar { height: 100%; width: 0%; background: var(--accent); border-radius: 4px; transition: width .5s ease; }
.budget-bar.warn { background: #f59e0b; }
.budget-bar.danger { background: #ef4444; }
.budget-detail { font-size: 12px; color: var(--muted); }

/* ── Models grid ── */
.models-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 4px; }
.model-card { background: var(--panel-strong); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 6px; }
.model-name { font-size: 15px; font-weight: 700; color: var(--ink); }
.model-provider { font-size: 12px; color: var(--accent); font-family: "SFMono-Regular", Consolas, monospace; }
.model-tasks { font-size: 12px; color: var(--muted); flex: 1; }
.btn-sm { min-height: 30px; padding: 0 12px; font-size: 12px; font-weight: 600; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--ink); cursor: pointer; margin-top: 8px; }
.btn-sm:hover { border-color: var(--accent); color: var(--accent); background: var(--panel-strong); }

/* ── Chat Console ── */
#page-console { gap: 0; }
.chat-container {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 180px);
  min-height: 500px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(15,23,42,0.05);
  transition: border-color .15s;
}
.chat-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--panel-strong);
  border-bottom: 1px solid var(--line);
}
.chat-search-bar input {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  background: var(--panel);
}
.chat-search-bar input:focus { outline: none; border-color: var(--accent); }
.chat-search-count { font-size: 12px; color: var(--muted); white-space: nowrap; }
.chat-search-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--muted);
  padding: 0 4px;
  line-height: 1;
}
.chat-msg.search-hidden { display: none; }
.chat-search-highlight { background: rgba(200,150,62,0.35); border-radius: 2px; }
.chat-container.drag-over {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(200,150,62,0.18);
}
.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel-strong);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.chat-toolbar-selects { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.chat-toolbar-actions { display: flex; align-items: center; gap: 10px; }
.params-panel {
  background: var(--panel-strong);
  border-bottom: 1px solid var(--line);
  padding: 10px 16px;
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.params-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  cursor: default;
}
.params-row span { white-space: nowrap; min-width: 130px; }
.params-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 4px;
  background: var(--line);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.params-input {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font: inherit;
  font-size: 12.5px;
  background: var(--panel);
  min-width: 200px;
}
.params-input:focus { outline: none; border-color: var(--accent); }
.params-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}
.compare-bar {
  background: var(--panel-strong);
  border-bottom: 1px solid var(--line);
  padding: 8px 16px;
}
.compare-bar-inner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.compare-label { font-size: 12px; font-weight: 600; color: var(--accent); }
.compare-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  flex: 1;
  overflow: hidden;
}
.compare-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  overflow-y: auto;
  padding: 12px;
  min-height: 0;
}
.compare-pane:last-child { border-right: none; }
.compare-pane-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}
.chat-tool-btn.active { background: var(--accent); color: #fff; }
.chat-select {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font: inherit;
  font-size: 12.5px;
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
}
.chat-stream-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.chat-stream-label input { width: auto; min-height: auto; }
.chat-status { font-size: 12px; }
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-behavior: smooth;
}
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--muted);
}
.chat-welcome-icon { font-size: 26px; color: var(--accent); line-height: 1; margin-bottom: 4px; }
.chat-welcome-title { font-size: 15px; font-weight: 700; color: var(--ink); margin: 0; }
.chat-welcome-sub { font-size: 13px; margin: 0; }
.chat-msg { display: flex; flex-direction: column; gap: 4px; max-width: 80%; }
.chat-msg.user { align-self: flex-end; align-items: flex-end; }
.chat-msg.assistant { align-self: flex-start; align-items: flex-start; }
.chat-msg-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 0 4px; }
.chat-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .chat-bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
.chat-msg.assistant .chat-bubble {
  background: var(--panel-strong);
  border: 1px solid var(--line);
  color: var(--ink);
  border-bottom-left-radius: 4px;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12.5px;
}
.chat-msg.assistant.streaming .chat-bubble::after {
  content: '▋';
  display: inline-block;
  animation: blink .8s step-end infinite;
  color: var(--accent);
  margin-left: 2px;
}
@keyframes blink { 50% { opacity: 0; } }
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--line);
  background: var(--panel);
  flex-shrink: 0;
}
.chat-textarea {
  flex: 1;
  min-height: 40px;
  max-height: 160px;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font: inherit;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--panel-strong);
  transition: border-color .12s, box-shadow .12s;
  overflow-y: auto;
}
.chat-textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(200,150,62,0.14); }
.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: background .12s, transform .1s;
}
.chat-send-btn:hover { background: var(--accent-dark); transform: translateY(-1px); }
.chat-send-btn:active { transform: translateY(0); }
.chat-send-btn:disabled { background: var(--line); cursor: not-allowed; transform: none; }

/* ── Chat Tabs ── */
.chat-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px 0;
  background: var(--panel-strong);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.chat-tabs::-webkit-scrollbar { display: none; }
.chat-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 10px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 7px 7px 0 0;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, color .1s;
}
.chat-tab:hover { background: rgba(0,0,0,.05); color: var(--ink); }
.chat-tab.active {
  background: var(--panel);
  border-color: var(--line);
  color: var(--ink);
  font-weight: 600;
  position: relative;
  bottom: -1px;
}
.chat-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: background .1s, color .1s;
}
.chat-tab-close:hover { background: rgba(0,0,0,.12); color: var(--ink); }
.chat-new-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px dashed var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  font-weight: 400;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 4px;
  transition: border-color .1s, color .1s;
}
.chat-new-tab:hover { border-color: var(--accent); color: var(--accent); }

/* ── Chat tool buttons ── */
.chat-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, border-color .1s;
}
.chat-tool-btn:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-dark); }

/* ── System prompt ── */
.chat-system-prompt-wrap {
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  background: #fffbf3;
  flex-shrink: 0;
}
.chat-system-input {
  width: 100%;
  min-height: 64px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 11px;
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--panel);
  line-height: 1.5;
}
.chat-system-input:focus { outline: 3px solid rgba(200,150,62,.16); border-color: var(--accent); }

/* ── Preset prompts ── */
.chat-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel-strong);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.chat-presets::-webkit-scrollbar { display: none; }
.chat-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .1s, color .1s, border-color .1s;
}
.chat-preset-btn:hover { border-color: var(--accent); color: var(--accent-dark); background: var(--accent-soft); }

/* ── Message actions (copy / retry) ── */
.chat-msg-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 4px;
  opacity: 0;
  transition: opacity .15s;
}
.chat-msg:hover .chat-msg-actions { opacity: 1; }
.chat-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, color .1s;
}
.chat-action-btn:hover { border-color: var(--accent); color: var(--accent-dark); background: var(--accent-soft); }
.chat-cost-label {
  font-size: 11px;
  color: var(--muted);
  padding: 0 6px;
  align-self: center;
  cursor: default;
}

/* ── Image upload / preview ── */
.chat-attach-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color .1s, background .1s;
}
.chat-attach-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
.chat-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.token-counter {
  font-size: 11px;
  color: var(--muted);
  text-align: right;
  padding: 0 2px;
  line-height: 1;
  min-height: 14px;
}
.chat-image-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: var(--panel-strong);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.chat-image-preview img {
  height: 48px;
  width: auto;
  max-width: 80px;
  border-radius: 5px;
  object-fit: cover;
}
.chat-image-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,.12);
  color: var(--ink);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: background .1s;
}
.chat-image-remove:hover { background: var(--danger); color: #fff; }

/* ── Markdown in assistant bubbles ── */
.chat-msg.assistant .chat-bubble { white-space: normal; font-family: inherit; font-size: 13.5px; }
.chat-bubble h2, .chat-bubble h3, .chat-bubble h4 { margin: 12px 0 6px; font-size: 14px; font-weight: 700; line-height: 1.3; }
.chat-bubble h2 { font-size: 15px; }
.chat-bubble p { margin: 6px 0; }
.chat-bubble p:first-child { margin-top: 0; }
.chat-bubble p:last-child { margin-bottom: 0; }
.chat-bubble ul, .chat-bubble ol { margin: 6px 0; padding-left: 20px; }
.chat-bubble li { margin: 3px 0; }
.chat-bubble strong { font-weight: 700; }
.chat-bubble em { font-style: italic; }
.chat-bubble pre, .chat-bubble .hljs-pre {
  background: #f6f8fa;
  border: 1px solid #e8ddd0;
  border-radius: 8px;
  padding: 0;
  margin: 8px 0;
  overflow-x: auto;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  position: relative;
}
.chat-bubble .hljs-pre code.hljs {
  background: none;
  padding: 12px 14px;
  display: block;
  border-radius: 0;
}
.chat-bubble .code-lang {
  display: block;
  background: #e8ddd0;
  color: #7a5c28;
  font-size: 10px;
  font-family: "SFMono-Regular", Consolas, monospace;
  padding: 2px 10px;
  border-radius: 7px 7px 0 0;
  letter-spacing: .03em;
}
.chat-bubble pre code {
  background: none;
  padding: 12px 14px;
  display: block;
  border-radius: 0;
  color: #1e2433;
  font-size: inherit;
}
.chat-bubble code {
  background: rgba(200,150,62,.12);
  color: var(--accent-dark);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
}

/* ── Prompt Library ── */
.prompt-lib-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.2); z-index: 100;
}
.prompt-lib-drawer {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 320px; background: var(--panel);
  border-left: 1px solid var(--line);
  display: flex; flex-direction: column;
  z-index: 101; overflow: hidden;
  box-shadow: -4px 0 20px rgba(0,0,0,0.08);
  transition: transform 0.2s ease;
}
.prompt-lib-drawer.hidden { display: none; }
.prompt-lib-overlay.hidden { display: none; }
.prompt-lib-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--line);
  background: var(--panel-strong); flex-shrink: 0;
}
.prompt-lib-title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
.prompt-lib-close {
  width: 28px; height: 28px; border: none; background: none;
  font-size: 18px; color: var(--muted); cursor: pointer; border-radius: 6px;
  display: grid; place-items: center; line-height: 1;
}
.prompt-lib-close:hover { background: var(--line); color: var(--ink); }
.prompt-lib-toolbar {
  display: flex; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.prompt-lib-add-btn {
  white-space: nowrap; background: var(--accent); color: #fff;
  border: none; border-radius: 7px; padding: 0 12px; height: 30px;
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: background 0.12s;
}
.prompt-lib-add-btn:hover { background: var(--accent-dark); }
.prompt-lib-reset-btn {
  white-space: nowrap; background: none; color: var(--muted);
  border: 1px solid var(--line); border-radius: 7px; padding: 0 10px; height: 30px;
  font: inherit; font-size: 11px; cursor: pointer; transition: all 0.12s;
}
.prompt-lib-reset-btn:hover { border-color: var(--accent); color: var(--accent); }
.prompt-lib-search {
  flex: 1; min-height: 30px; border: 1px solid var(--line);
  border-radius: 7px; padding: 0 10px; font: inherit; font-size: 12.5px;
  background: var(--panel-strong); color: var(--ink);
}
.prompt-lib-search:focus { outline: none; border-color: var(--accent); }
.prompt-lib-new-form {
  padding: 12px; border-bottom: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
  background: var(--accent-soft);
}
.prompt-lib-new-form.hidden { display: none; }
.prompt-lib-new-form input, .prompt-lib-new-form select, .prompt-lib-new-form textarea {
  width: 100%; border: 1px solid var(--line); border-radius: 7px;
  padding: 7px 10px; font: inherit; font-size: 12.5px;
  background: var(--panel); color: var(--ink);
}
.prompt-lib-new-form textarea { resize: vertical; min-height: 80px; }
.prompt-lib-new-form input:focus, .prompt-lib-new-form select:focus, .prompt-lib-new-form textarea:focus {
  outline: none; border-color: var(--accent);
}
.prompt-lib-form-actions { display: flex; gap: 8px; }
.prompt-lib-save-btn {
  flex: 1; height: 30px; background: var(--accent); color: #fff;
  border: none; border-radius: 7px; font: inherit; font-size: 12.5px;
  font-weight: 600; cursor: pointer;
}
.prompt-lib-save-btn:hover { background: var(--accent-dark); }
.prompt-lib-cancel-btn {
  height: 30px; padding: 0 12px; background: var(--panel);
  border: 1px solid var(--line); border-radius: 7px; font: inherit;
  font-size: 12.5px; cursor: pointer; color: var(--muted);
}
.prompt-lib-cancel-btn:hover { border-color: var(--muted); }
.prompt-lib-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.prompt-lib-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--muted); padding: 10px 14px 4px;
}
.prompt-lib-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid var(--line);
  transition: background 0.1s;
}
.prompt-lib-item:hover { background: var(--panel-strong); }
.prompt-lib-item-title {
  flex: 1; font-size: 12.5px; font-weight: 600; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer;
}
.prompt-lib-item-title:hover { color: var(--accent); }
.prompt-lib-use-btn {
  height: 24px; padding: 0 8px; background: var(--accent-soft);
  color: var(--accent-dark); border: 1px solid rgba(200,150,62,0.3);
  border-radius: 5px; font: inherit; font-size: 11px; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.prompt-lib-use-btn:hover { background: var(--accent); color: #fff; }
.prompt-lib-del-btn {
  width: 24px; height: 24px; background: none; border: none;
  color: var(--muted); cursor: pointer; border-radius: 5px;
  font-size: 14px; display: grid; place-items: center; flex-shrink: 0;
}
.prompt-lib-del-btn:hover { background: #fee4e2; color: var(--danger); }
.prompt-lib-empty {
  text-align: center; color: var(--muted); font-size: 13px;
  padding: 32px 16px;
}

/* Self-service setup */
.setup-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding: 20px 0 4px;
}
.setup-hero h2 { font-size: 24px; margin-bottom: 8px; }
.setup-hero > div:first-child > p:last-child {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
  max-width: 680px;
}
.setup-progress {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.setup-step {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--muted);
  background: var(--panel);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.setup-step.active {
  color: var(--accent-dark);
  border-color: rgba(200,150,62,.45);
  background: var(--accent-soft);
}
.tool-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--panel);
}
.tool-option {
  min-height: 84px;
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  padding: 15px;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.tool-option:last-child { border-right: 0; }
.tool-option:hover { background: var(--panel-strong); }
.tool-option.active {
  background: var(--accent-soft);
  box-shadow: inset 0 -3px 0 var(--accent);
}
.tool-option strong, .tool-option span { display: block; }
.tool-option strong { font-size: 14px; margin-bottom: 5px; }
.tool-option span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, .75fr);
  gap: 16px;
  align-items: start;
}
.setup-config-panel .button { width: auto; }
.mode-control {
  display: inline-grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-strong);
  align-self: flex-start;
}
.mode-control button {
  min-height: 32px;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.mode-control button.active {
  background: var(--panel);
  color: var(--ink);
  box-shadow: 0 1px 3px rgba(15,23,42,.09);
}
.setup-code {
  min-height: 150px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border: 1px solid #263448;
  border-radius: var(--radius);
  background: #101828;
  color: #e6edf5;
  font: 12.5px/1.7 "SFMono-Regular", Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}
.setup-instructions {
  margin: 0;
  padding-left: 22px;
  color: #344054;
  font-size: 13px;
  line-height: 1.7;
}
.diagnostic-panel .button { width: 100%; }
.diagnostic-list { display: grid; gap: 8px; }
.diagnostic-item {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.diagnostic-item:last-child { border-bottom: 0; }
.diagnostic-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 800;
}
.diagnostic-item.ok .diagnostic-status { color: var(--ok); background: #dcfae6; }
.diagnostic-item.bad .diagnostic-status { color: var(--danger); background: #fee4e2; }
.diagnostic-item strong, .diagnostic-item span { display: block; }
.diagnostic-item strong { font-size: 13px; margin-bottom: 3px; }
.diagnostic-item div span { color: var(--muted); font-size: 12px; line-height: 1.45; }

@media (max-width: 900px) {
  .tool-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tool-option:nth-child(2) { border-right: 0; }
  .tool-option:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .setup-grid { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .setup-hero { flex-direction: column; }
  .setup-progress { justify-content: flex-start; }
  .tool-picker { grid-template-columns: 1fr; }
  .tool-option { border-right: 0; border-bottom: 1px solid var(--line); }
  .tool-option:last-child { border-bottom: 0; }
  .mode-control { width: 100%; }
  .mode-control button { padding: 0 7px; }
}

/* ── Visual refresh: unified product UI ───────────────────── */
:root {
  --bg: var(--brand-bg);
  --panel: var(--brand-surface);
  --panel-strong: var(--brand-surface-2);
  --ink: var(--brand-ink);
  --muted: var(--brand-muted);
  --line: var(--brand-line);
  --accent: var(--brand-accent);
  --accent-dark: var(--brand-accent-dark);
  --accent-soft: var(--brand-accent-soft);
  --radius: var(--brand-radius-panel);
  font-size: 15.5px;
}

body {
  background: var(--bg);
  color: var(--ink);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

.auth-screen {
  background: var(--bg);
}
.auth-card {
  border-radius: 22px;
  background: var(--panel);
  border-color: rgba(128,104,72,.22);
  box-shadow: 0 24px 64px rgba(73,55,28,.13);
}
.auth-card h1 {
  font-size: 30px;
  line-height: 1.05;
}
.auth-desc { font-size: 14.5px; line-height: 1.6; }

.shell { grid-template-columns: 268px minmax(0, 1fr); }
.sidebar {
  background: #171612;
  border-right: 1px solid rgba(255,255,255,.08);
  box-shadow: 14px 0 30px rgba(23,22,18,.08);
  padding: 22px 14px;
}
.brand {
  min-height: 52px;
  padding: 8px 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.brand-mark,
.user-avatar {
  border-radius: 11px;
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(200,150,62,.18);
}
.brand strong { font-size: 16px; letter-spacing: 0; }
.brand span { color: #b6afa4; font-size: 12.5px; }
.user-chip {
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  background: rgba(255,255,255,.065);
}
.nav { gap: 5px; }
.nav-item {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #b7b0a5;
  font-size: 14px;
  transition: transform var(--motion-fast), background var(--motion-fast), border-color var(--motion-fast), color var(--motion-fast);
}
.nav-item:hover {
  transform: translateX(2px);
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.08);
  color: #fff7ea;
}
.nav-item.active {
  background: rgba(200,150,62,.16);
  border-color: rgba(232,185,106,.24);
  color: #f0c981;
}

.main {
  max-width: 1320px;
  padding: 34px 38px 48px;
  gap: 24px;
}
.topbar { align-items: center; }
.kicker { font-size: 12px; letter-spacing: .09em; color: #8b8174; }
h1 {
  font-size: clamp(28px, 2.7vw, 40px);
  line-height: 1.02;
  letter-spacing: 0;
}
h2 { font-size: 18px; letter-spacing: 0; }
.page { gap: 24px; animation: pageIn .22s ease-out both; }
@keyframes pageIn { from { opacity: .3; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.status-grid {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}
.stat-card,
.panel,
.chat-container,
.setup-hero,
.tool-picker,
.tool-option,
.diagnostic-item,
.params-panel,
.chat-input-bar,
.chat-tabs,
.chat-toolbar,
.chat-welcome {
  border-color: rgba(128,104,72,.2);
  box-shadow: var(--brand-shadow-panel);
}
.stat-card {
  min-height: 124px;
  border-radius: 16px;
  padding: 20px;
  background: var(--panel);
}
.stat-card strong { font-size: 29px; letter-spacing: 0; }
.stat-card small,
.muted,
.section-head p,
.auth-desc { font-size: 14px; line-height: 1.55; }
.stat-card.accent {
  background: var(--accent-soft);
  border-color: rgba(200,150,62,.32);
}

.panel,
.setup-hero,
.chat-container {
  border-radius: 18px;
  background: var(--panel);
}
.panel { padding: 22px; gap: 18px; }
.section-head {
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(222,212,198,.68);
}
.label,
.sub-heading,
th {
  font-size: 12px;
  letter-spacing: .07em;
  color: #837866;
}

.button,
.icon-button,
.chat-tool-btn,
.chat-send-btn,
.chat-attach-btn,
.chat-new-tab,
.chat-preset-btn,
.mode-control button,
input,
select,
textarea {
  border-radius: 12px;
  transition: transform var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast), box-shadow var(--motion-fast), color var(--motion-fast);
}
.button,
.icon-button,
.chat-tool-btn,
.chat-preset-btn {
  min-height: 42px;
  font-size: 14px;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
}
.button:hover,
.icon-button:hover,
.chat-tool-btn:hover,
.chat-preset-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(73,55,28,.1);
}
.button.primary,
.chat-send-btn {
  background: var(--accent);
  border-color: rgba(160,118,40,.42);
  color: #fffaf0;
}
.button.primary:hover,
.chat-send-btn:hover { background: var(--accent-dark); }
.button.ghost,
.chat-tool-btn,
.chat-preset-btn { background: rgba(255,255,255,.58); }
.button.small,
.icon-button.small { min-height: 34px; font-size: 12.5px; }

input,
select,
textarea,
.chat-select,
.chat-textarea,
.chat-system-input {
  min-height: 42px;
  border-color: #cbbca9;
  background: rgba(255,255,255,.86);
  font-size: 14px;
}
input:focus,
select:focus,
textarea:focus,
.chat-select:focus,
.chat-textarea:focus,
.chat-system-input:focus {
  outline: 0;
  box-shadow: var(--brand-focus-ring), 0 8px 18px rgba(73,55,28,.08);
}
label:not(.check) { color: #4f4639; font-size: 12.5px; }
.check { font-size: 14px; }

.table-wrap {
  border-radius: 14px;
  border-color: rgba(128,104,72,.22);
  background: var(--panel);
}
table { font-size: 14px; min-width: 720px; }
th {
  background: var(--panel-strong);
  color: var(--muted);
  padding: 13px 14px;
}
td {
  padding: 13px 14px;
  border-bottom-color: rgba(222,212,198,.78);
}
tbody tr { transition: background var(--motion-fast); }
tbody tr:hover { background: rgba(200,150,62,.06); }
code {
  font-size: 12.5px;
  color: var(--ink);
  background: rgba(200,150,62,.09);
  border: 1px solid rgba(200,150,62,.14);
  border-radius: 7px;
  padding: 1px 5px;
}

.setup-hero {
  padding: 24px;
  border: 1px solid rgba(128,104,72,.2);
}
.setup-step {
  border-radius: 999px;
  border: 1px solid rgba(128,104,72,.18);
}
.setup-step.active {
  box-shadow: 0 8px 18px rgba(200,150,62,.16);
}
.tool-picker { overflow: hidden; border-radius: 18px; background: rgba(255,253,248,.78); }
.tool-picker { background: var(--panel); }
.tool-option { background: transparent; }
.tool-option:hover,
.tool-option.active {
  background: rgba(200,150,62,.08);
}
.setup-code,
.output,
.secret-output {
  border-radius: 14px;
  border-color: var(--brand-code-bg);
  background: var(--brand-code-bg);
  color: var(--brand-code-ink);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 12px 28px rgba(23,22,18,.12);
}

.chat-container {
  border: 1px solid rgba(128,104,72,.2);
  overflow: hidden;
}
.chat-toolbar,
.chat-tabs {
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(16px);
}
.chat-messages {
  background: var(--panel-strong);
}
.chat-welcome {
  border-radius: 18px;
  background: var(--panel);
  border: 1px solid rgba(128,104,72,.16);
}
.chat-input-bar {
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(18px);
}
.chat-textarea { line-height: 1.55; }
.pill {
  min-height: 24px;
  padding: 0 10px;
  border-radius: var(--brand-radius-pill);
  font-size: 11.5px;
}

@media (max-width: 760px) {
  .main { padding: 18px; }
  .sidebar { box-shadow: none; }
  .nav-item:hover { transform: none; }
  .section-head { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
