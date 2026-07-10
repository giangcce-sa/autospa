import { brandTokensCss } from '../shared/brand-tokens.js';

export const landingCss = brandTokensCss + `

/* ── Theme variables ──────────────────────────────────────────────────────── */
:root {
  --bg: #f5f2ee;
  --surface: #faf7f3;
  --surface-soft: #f0ebe4;
  --surface-cool: #ede8e1;
  --ink: #1a1008;
  --muted: #6b5e4e;
  --line: #e8ddd0;
  --card-bg: rgba(255,255,255,0.72);
  --card-border: #ddd0be;
  --marquee-pill-bg: rgba(255,255,255,0.72);
  --hero-bg: #0c1425;
  --hero-grid: #C8963E;
  --accent: #C8963E;
  --accent-light: #d4a553;
  --accent-dark: #A07628;
  --accent-soft: #FDF6E3;
  --accent-glow: #e8b96a;
  --radius: 10px;
}
[data-theme="dark"] {
  --bg: #0f1117;
  --surface: #1a1d27;
  --ink: #f3f4f6;
  --muted: #9ca3af;
  --line: #2a2d3a;
  --card-bg: #1a1d27;
  --card-border: #2a2d3a;
  --marquee-pill-bg: #1a1d27;
  --surface-soft: #151b21;
  --surface-cool: #121820;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; scroll-padding-top: 76px; }

body {
  font-family: 'Be Vietnam Pro', 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  line-height: 1.6;
  overflow-x: hidden;
  transition: background 0.3s ease, color 0.3s ease;
}
.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 300;
  transform: translateY(-150%);
  background: var(--ink);
  color: var(--surface);
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
}
.skip-link:focus { transform: translateY(0); }
:focus-visible { outline: 3px solid rgba(200,150,62,0.4); outline-offset: 3px; }

/* ── Navbar ─────────────────────────────────────────────────────────────────── */
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 200;
  height: 64px;
  background: rgba(245,247,246,0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
[data-theme="dark"] nav {
  background: rgba(13,15,22,0.96);
  border-bottom-color: rgba(255,255,255,0.07);
  box-shadow: 0 1px 8px rgba(0,0,0,0.35);
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}
.nav-logo {
  width: 32px; height: 32px;
  background: var(--accent);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}
.nav-wordmark {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.2px;
  transition: color 0.3s;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}
.nav-link:hover { color: var(--ink); background: var(--line); }
.nav-link.active { color: var(--accent); background: rgba(200,150,62,0.1); }
.nav-link-cta {
  color: #fff !important;
  background: var(--accent);
  padding: 6px 14px;
  border-radius: 6px;
  transition: background 0.2s, transform 0.1s;
}
.nav-link-cta:hover { background: var(--accent-dark); transform: translateY(-1px); }

/* Theme toggle button */
.theme-toggle {
  background: var(--line);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 15px;
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
  line-height: 1;
}
.theme-toggle:hover { background: var(--card-border); }
.theme-icon-moon { display: none; }
[data-theme="dark"] .theme-icon-sun { display: none; }
[data-theme="dark"] .theme-icon-moon { display: inline; }

/* Mobile nav controls */
.nav-right-mobile {
  display: none;
  align-items: center;
  gap: 8px;
}
.nav-hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px; height: 36px;
  background: var(--line);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  cursor: pointer;
  padding: 8px 7px;
}
.nav-hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--ink);
  border-radius: 2px;
  transition: transform 0.2s, opacity 0.2s;
}

/* Mobile dropdown */
.nav-mobile-dropdown {
  display: none;
  position: fixed;
  top: 64px; left: 0; right: 0;
  z-index: 199;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  flex-direction: column;
  padding: 8px 16px 16px;
  gap: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
.nav-mobile-dropdown.open { display: flex; }
.nav-mobile-link {
  font-size: 15px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  padding: 12px 16px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}
.nav-mobile-link:hover { color: var(--ink); background: var(--line); }
.nav-mobile-cta {
  color: #fff !important;
  background: var(--accent);
  margin-top: 4px;
}
.nav-mobile-cta:hover { background: var(--accent-light); }

/* ── Hero ────────────────────────────────────────────────────────────────────── */
.hero {
  min-height: 760px;
  min-height: min(760px, 100dvh);
  background: var(--hero-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 84px 24px 44px;
  position: relative;
  overflow: hidden;
}
.hero-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(45,212,191,0.15) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
}
.hero-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(12,20,37,0.9) 100%);
  pointer-events: none;
}
.hero-orb-1 {
  position: absolute; top: -100px; left: -100px;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(45,212,191,0.12), transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}
.hero-orb-2 {
  position: absolute; bottom: -80px; right: -80px;
  width: 350px; height: 350px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(15,118,110,0.15), transparent 70%);
  filter: blur(50px);
  pointer-events: none;
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-glow);
  border: 1px solid rgba(45,212,191,0.35);
  border-radius: 100px;
  padding: 5px 14px;
  margin-bottom: 28px;
  letter-spacing: 0.2px;
}
.hero h1 {
  font-size: clamp(36px, 9vw, 80px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -2.5px;
  color: #fff;
  margin-bottom: 0;
}
.hero-offer {
  margin-top: 8px;
  font-size: clamp(24px, 4vw, 42px);
  font-weight: 700;
  line-height: 1.12;
  color: var(--accent);
  text-wrap: balance;
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
.gradient-text {
  background: linear-gradient(135deg, #C8963E, #e8b96a, #d4a553, #C8963E);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 4s ease infinite;
}
.hero-subtitle {
  margin-top: 18px;
  font-size: clamp(15px, 2vw, 18px);
  color: rgba(255,255,255,0.62);
  line-height: 1.7;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}
.hero-ctas {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 28px;
  flex-wrap: wrap;
}
@keyframes ctaGlow {
  0%, 100% { box-shadow: 0 8px 24px -8px rgba(15,118,110,0.5), 0 0 0 0 rgba(45,212,191,0.4); }
  50%       { box-shadow: 0 12px 32px -8px rgba(15,118,110,0.7), 0 0 0 8px rgba(45,212,191,0); }
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 13px 24px;
  border-radius: var(--radius);
  text-decoration: none;
  animation: ctaGlow 2.4s ease infinite;
  transition: background 0.2s, transform 0.1s;
}
.btn-primary:hover { background: var(--accent-light); transform: translateY(-1px); }
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 13px 24px;
  border-radius: var(--radius);
  text-decoration: none;
  border: 1.5px solid rgba(255,255,255,0.28);
  transition: border-color 0.2s, background 0.2s, transform 0.1s;
}
.btn-secondary:hover { border-color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.06); transform: translateY(-1px); }

/* ── Hero badge ─────────────────────────────────────────────────────────── */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  background: rgba(45,212,191,0.08);
  border: 1px solid rgba(45,212,191,0.2);
  border-radius: 100px;
  padding: 5px 14px;
  margin-bottom: 12px;
  opacity: 0;
  transition: opacity 0.6s ease 2.5s;
}
.hero-badge.visible { opacity: 1; }
.badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #34d399;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(52,211,153,0.7);
  animation: pulseDot 2s ease infinite;
}
@keyframes pulseDot {
  0%, 100% { box-shadow: 0 0 4px rgba(52,211,153,0.7); }
  50% { box-shadow: 0 0 10px rgba(52,211,153,1); }
}

/* ── Terminal window ──────────────────────────────────────────────────── */
.terminal-wrap {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.terminal {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(45,212,191,0.18);
  border-radius: 12px;
  width: 100%;
  max-width: 640px;
  text-align: left;
  overflow: hidden;
  box-shadow: 0 24px 80px -20px rgba(0,0,0,0.5);
}
.term-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.term-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.term-dot-r { background: #ff5f56; }
.term-dot-y { background: #ffbd2e; }
.term-dot-g { background: #27c93f; }
.term-title {
  flex: 1;
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  margin-left: -36px;
}
.term-body {
  padding: 14px 18px 16px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  line-height: 1.7;
  min-height: 118px;
}
.term-line { color: rgba(255,255,255,0.85); white-space: pre-wrap; word-break: break-all; }
.term-cmd { color: var(--accent-glow); }
.term-flag { color: rgba(255,255,255,0.55); }
.term-string { color: #fbbf24; }
.term-response { color: rgba(255,255,255,0.55); }
.term-success { color: #34d399; }
.term-cursor {
  display: inline-block;
  width: 8px; height: 14px;
  background: var(--accent-glow);
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Marquee ────────────────────────────────────────────────────────────── */
.marquee-section {
  background: var(--surface-soft);
  padding: 48px 0;
  overflow: hidden;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  transition: background 0.3s ease;
}
.marquee-label {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--muted);
  margin-bottom: 24px;
}
.compact-header { margin-bottom: 30px; padding-inline: 24px; }
.skeleton-pill {
  min-width: 160px;
  color: transparent;
  background: linear-gradient(90deg, var(--line), var(--surface), var(--line));
  background-size: 200% 100%;
  animation: skeleton 1.2s linear infinite;
}
@keyframes skeleton { to { background-position: -200% 0; } }
.marquee-track {
  position: relative;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
  margin-bottom: 12px;
}
.marquee-track:last-child { margin-bottom: 0; }
.marquee-inner {
  display: flex;
  gap: 10px;
  width: max-content;
}
@keyframes marqueeLeft {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes marqueeRight {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}
.marquee-inner.left  { animation: marqueeLeft  28s linear infinite; }
.marquee-inner.right { animation: marqueeRight 24s linear infinite; }
.marquee-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 100px;
  border: 1px solid var(--line);
  background: var(--marquee-pill-bg);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: background 0.3s, border-color 0.3s, color 0.3s;
}
.pill-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent-glow);
  flex-shrink: 0;
}

/* ── Stats bar ──────────────────────────────────────────────────────────── */
.stats-section {
  background: #0d2626;
  padding: 56px 24px;
}
.stats-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  max-width: 860px;
  margin: 0 auto;
}
.stat-item {
  flex: 1;
  min-width: 160px;
  text-align: center;
  padding: 24px 20px;
  border-bottom: 2px solid transparent;
  position: relative;
}
.stat-item::after {
  content: '';
  position: absolute;
  bottom: 0; left: 20%; right: 20%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #C8963E, transparent);
  border-radius: 2px;
}
.stat-number {
  font-size: clamp(36px, 6vw, 56px);
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #C8963E, #d4a553);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.stat-live { font-variant-numeric: tabular-nums; }
.stat-label {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.45);
}

/* ── How it works ───────────────────────────────────────────────────────── */
.how-section {
  background: var(--surface);
  padding: 80px 24px;
  transition: background 0.3s ease;
}
.section-header {
  text-align: center;
  margin-bottom: 64px;
}
.section-eyebrow {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--accent);
  margin-bottom: 12px;
}
.section-title {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--ink);
  margin-bottom: 12px;
}
.section-subtitle {
  font-size: 16px;
  color: var(--muted);
  max-width: 480px;
  margin: 0 auto;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}
.steps-grid::before {
  content: '';
  position: absolute;
  top: 28px;
  left: calc(16.66% + 16px);
  right: calc(16.66% + 16px);
  height: 1px;
  border-top: 2px dashed var(--line);
  pointer-events: none;
}
.step {
  text-align: center;
  padding: 24px 16px;
}
.step-num {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px -4px rgba(15,118,110,0.45);
}
.step h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
}
.step p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.65;
}

/* ── Wave dividers ──────────────────────────────────────────────────────── */
.wave-divider {
  line-height: 0;
  overflow: hidden;
  height: 48px;
}
.wave-divider svg {
  display: block;
  width: 100%;
  height: 48px;
}
.wave-to-dark { background: var(--bg); }
.wave-to-light { background: var(--hero-bg); }
[data-theme="dark"] .wave-to-dark { display: none; }
[data-theme="dark"] .wave-to-light { display: none; }

/* ── Architecture ────────────────────────────────────────────────────────── */
.arch-section {
  background: var(--hero-bg);
  padding: 80px 24px 100px;
}
.arch-section .section-title { color: #fff; }
.arch-section .section-subtitle { color: rgba(255,255,255,0.55); }
.arch-diagram-wrap {
  max-width: 800px;
  margin: 0 auto;
  overflow-x: auto;
  padding: 18px;
  border: 1px solid rgba(200,150,62,.18);
  border-radius: 18px;
  background: rgba(23,22,18,.74);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 18px 44px rgba(0,0,0,.24);
}
.arch-svg {
  width: 100%;
  min-width: 380px;
  height: auto;
  display: block;
  filter: drop-shadow(0 0 24px rgba(45,212,191,0.08));
}

/* ── Features grid ───────────────────────────────────────────────────────── */
.features-section {
  background: var(--surface-cool);
  padding: 80px 24px;
  border-top: 1px solid var(--line);
  transition: background 0.3s ease;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1040px;
  margin: 0 auto;
}
.features-grid .feature-card:nth-child(1),
.features-grid .feature-card:nth-child(4) { grid-column: span 2; }
.feature-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 28px 24px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 30px -24px rgba(20,46,43,0.42);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.feature-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-glow));
  border-radius: 14px 14px 0 0;
}
.feature-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 60%;
  background: linear-gradient(to bottom, rgba(15,118,110,0.04), transparent);
  pointer-events: none;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px -12px rgba(15,118,110,0.2);
  border-color: rgba(45,212,191,0.45);
}
[data-theme="dark"] .feature-card:hover {
  border-color: rgba(45,212,191,0.3);
  box-shadow: 0 0 0 1px rgba(45,212,191,0.1), 0 12px 40px -12px rgba(0,0,0,0.5);
}
.feature-icon {
  font-size: 28px;
  margin-bottom: 14px;
  display: block;
  position: relative;
  z-index: 1;
}
.feature-card h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}
.feature-card p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.65;
  position: relative;
  z-index: 1;
}
.feature-card code {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  background: rgba(15,118,110,0.1);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── Code section ────────────────────────────────────────────────────────── */
.code-section {
  background: var(--hero-bg);
  padding: 80px 24px;
}
.code-section .section-title { color: #fff; }
.code-section .section-subtitle { color: rgba(255,255,255,0.5); }
.code-wrap {
  max-width: 740px;
  margin: 0 auto;
}
.code-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 0;
  background: rgba(255,255,255,0.05);
  border-radius: 10px 10px 0 0;
  padding: 6px 6px 0;
  border: 1px solid rgba(255,255,255,0.08);
  border-bottom: none;
}
.code-tab {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  background: transparent;
  border: none;
  padding: 8px 18px;
  border-radius: 7px 7px 0 0;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.code-tab.active {
  color: var(--accent-glow);
  background: rgba(45,212,191,0.1);
}
.code-tab:hover:not(.active) { color: rgba(255,255,255,0.75); }
.code-block-wrap {
  border-radius: 0 0 12px 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  border-top: none;
}
.code-block {
  display: none;
  background: rgba(255,255,255,0.03);
  padding: 28px;
  overflow-x: auto;
}
.code-block.active { display: block; }
.code-block code {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13.5px;
  line-height: 1.75;
  white-space: pre;
  color: rgba(255,255,255,0.82);
}
.hl-kw  { color: var(--accent-glow); }
.hl-str { color: #fbbf24; }
.hl-cm  { color: rgba(255,255,255,0.35); font-style: italic; }
.hl-flag{ color: rgba(255,255,255,0.5); }
.hl-key { color: #a78bfa; }

/* ── Terminal demo row ────────────────────────────────────────────────────── */
.term-demo-row {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 10px 22px 16px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.term-demo-row.visible { display: flex; }
.term-prompt-sym {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  color: var(--accent-glow);
  flex-shrink: 0;
}
.term-demo-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  caret-color: var(--accent-glow);
}
.term-demo-input::placeholder { color: rgba(255,255,255,0.3); }
.term-demo-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
  font-family: 'IBM Plex Mono', monospace;
  transition: background 0.2s, opacity 0.2s;
  flex-shrink: 0;
}
.term-demo-btn:hover { background: var(--accent-light); }
.term-demo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.term-error { color: #f87171; }

/* ── Comparison ──────────────────────────────────────────────────────────── */
.compare-section {
  background: var(--surface-soft);
  padding: 80px 24px;
  border-top: 1px solid var(--line);
  transition: background 0.3s ease;
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  max-width: 880px;
  margin: 0 auto;
}
.compare-col {
  border-radius: 14px;
  padding: 32px 28px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  transition: background 0.3s, border-color 0.3s;
}
.compare-before {
  opacity: 0.8;
}
.compare-after {
  border-color: rgba(45,212,191,0.4);
  background: linear-gradient(160deg, rgba(15,118,110,0.04), var(--card-bg));
  box-shadow: 0 0 0 1px rgba(45,212,191,0.1), 0 8px 32px -12px rgba(15,118,110,0.15);
}
[data-theme="dark"] .compare-after {
  background: linear-gradient(160deg, rgba(15,118,110,0.08), var(--card-bg));
}
.compare-col-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.compare-col-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}
.compare-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 3px 10px;
  border-radius: 100px;
}
.compare-badge-no {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.25);
}
.compare-badge-yes {
  background: rgba(15,118,110,0.12);
  color: var(--accent);
  border: 1px solid rgba(45,212,191,0.35);
}
.compare-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.compare-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.55;
}
.cmp-x {
  color: #ef4444;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.cmp-check {
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
@media (max-width: 640px) {
  .compare-grid { grid-template-columns: 1fr; }
}

/* ── Use cases ────────────────────────────────────────────────────────────── */
.usecases-section {
  background: var(--surface);
  padding: 80px 24px;
  border-top: 1px solid var(--line);
  transition: background 0.3s ease;
}
.usecases-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1040px;
  margin: 0 auto;
}
.usecase-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 28px 24px;
  box-shadow: 0 10px 30px -24px rgba(20,46,43,0.36);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.usecase-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 32px -12px rgba(15,118,110,0.18);
  border-color: rgba(45,212,191,0.35);
}
.usecase-icon {
  font-size: 32px;
  margin-bottom: 16px;
  display: block;
}
.usecase-card h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 10px;
}
.usecase-card p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.65;
  margin-bottom: 18px;
}
.usecase-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.usecase-tags span {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  background: rgba(15,118,110,0.08);
  border: 1px solid rgba(45,212,191,0.2);
  border-radius: 4px;
  padding: 2px 8px;
}
@media (max-width: 768px) {
  .usecases-grid { grid-template-columns: 1fr; }
}

/* ── Sticky CTA bar ───────────────────────────────────────────────────────── */
.sticky-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 190;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px 24px;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  flex-wrap: wrap;
}
.sticky-bar.visible { transform: translateY(0); }
.sticky-bar.hidden { display: none; }
.sticky-bar-text {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.92;
}
.sticky-bar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sticky-bar-btn {
  background: rgba(255,255,255,0.18);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 18px;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
  border: 1px solid rgba(255,255,255,0.3);
}
.sticky-bar-btn:hover { background: rgba(255,255,255,0.28); }
.sticky-bar-close {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}
.sticky-bar-close:hover { color: #fff; }
@media (max-width: 480px) {
  .sticky-bar { gap: 12px; padding: 12px 16px; }
  .sticky-bar-text { font-size: 13px; text-align: center; }
}

/* ── Final CTA ────────────────────────────────────────────────────────────── */
.cta-section {
  background: #d7e9e5;
  padding: 80px 24px 72px;
  text-align: center;
  border-top: 1px solid #b8d5cf;
}
[data-theme="dark"] .cta-section {
  background: #0d1f1f;
  border-top-color: rgba(45,212,191,0.12);
}
.cta-section .section-title { color: var(--ink); }
.cta-section .section-subtitle { color: var(--muted); font-size: 17px; margin-top: 8px; }
.cta-buttons {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-top: 36px;
  flex-wrap: wrap;
}
.btn-teal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 13px 26px;
  border-radius: var(--radius);
  text-decoration: none;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 4px 20px -6px rgba(200,150,62,0.5);
}
.btn-teal:hover { background: var(--accent-dark); transform: translateY(-1px); }
.btn-outline-teal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 15px;
  font-weight: 600;
  padding: 13px 26px;
  border-radius: var(--radius);
  text-decoration: none;
  border: 1.5px solid rgba(200,150,62,0.45);
  transition: border-color 0.2s, background 0.2s, transform 0.1s;
}
.btn-outline-teal:hover { border-color: var(--accent); background: rgba(200,150,62,0.06); transform: translateY(-1px); }

/* ── Footer ──────────────────────────────────────────────────────────────── */
footer {
  background: var(--hero-bg);
  padding: 40px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255,255,255,0.07);
  flex-wrap: wrap;
  gap: 20px;
}
.footer-brand .nav-wordmark { font-size: 16px; }
.footer-brand .footer-tagline {
  font-size: 13px;
  color: rgba(255,255,255,0.35);
  margin-top: 2px;
}
.footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.footer-copy {
  font-size: 13px;
  color: rgba(255,255,255,0.35);
}
.footer-links {
  display: flex;
  gap: 18px;
}
.footer-link {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-link:hover { color: var(--accent-glow); }

/* ── Architecture lanes ─────────────────────────────────────────────────── */
.architecture-lanes {
  max-width: 960px;
  margin: 0 auto 36px;
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 14px;
  align-items: stretch;
}
.architecture-lane {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 22px;
}
.architecture-lane h3 { color: #fff; font-size: 17px; margin: 8px 0; }
.architecture-lane p { color: rgba(255,255,255,0.56); font-size: 13px; line-height: 1.6; }
.lane-index { font: 600 11px 'IBM Plex Mono', monospace; color: var(--accent-glow); text-transform: uppercase; }
.lane-arrow { color: var(--accent-glow); align-self: center; font-size: 24px; transform: rotate(-90deg); }

/* ── Operations ─────────────────────────────────────────────────────────── */
.operations-section { background: var(--surface-cool); padding: 88px 24px 96px; border-top: 1px solid var(--line); }
.operations-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1.15fr .85fr; gap: 24px; }
.usage-panel, .security-panel { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 32px; }
.usage-panel .section-title, .security-panel .section-title { font-size: clamp(25px, 3.4vw, 36px); }
.usage-panel .section-subtitle { margin: 0; }
.usage-total-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 28px 0 22px; }
.usage-total-row div { padding: 14px 0; border-top: 1px solid var(--line); }
.usage-total-row strong, .usage-total-row span { display: block; }
.usage-total-row strong { font: 700 22px 'IBM Plex Mono', monospace; color: var(--ink); }
.usage-total-row span { color: var(--muted); font-size: 12px; margin-top: 4px; }
.usage-chart { height: 150px; display: flex; align-items: end; gap: 8px; border-bottom: 1px solid var(--line); padding-top: 12px; }
.usage-bar { flex: 1; min-width: 18px; background: var(--accent); opacity: .72; border-radius: 4px 4px 0 0; position: relative; transition: opacity .2s; }
.usage-bar:hover { opacity: 1; }
.usage-bar span { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); color: var(--muted); font: 10px 'IBM Plex Mono', monospace; }
.chart-empty { align-self: center; width: 100%; text-align: center; color: var(--muted); font-size: 13px; }
.security-list { list-style: none; display: grid; gap: 0; margin-top: 24px; }
.security-list li { padding: 16px 0; border-top: 1px solid var(--line); }
.security-list strong, .security-list span { display: block; }
.security-list strong { color: var(--ink); font-size: 14px; }
.security-list span { color: var(--muted); font-size: 13px; margin-top: 5px; line-height: 1.55; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,.12); }
.status-dot.ready { background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.12); }
.status-dot.error { background: #ef4444; box-shadow: 0 0 0 4px rgba(239,68,68,.12); }

/* ── Light theme section treatment ───────────────────────────────────────── */
[data-theme="light"] .hero {
  background: #f7f9f8;
  border-bottom: 1px solid var(--line);
}
[data-theme="light"] .hero-grid {
  background-image: radial-gradient(circle, rgba(15,118,110,0.12) 1px, transparent 1px);
}
[data-theme="light"] .hero-vignette {
  background: radial-gradient(ellipse 80% 72% at 50% 42%, rgba(255,255,255,0.2) 20%, rgba(221,231,229,0.58) 100%);
}
[data-theme="light"] .hero-orb-1,
[data-theme="light"] .hero-orb-2 {
  opacity: 0.35;
}
[data-theme="light"] .hero h1 {
  color: var(--ink);
}
[data-theme="light"] .hero-subtitle {
  color: var(--muted);
}
[data-theme="light"] .btn-secondary {
  color: var(--ink);
  border-color: rgba(20,32,31,0.28);
}
[data-theme="light"] .btn-secondary:hover {
  border-color: rgba(20,32,31,0.5);
  background: rgba(20,32,31,0.05);
}
[data-theme="light"] .hero-badge {
  color: #42615d;
  background: rgba(255,255,255,0.7);
  border-color: rgba(15,118,110,0.24);
}
[data-theme="light"] .terminal {
  background: #111b2d;
}

[data-theme="light"] .stats-section {
  background: #edf2f1;
  border-block: 1px solid var(--line);
}
[data-theme="light"] .stat-label {
  color: var(--muted);
}

[data-theme="light"] .wave-divider {
  display: none;
}
[data-theme="light"] .arch-section {
  background: #f7f9f8;
}
[data-theme="light"] .arch-section .section-title,
[data-theme="light"] .code-section .section-title {
  color: var(--ink);
}
[data-theme="light"] .arch-section .section-subtitle,
[data-theme="light"] .code-section .section-subtitle {
  color: var(--muted);
}
[data-theme="light"] .arch-diagram-wrap {
  background: #101827;
  border: 1px solid #243247;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 20px 50px -34px rgba(15,31,47,0.62);
}
[data-theme="light"] .architecture-lane {
  background: rgba(255,255,255,0.78);
  border-color: var(--line);
}
[data-theme="light"] .architecture-lane h3 { color: var(--ink); }
[data-theme="light"] .architecture-lane p { color: var(--muted); }
[data-theme="light"] .lane-arrow { color: var(--accent); }

[data-theme="light"] .code-section {
  background: #e7ecef;
  border-block: 1px solid var(--line);
}
[data-theme="light"] .code-wrap {
  background: #101827;
  border-radius: 12px;
  box-shadow: 0 20px 50px -34px rgba(15,31,47,0.62);
}

[data-theme="light"] footer {
  background: #e2e8eb;
  border-top-color: var(--line);
}
[data-theme="light"] .footer-brand .nav-wordmark {
  color: var(--ink);
}
[data-theme="light"] .footer-brand .footer-tagline,
[data-theme="light"] .footer-copy,
[data-theme="light"] .footer-link {
  color: var(--muted);
}
[data-theme="light"] .footer-link:hover {
  color: var(--accent);
}

/* ── Scroll fade-in ───────────────────────────────────────────────────────── */
.fade-up {
  opacity: 1;
  transform: translateY(0);
}
.js-ready .fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.js-ready .fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Responsive — Tablet ───────────────────────────────────────────────── */
@media (max-width: 900px) {
  .steps-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .steps-grid::before { display: none; }
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .features-grid .feature-card:nth-child(1),
  .features-grid .feature-card:nth-child(4) { grid-column: span 1; }
  .architecture-lanes { grid-template-columns: 1fr; }
  .lane-arrow { transform: none; justify-self: center; }
  .operations-grid { grid-template-columns: 1fr; }
  .stats-grid { gap: 0; }
  .stat-item { min-width: 120px; }
}

/* ── Responsive — Mobile ───────────────────────────────────────────────── */
@media (max-width: 768px) {
  .nav-inner { padding: 0 16px; }
  .nav-links { display: none; }
  .nav-right-mobile { display: flex; }
  .nav-hamburger { display: flex; }

  .hero {
    min-height: auto;
    padding: 80px 16px 48px;
  }
  .terminal { max-width: 100%; }
  .term-body { font-size: 11px; padding: 14px 14px 18px; }

  .how-section,
  .features-section,
  .code-section,
  .cta-section,
  .arch-section { padding: 64px 16px; }

  .code-wrap { max-width: 100%; }
  .code-block { font-size: 12px; }
  .code-block code { font-size: 12px; }

  .arch-diagram-wrap { padding: 8px 0; }
  .operations-section { padding: 64px 16px 76px; }

  .testimonial-card { padding: 28px 24px; }
  .quote-body { font-size: 16px; }

  footer { flex-direction: column; align-items: flex-start; padding: 32px 24px; }
  .footer-right { align-items: flex-start; }
}

@media (max-width: 480px) {
  .features-grid { grid-template-columns: 1fr; }
  .stats-grid { flex-direction: column; align-items: center; }
  .stat-item { width: 100%; max-width: 280px; }
  .hero-ctas { flex-direction: column; align-items: center; }
  .cta-buttons { flex-direction: column; align-items: center; }
  .section-header { margin-bottom: 40px; }
  .usage-total-row { grid-template-columns: 1fr; }
  .usage-panel, .security-panel { padding: 24px 18px; }
  .code-tabs { overflow-x: auto; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .marquee-inner { transform: none !important; }
}

/* ── Visual refresh: align landing with product UI ───────────────────────── */
:root {
  --bg: var(--brand-bg);
  --surface: var(--brand-surface);
  --surface-soft: var(--brand-surface-2);
  --surface-cool: var(--brand-bg-soft);
  --ink: var(--brand-ink);
  --muted: var(--brand-muted);
  --line: var(--brand-line);
  --card-bg: rgba(255,255,255,.86);
  --card-border: var(--brand-line);
  --radius: var(--brand-radius-panel);
}
[data-theme="dark"] {
  --bg: #12110f;
  --surface: #171612;
  --surface-soft: #1e1c18;
  --surface-cool: #171612;
  --ink: #f7f4ed;
  --muted: #b7b0a5;
  --line: rgba(255,255,255,.1);
  --card-bg: rgba(23,22,18,.86);
  --card-border: rgba(255,255,255,.12);
}

body {
  font-family: var(--brand-font);
  background: var(--bg);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
[data-theme="dark"] body {
  background: var(--bg);
}

nav {
  height: 68px;
  background: rgba(255,253,248,.88);
  border-bottom-color: rgba(128,104,72,.18);
  box-shadow: 0 14px 34px rgba(73,55,28,.08);
}
[data-theme="dark"] nav {
  background: rgba(17,16,13,.88);
  border-bottom-color: rgba(255,255,255,.09);
}
.nav-inner { max-width: 1280px; }
.nav-logo {
  border-radius: 11px;
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(200,150,62,.18);
  font-family: var(--brand-font);
  font-weight: 800;
}
.nav-wordmark { font-size: 16px; font-weight: 800; letter-spacing: 0; }
.nav-link,
.nav-mobile-link {
  border-radius: 999px;
  transition: transform var(--motion-fast), background var(--motion-fast), color var(--motion-fast);
}
.nav-link:hover,
.nav-mobile-link:hover {
  transform: translateY(-1px);
  background: rgba(200,150,62,.11);
}
.nav-link-cta,
.nav-mobile-cta,
.primary-cta,
.cta-primary,
.sticky-bar-button,
.sticky-bar-btn {
  background: var(--accent) !important;
  border-color: rgba(160,118,40,.42) !important;
  border-radius: 12px;
  box-shadow: 0 14px 30px rgba(200,150,62,.22);
  transition: transform var(--motion-fast), box-shadow var(--motion-fast), background var(--motion-fast);
}
.nav-link-cta:hover,
.nav-mobile-cta:hover,
.primary-cta:hover,
.cta-primary:hover,
.sticky-bar-button:hover,
.sticky-bar-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(200,150,62,.28);
}
.theme-toggle,
.nav-hamburger {
  border-radius: 12px;
  background: rgba(255,255,255,.66);
  border-color: rgba(128,104,72,.22);
  box-shadow: 0 1px 0 rgba(255,255,255,.8) inset;
}
[data-theme="dark"] .theme-toggle,
[data-theme="dark"] .nav-hamburger {
  background: rgba(255,255,255,.06);
}

.hero {
  background: #171612;
}
[data-theme="light"] .hero {
  background: var(--surface);
}
.hero-title {
  letter-spacing: 0;
  line-height: .98;
}
.hero-subtitle {
  font-size: clamp(17px, 1.8vw, 22px);
  line-height: 1.65;
}
.kicker,
.eyebrow,
.section-eyebrow {
  border-radius: 999px;
  border: 1px solid rgba(200,150,62,.28);
  background: rgba(200,150,62,.09);
  color: var(--accent);
}

.section-header {
  width: min(820px, 100%);
  max-width: 820px;
  margin-inline: auto;
  padding-inline: 24px;
}
.section-title {
  letter-spacing: 0;
  line-height: 1.03;
}
.section-subtitle {
  font-size: 17px;
  line-height: 1.7;
}
.feature-card,
.step-card,
.lane-card,
.operation-card,
.usage-panel,
.security-panel,
.testimonial-card,
.code-panel,
.terminal,
.compare-card {
  border-radius: 18px;
  border-color: var(--card-border);
  background: var(--card-bg);
  box-shadow: var(--brand-shadow-panel);
}
.feature-card,
.step-card,
.operation-card,
.compare-card {
  transition: transform var(--motion-med), box-shadow var(--motion-med), border-color var(--motion-med);
}
.feature-card:hover,
.step-card:hover,
.operation-card:hover,
.compare-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 48px rgba(73,55,28,.13);
  border-color: rgba(200,150,62,.3);
}
.code-panel,
.terminal {
  background: var(--brand-code-bg);
  color: var(--brand-code-ink);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 12px 28px rgba(23,22,18,.12);
}
.tab-button,
.secondary-cta,
.cta-secondary,
.code-tab {
  border-radius: 12px;
  transition: transform var(--motion-fast), background var(--motion-fast), border-color var(--motion-fast);
}
.tab-button:hover,
.secondary-cta:hover,
.cta-secondary:hover,
.code-tab:hover {
  transform: translateY(-1px);
}
.sticky-bar {
  border-color: rgba(128,104,72,.2);
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(18px);
  box-shadow: 0 -14px 34px rgba(73,55,28,.08);
}
[data-theme="dark"] .sticky-bar {
  background: rgba(18,17,15,.92);
}

.hero::before,
.hero::after,
.orb,
.glow,
.aurora {
  opacity: .18;
}
.arch-section,
.code-section,
.footer-dark,
footer {
  background: var(--surface-cool);
}
.arch-section .section-title,
.code-section .section-title,
.architecture-lane h3,
.footer-brand,
.footer-tagline {
  color: var(--ink);
}
.arch-section .section-subtitle,
.code-section .section-subtitle,
.architecture-lane p,
.footer-copy,
.footer-link {
  color: var(--muted);
}
.btn-primary,
.btn-outline-teal,
.sticky-bar-btn,
.term-send,
.tab-button.active,
.code-tab.active,
.terminal-badge,
.status-pill,
.marquee-pill {
  border-color: rgba(200,150,62,.28) !important;
}
.btn-primary,
.term-send,
.code-tab.active,
.tab-button.active {
  background: var(--accent) !important;
  color: #fff !important;
}
.btn-secondary,
.btn-outline-teal,
.secondary-cta,
.cta-secondary {
  color: var(--ink);
  border-color: var(--line);
  background: rgba(255,255,255,.56);
}
.term-success,
.hl-str,
.hl-key,
.term-string {
  color: #e8b96a !important;
}
.term-error,
.cmp-x {
  color: var(--brand-danger) !important;
}
.cmp-check,
.status-dot.ready {
  color: var(--brand-ok) !important;
}

/* Remove legacy teal/blue section treatments. */
.hero-grid {
  background-image: radial-gradient(circle, rgba(200,150,62,.15) 1px, transparent 1px);
}
.hero-vignette {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(23,22,18,.9) 100%);
}
[data-theme="light"] .hero-vignette {
  background: radial-gradient(ellipse 80% 72% at 50% 42%, rgba(255,255,255,.08) 20%, rgba(246,245,242,.64) 100%);
}
.hero-orb-1,
.hero-orb-2 { display: none; }
.stats-section {
  background: #171612;
  border-block: 1px solid rgba(255,255,255,.08);
}
[data-theme="light"] .stats-section {
  background: var(--panel, #fff);
  border-block-color: var(--line);
}
.stat-number {
  background: none;
  color: var(--accent);
  -webkit-text-fill-color: currentColor;
}
.step-num {
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(200,150,62,.16);
}
.arch-svg { filter: none; }
.feature-card::after { display: none; }
.feature-card::before { background: var(--accent); }
.feature-card:hover,
[data-theme="dark"] .feature-card:hover,
.usecase-card:hover,
.compare-after {
  border-color: rgba(200,150,62,.3);
  box-shadow: var(--brand-shadow-panel);
}
.compare-after,
[data-theme="dark"] .compare-after {
  background: var(--card-bg);
}
.compare-badge-yes,
.usecase-tags span,
.feature-card code {
  color: var(--accent);
  background: rgba(200,150,62,.09);
  border-color: rgba(200,150,62,.22);
}
.cta-section,
[data-theme="dark"] .cta-section {
  background: var(--surface);
  border-top-color: var(--line);
}
[data-theme="light"] .arch-section,
[data-theme="light"] .code-section,
[data-theme="light"] footer {
  background: var(--surface);
  border-color: var(--line);
}
[data-theme="light"] .arch-diagram-wrap,
[data-theme="light"] .code-wrap,
[data-theme="light"] .terminal {
  background: var(--brand-code-bg);
  border-color: rgba(255,255,255,.1);
  box-shadow: 0 12px 28px rgba(23,22,18,.12);
}
[data-theme="light"] .hero-badge {
  color: var(--muted);
  background: rgba(255,255,255,.78);
  border-color: rgba(200,150,62,.24);
}
.sticky-bar {
  color: var(--ink);
}
.sticky-bar-btn {
  color: #fff;
}

@media (max-width: 768px) {
  nav { height: 64px; }
  .hero { padding-top: 88px; }
  .section-subtitle { font-size: 16px; }
}

/* ── Layout stabilization ───────────────────────────────────────────────── */
html,
body {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

nav {
  top: 0;
  width: 100%;
}

main,
main > section,
body > section,
footer {
  width: 100%;
  max-width: 100%;
}

.nav-inner,
.hero-content,
.compact-header,
.stats-grid,
.steps-grid,
.compare-grid,
.architecture-lanes,
.arch-diagram-wrap,
.features-grid,
.code-wrap,
.usecases-grid,
.operations-grid,
.cta-inner,
.footer-brand,
.footer-right {
  min-width: 0;
}

.marquee-section,
.marquee-track {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.marquee-section .compact-header {
  width: min(820px, 100%);
  margin: 0 auto 30px;
  padding-inline: 24px;
  text-align: center;
}

.cta-section > .fade-up {
  width: min(820px, 100%);
  margin-inline: auto;
  padding-inline: 24px;
}

.code-wrap {
  width: min(740px, 100%);
  overflow: hidden;
}
.code-tabs {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}
.code-block-wrap,
.code-block {
  max-width: 100%;
}
.code-block code {
  display: block;
  width: max-content;
  min-width: 100%;
}

.arch-diagram-wrap {
  width: min(800px, 100%);
}
.architecture-lane,
.feature-card,
.compare-col,
.usecase-card,
.usage-panel,
.security-panel {
  min-width: 0;
}

.footer-right {
  max-width: 100%;
}
.footer-links {
  max-width: 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Keep content visible even when IntersectionObserver is delayed or disabled. */
.js-ready .fade-up,
.js-ready .fade-up.visible {
  opacity: 1;
  transform: none;
}

.theme-toggle {
  color: var(--ink);
}
[data-theme="dark"] .theme-toggle {
  color: #f7f4ed;
}

@media (max-width: 768px) {
  .marquee-track {
    overflow-x: auto;
    -webkit-mask-image: none;
    mask-image: none;
    scrollbar-width: none;
  }
  .marquee-track::-webkit-scrollbar {
    display: none;
  }
  .marquee-inner,
  .marquee-inner.left,
  .marquee-inner.right {
    animation: none;
    transform: none;
    padding-inline: 16px;
  }

  .features-grid,
  .compare-grid,
  .usecases-grid,
  .operations-grid,
  .architecture-lanes {
    width: 100%;
  }

  footer {
    padding-inline: 20px;
  }
  .footer-right,
  .footer-links {
    width: 100%;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .sticky-bar {
    display: none !important;
  }
}

@media (max-width: 480px) {
  .code-block { padding: 20px 16px; }
  .code-block code { font-size: 11.5px; }
  .footer-links { gap: 12px 16px; }
}

/* ── Unified page canvas ────────────────────────────────────────────────── */
body {
  position: relative;
  isolation: isolate;
  background: #fbfaf7;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background-color: #fbfaf7;
  background-image:
    linear-gradient(rgba(200,150,62,.13) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200,150,62,.13) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.2) 10%, #000 34%, #000 66%, rgba(0,0,0,.2) 90%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.2) 10%, #000 34%, #000 66%, rgba(0,0,0,.2) 90%, transparent 100%);
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(251,250,247,.96) 0%, transparent 24%, transparent 76%, rgba(251,250,247,.96) 100%);
}

main,
.hero,
.marquee-section,
.stats-section,
.how-section,
.compare-section,
.arch-section,
.features-section,
.code-section,
.usecases-section,
.operations-section,
.cta-section,
footer,
[data-theme="light"] .hero,
[data-theme="light"] .stats-section,
[data-theme="light"] .arch-section,
[data-theme="light"] .code-section,
[data-theme="light"] footer,
[data-theme="dark"] .cta-section {
  background: transparent;
}

.hero-grid,
.hero-vignette,
.wave-divider {
  display: none;
}

.marquee-section,
.stats-section,
.compare-section,
.features-section,
.usecases-section,
.operations-section,
.cta-section,
.arch-section,
.code-section,
footer {
  border-color: rgba(200,150,62,.14);
}

[data-theme="light"] .feature-card,
[data-theme="light"] .compare-col,
[data-theme="light"] .usecase-card,
[data-theme="light"] .usage-panel,
[data-theme="light"] .security-panel,
[data-theme="light"] .architecture-lane {
  background: rgba(255,255,255,.78);
  backdrop-filter: blur(7px);
}

.terminal,
.code-wrap,
.arch-diagram-wrap {
  position: relative;
  z-index: 1;
}

[data-theme="dark"] body {
  background: #12110f;
}
[data-theme="dark"] body::before {
  background-color: #12110f;
  background-image:
    linear-gradient(rgba(200,150,62,.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200,150,62,.1) 1px, transparent 1px);
}
[data-theme="dark"] body::after {
  background: linear-gradient(90deg, rgba(18,17,15,.98) 0%, transparent 24%, transparent 76%, rgba(18,17,15,.98) 100%);
}
[data-theme="dark"] .feature-card,
[data-theme="dark"] .compare-col,
[data-theme="dark"] .usecase-card,
[data-theme="dark"] .usage-panel,
[data-theme="dark"] .security-panel,
[data-theme="dark"] .architecture-lane {
  background: rgba(23,22,18,.8);
}
[data-theme="dark"] .arch-diagram-wrap {
  background: rgba(23,22,18,.78);
  border-color: rgba(200,150,62,.28);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.07),
    0 20px 52px rgba(0,0,0,.3);
}
[data-theme="dark"] .architecture-lane {
  border-color: rgba(200,150,62,.22);
}

@media (max-width: 768px) {
  body::before {
    background-size: 28px 28px;
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 18%, #000 82%, transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0%, #000 18%, #000 82%, transparent 100%);
  }
  body::after {
    background: linear-gradient(90deg, rgba(251,250,247,.92) 0%, transparent 18%, transparent 82%, rgba(251,250,247,.92) 100%);
  }
  [data-theme="dark"] body::after {
    background: linear-gradient(90deg, rgba(18,17,15,.95) 0%, transparent 18%, transparent 82%, rgba(18,17,15,.95) 100%);
  }
}

/* ── Light surfaces and card interaction ───────────────────────────────── */
[data-theme="light"] .terminal,
[data-theme="light"] .code-wrap,
[data-theme="light"] .arch-diagram-wrap {
  background: rgba(255,255,255,.88);
  border: 1px solid rgba(200,150,62,.24);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.9),
    0 18px 42px rgba(23,22,18,.09);
  color: var(--ink);
}

[data-theme="light"] .term-titlebar,
[data-theme="light"] .code-tabs {
  background: rgba(248,246,241,.92);
  border-color: var(--line);
}
[data-theme="light"] .term-title,
[data-theme="light"] .term-flag,
[data-theme="light"] .term-response,
[data-theme="light"] .hl-cm,
[data-theme="light"] .hl-flag {
  color: var(--muted);
}
[data-theme="light"] .term-line,
[data-theme="light"] .term-demo-input,
[data-theme="light"] .code-block code {
  color: var(--ink);
}
[data-theme="light"] .term-cmd,
[data-theme="light"] .term-string,
[data-theme="light"] .term-prompt-sym,
[data-theme="light"] .hl-kw,
[data-theme="light"] .hl-str,
[data-theme="light"] .hl-key {
  color: var(--accent-dark) !important;
}
[data-theme="light"] .term-success {
  color: var(--brand-ok) !important;
}
[data-theme="light"] .term-cursor {
  background: var(--accent);
}
[data-theme="light"] .code-tab {
  color: var(--muted);
}
[data-theme="light"] .code-tab.active {
  color: var(--accent-dark);
  background: rgba(200,150,62,.11) !important;
}
[data-theme="light"] .code-tab:hover:not(.active) {
  color: var(--ink);
}
[data-theme="light"] .code-block-wrap,
[data-theme="light"] .term-demo-row {
  border-color: var(--line);
}
[data-theme="light"] .code-block {
  background: rgba(255,255,255,.56);
}

[data-theme="light"] .arch-svg rect {
  fill: rgba(255,255,255,.82) !important;
  stroke: rgba(200,150,62,.45) !important;
}
[data-theme="light"] .arch-svg text {
  fill: #4d493f !important;
}
[data-theme="light"] .arch-svg line {
  stroke: rgba(200,150,62,.62) !important;
}
[data-theme="light"] .arch-svg polygon {
  fill: var(--accent) !important;
}

[data-theme="dark"] .arch-diagram-wrap {
  background: rgba(23,22,18,.78);
  border-color: rgba(200,150,62,.28);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.07),
    0 20px 52px rgba(0,0,0,.3);
}
[data-theme="dark"] .architecture-lane {
  background: rgba(23,22,18,.8);
  border-color: rgba(200,150,62,.22);
}

.terminal,
.code-wrap,
.arch-diagram-wrap,
.architecture-lane,
.feature-card,
.compare-col,
.usecase-card,
.usage-panel,
.security-panel {
  transition:
    transform var(--motion-med),
    box-shadow var(--motion-med),
    border-color var(--motion-med),
    background-color var(--motion-med);
  transform: translateZ(0);
}

.feature-card,
.compare-col,
.usecase-card,
.usage-panel,
.security-panel,
.architecture-lane {
  box-shadow: var(--brand-shadow-panel);
}

.js-ready .terminal.fade-up,
.js-ready .code-wrap.fade-up,
.js-ready .arch-diagram-wrap.fade-up,
.js-ready .architecture-lane.fade-up,
.js-ready .feature-card.fade-up,
.js-ready .compare-col.fade-up,
.js-ready .usecase-card.fade-up,
.js-ready .usage-panel.fade-up,
.js-ready .security-panel.fade-up {
  transition:
    opacity .6s ease,
    transform var(--motion-med),
    box-shadow var(--motion-med),
    border-color var(--motion-med),
    background-color var(--motion-med);
}

.terminal:hover,
.code-wrap:hover,
.arch-diagram-wrap:hover,
.architecture-lane:hover,
.feature-card:hover,
.compare-col:hover,
.usecase-card:hover,
.usage-panel:hover,
.security-panel:hover {
  transform: translateY(-4px);
  border-color: rgba(200,150,62,.38);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.8),
    0 22px 48px rgba(23,22,18,.12);
}

.js-ready .terminal.fade-up.visible:hover,
.js-ready .code-wrap.fade-up.visible:hover,
.js-ready .arch-diagram-wrap.fade-up.visible:hover,
.js-ready .architecture-lane.fade-up.visible:hover,
.js-ready .feature-card.fade-up.visible:hover,
.js-ready .compare-col.fade-up.visible:hover,
.js-ready .usecase-card.fade-up.visible:hover,
.js-ready .usage-panel.fade-up.visible:hover,
.js-ready .security-panel.fade-up.visible:hover {
  transform: translateY(-4px);
}

.terminal:active,
.code-wrap:active,
.arch-diagram-wrap:active,
.architecture-lane:active,
.feature-card:active,
.compare-col:active,
.usecase-card:active,
.usage-panel:active,
.security-panel:active {
  transform: translateY(-1px);
}

.js-ready .terminal.fade-up.visible:active,
.js-ready .code-wrap.fade-up.visible:active,
.js-ready .arch-diagram-wrap.fade-up.visible:active,
.js-ready .architecture-lane.fade-up.visible:active,
.js-ready .feature-card.fade-up.visible:active,
.js-ready .compare-col.fade-up.visible:active,
.js-ready .usecase-card.fade-up.visible:active,
.js-ready .usage-panel.fade-up.visible:active,
.js-ready .security-panel.fade-up.visible:active {
  transform: translateY(-1px);
}

@media (hover: none) {
  .terminal:hover,
  .code-wrap:hover,
  .arch-diagram-wrap:hover,
  .architecture-lane:hover,
  .feature-card:hover,
  .compare-col:hover,
  .usecase-card:hover,
  .usage-panel:hover,
  .security-panel:hover {
    transform: none;
  }

  .js-ready .terminal.fade-up.visible:hover,
  .js-ready .code-wrap.fade-up.visible:hover,
  .js-ready .arch-diagram-wrap.fade-up.visible:hover,
  .js-ready .architecture-lane.fade-up.visible:hover,
  .js-ready .feature-card.fade-up.visible:hover,
  .js-ready .compare-col.fade-up.visible:hover,
  .js-ready .usecase-card.fade-up.visible:hover,
  .js-ready .usage-panel.fade-up.visible:hover,
  .js-ready .security-panel.fade-up.visible:hover {
    transform: none;
  }
}

/* ── No module separators: the page uses one continuous grid canvas. ───── */
.wave-divider {
  display: none !important;
  height: 0;
}

.hero,
.marquee-section,
.stats-section,
.how-section,
.compare-section,
.arch-section,
.features-section,
.code-section,
.usecases-section,
.operations-section,
.cta-section,
footer,
[data-theme="light"] .hero,
[data-theme="light"] .stats-section,
[data-theme="light"] .arch-section,
[data-theme="light"] .code-section,
[data-theme="light"] footer,
[data-theme="dark"] .cta-section {
  border-top: 0 !important;
  border-bottom: 0 !important;
}

.steps-grid::before {
  display: none;
}

/* ── Demo-style section header clusters ────────────────────────────────── */
.section-title-accent {
  color: #df7759;
}

main > section > .section-header {
  width: min(980px, 100%);
  max-width: 980px;
  margin-inline: auto;
  margin-bottom: clamp(30px, 4vw, 48px);
  padding-inline: clamp(18px, 4vw, 48px);
  text-align: center;
}

main > section > .section-header > .section-eyebrow {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

main > section > .section-header > .section-title {
  margin: 0 auto;
  color: var(--ink);
  font-size: clamp(34px, 4.35vw, 56px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: 0;
  text-wrap: balance;
}

main > section > .section-header > .section-title::before {
  content: "";
  display: inline-block;
  inline-size: .46em;
  block-size: .46em;
  margin-right: .24em;
  vertical-align: .03em;
  background:
    linear-gradient(#df7759 0 0) 50% 0 / 30% 30% no-repeat,
    linear-gradient(#df7759 0 0) 0 50% / 30% 30% no-repeat,
    linear-gradient(#df7759 0 0) 100% 50% / 30% 30% no-repeat,
    linear-gradient(#df7759 0 0) 50% 100% / 30% 30% no-repeat,
    linear-gradient(#df7759 0 0) 50% 50% / 30% 30% no-repeat;
  transform: rotate(45deg);
  transform-origin: 50% 50%;
}

main > section > .section-header > .section-subtitle {
  max-width: 820px;
  margin: clamp(16px, 2vw, 22px) auto 0;
  color: #6d7280;
  font-size: clamp(17px, 2vw, 22px);
  line-height: 1.68;
  font-weight: 400;
  text-wrap: balance;
}

[data-theme="dark"] .section-title-accent {
  color: #e8a076;
}

[data-theme="dark"] main > section > .section-header > .section-title::before {
  background:
    linear-gradient(#e8a076 0 0) 50% 0 / 30% 30% no-repeat,
    linear-gradient(#e8a076 0 0) 0 50% / 30% 30% no-repeat,
    linear-gradient(#e8a076 0 0) 100% 50% / 30% 30% no-repeat,
    linear-gradient(#e8a076 0 0) 50% 100% / 30% 30% no-repeat,
    linear-gradient(#e8a076 0 0) 50% 50% / 30% 30% no-repeat;
}

[data-theme="dark"] main > section > .section-header > .section-subtitle {
  color: rgba(247,244,237,.66);
}

.usage-panel .section-title,
.security-panel .section-title {
  font-size: clamp(25px, 3vw, 36px);
  line-height: 1.12;
  text-wrap: balance;
}

.usage-panel .section-title::before,
.security-panel .section-title::before {
  content: none;
}

@media (max-width: 768px) {
  main > section > .section-header {
    margin-bottom: 28px;
    padding-inline: 16px;
  }

  main > section > .section-header > .section-title {
    font-size: clamp(28px, 8vw, 36px);
    line-height: 1.12;
  }

  main > section > .section-header > .section-title::before {
    display: block;
    margin: 0 auto 12px;
  }

  main > section > .section-header > .section-subtitle {
    font-size: clamp(15px, 4.2vw, 18px);
    line-height: 1.62;
  }
}
`;
