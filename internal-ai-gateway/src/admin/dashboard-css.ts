import { brandTokensCss } from '../shared/brand-tokens.js';

export const adminCss = brandTokensCss + `

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
  gap: 20px;
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

/* Nav */
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.nav-group-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #475467;
  padding: 14px 12px 4px;
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
.sidebar-foot {
  padding: 8px 4px;
}

/* ── Main content ── */
.main {
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1480px;
  width: 100%;
}

/* ── Top bar ── */
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
h1 { margin: 0; font-size: clamp(22px, 3vw, 32px); line-height: 1.1; }
h2 { margin: 0; font-size: 17px; }
h3 { margin: 0; font-size: 14px; }
p { margin: 0; }

.topbar-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.admin-token {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.session-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
.button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
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
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.stat-card strong { font-size: 26px; line-height: 1.1; }
.stat-card small, .muted { color: var(--muted); font-size: 13px; }
.stat-card.accent { border-color: rgba(200,150,62,.3); background: var(--accent-soft); }

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
.subtle-panel { background: linear-gradient(180deg, #fff, var(--panel-strong)); }
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.section-head p { color: var(--muted); font-size: 13px; margin-top: 5px; }
.label { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.timestamp { color: var(--muted); font-size: 12px; white-space: nowrap; }
.sub-heading { font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
.empty-state { color: var(--muted); font-size: 13px; padding: 12px; }

.command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr);
  gap: 16px;
}
.alert-list,
.rank-list,
.detail-grid {
  display: grid;
  gap: 10px;
}
.alert-item,
.rank-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel-strong);
}
.alert-item div { display: grid; gap: 3px; min-width: 0; }
.alert-item strong,
.alert-item span,
.rank-item code,
.rank-item span { overflow-wrap: anywhere; }
.alert-item div span { color: var(--muted); font-size: 12px; }
.rank-num {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent-dark);
  font-size: 12px;
  font-weight: 800;
}
.detail-card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
}
.detail-card strong { font-size: 17px; }
.detail-card small { color: var(--muted); overflow-wrap: anywhere; }

/* ── Provider cards ── */
.provider-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.provider {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  background: var(--panel-strong);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.provider-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; }

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

/* ── Tables ── */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
table { width: 100%; min-width: 600px; border-collapse: collapse; font-size: 13px; }
th, td { padding: 11px 13px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { background: var(--panel-strong); color: #475467; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
tr:last-child td { border-bottom: 0; }
.empty-td { color: var(--muted); font-style: italic; }
code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }

/* ── Forms ── */
label:not(.check) { display: grid; gap: 5px; color: #344054; font-size: 12px; font-weight: 700; }
label span { display: block; }
.check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #344054; font-weight: 500; cursor: pointer; }
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
textarea { resize: vertical; min-height: 140px; line-height: 1.5; }

.inline-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}
.policy-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.console-grid {
  display: grid;
  grid-template-columns: 1.2fr .8fr .8fr;
  gap: 14px;
}
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.three-col-fluid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.form-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wide { grid-column: 1 / -1; }

.builder-box {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel-strong);
}
.builder-title {
  color: #344054;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.builder-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.builder-checks .check {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
}
.builder-checks input {
  width: auto;
  min-height: 0;
  padding: 0;
}
.compact-output { min-height: 84px; max-height: 260px; }

/* ── Outputs ── */
.output, .secret-output {
  margin: 0;
  min-height: 100px;
  max-height: 480px;
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

/* ── Modal ── */
dialog.modal {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0;
  width: min(580px, 95vw);
  box-shadow: 0 20px 60px rgba(0,0,0,.18);
}
dialog.modal::backdrop { background: rgba(0,0,0,.4); backdrop-filter: blur(2px); }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-header h2 { font-size: 16px; }
dialog.modal .policy-form { padding: 20px; }

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
  min-width: 260px;
  max-width: 380px;
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

/* ── Hidden utility ── */
.hidden { display: none !important; }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .status-grid { grid-template-columns: repeat(2, 1fr); }
  .provider-list { grid-template-columns: repeat(2, 1fr); }
  .inline-form { grid-template-columns: repeat(2, 1fr); }
  .console-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 760px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; flex-direction: row; flex-wrap: wrap; padding: 12px; gap: 10px; }
  .brand { flex: 1; }
  .nav { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .nav-group-label { display: none; }
  .nav-item-console { margin-top: 0; border-top: none; padding-top: 9px; }
  .sidebar-foot { display: none; }
  .main { padding: 16px; }
  .status-grid, .provider-list, .two-col, .console-grid, .inline-form { grid-template-columns: 1fr; }
  .topbar { flex-direction: column; }
}

/* Onboard result */
.onboard-result { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.onboard-result-label { font-size: 13px; font-weight: 600; color: var(--warn); margin: 0 0 8px; }

/* Analytics */
.analytics-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.chart-card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; }
.chart-card.chart-wide { grid-column: span 2; }
.chart-title { font-size: 12px; font-weight: 600; color: var(--muted); margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; }
.chart-area { min-height: 160px; }
.period-selector { display: flex; gap: 4px; }
.period-btn { background: var(--panel-strong); border: 1px solid var(--line); color: var(--muted); padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
.period-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

/* Pagination + filter */
.pagination { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.audit-filter { margin-bottom: 12px; }

/* Provider health (recent) */
.provider-health-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.provider-health-card { background: var(--panel-strong); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.provider-health-card .ph-title { display: flex; align-items: center; justify-content: space-between; }
.pill.health-good { background: #d1fae5; color: #047857; }
.pill.health-warn { background: #fef3c7; color: #92400e; }
.pill.health-bad { background: #fee2e2; color: #b91c1c; }

@media (max-width: 768px) {
  .analytics-cards { grid-template-columns: repeat(2, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
  .chart-card.chart-wide { grid-column: span 1; }
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
.brand-mark {
  border-radius: 11px;
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(200,150,62,.18);
}
.brand strong { font-size: 16px; letter-spacing: 0; }
.brand span { color: #b6afa4; font-size: 12.5px; }
.nav { gap: 5px; }
.nav-group-label {
  color: #817a70;
  font-size: 10.5px;
  padding: 18px 12px 6px;
}
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
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}
.nav-dot { width: 7px; height: 7px; }

.main {
  max-width: 1540px;
  padding: 34px 38px 48px;
  gap: 24px;
}
.topbar {
  padding: 2px 0 4px;
  align-items: center;
}
.kicker { font-size: 12px; letter-spacing: .09em; color: #8b8174; }
h1 {
  font-size: clamp(28px, 2.8vw, 42px);
  line-height: 1.02;
  letter-spacing: 0;
}
h2 { font-size: 18px; letter-spacing: 0; }
h3 { font-size: 15px; letter-spacing: 0; }
.page { gap: 24px; animation: pageIn .22s ease-out both; }
@keyframes pageIn { from { opacity: .3; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.status-grid {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}
.stat-card,
.panel,
.chart-card,
.provider,
.detail-card,
.builder-box,
.provider-health-card,
.alert-item,
.rank-item {
  border-color: rgba(128,104,72,.2);
  box-shadow: var(--brand-shadow-panel);
}
.stat-card {
  min-height: 132px;
  border-radius: 16px;
  padding: 20px;
  background: var(--panel);
}
.stat-card strong {
  font-size: 30px;
  letter-spacing: 0;
}
.stat-card small,
.muted,
.section-head p { font-size: 14px; line-height: 1.55; }
.stat-card.accent {
  background: var(--accent-soft);
  border-color: rgba(200,150,62,.32);
}

.panel {
  border-radius: 18px;
  padding: 22px;
  gap: 18px;
  background: var(--panel);
}
.subtle-panel { background: var(--panel-strong); }
.command-grid {
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
  gap: 18px;
}
.section-head {
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(222,212,198,.68);
  padding-bottom: 14px;
}
.label,
.sub-heading,
th,
.chart-title {
  font-size: 12px;
  letter-spacing: .07em;
  color: #837866;
}

.button,
.icon-button,
input,
select,
textarea {
  border-radius: 12px;
  transition: transform var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast), box-shadow var(--motion-fast), color var(--motion-fast);
}
.button,
.icon-button {
  min-height: 42px;
  padding: 0 16px;
  font-size: 14px;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
}
.button:hover,
.icon-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(73,55,28,.1);
}
.button.primary {
  background: var(--accent);
  border-color: rgba(160,118,40,.42);
  color: #fffaf0;
}
.button.primary:hover { background: var(--accent-dark); }
.button.ghost { background: rgba(255,255,255,.58); }
.button.small,
.icon-button.small {
  min-height: 34px;
  font-size: 12.5px;
}

input,
select,
textarea {
  min-height: 42px;
  border-color: #cbbca9;
  background: rgba(255,255,255,.86);
  font-size: 14px;
}
input:focus,
select:focus,
textarea:focus {
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

.pill {
  min-height: 24px;
  padding: 0 10px;
  border-radius: var(--brand-radius-pill);
  font-size: 11.5px;
}
.output,
.secret-output,
.setup-code {
  border-radius: 14px;
  border-color: var(--brand-code-bg);
  background: var(--brand-code-bg);
  color: var(--brand-code-ink);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 12px 28px rgba(23,22,18,.12);
}
.toast {
  border-radius: 14px;
  box-shadow: var(--brand-shadow-popover);
}

@media (max-width: 760px) {
  .main { padding: 18px; }
  .sidebar { box-shadow: none; }
  .nav-item:hover { transform: none; }
  .command-grid { grid-template-columns: 1fr; }
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
