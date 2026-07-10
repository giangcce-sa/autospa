/**
 * Ann Như Brand Design Tokens
 *
 * Single source of truth for visual identity shared across all products.
 * Import `brandTokensCss` into any CSS template literal file.
 *
 * Rules:
 *  - Font:    Be Vietnam Pro only (no Inter, no system-ui alone)
 *  - Accent:  #C8963E gold — never use teal/blue as primary brand color
 *  - Radius:  9px buttons · 12-16px cards · 999px pills
 *  - Shadow:  low-contrast only — no harsh drop shadows
 *  - Spacing: 4px grid (--space-1 = 4px, --space-2 = 8px, …)
 *  - Focus:   gold ring rgba(200,150,62,0.16) — never blue
 */
export const brandTokensCss = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

:root {
  /* ── Brand colors ── */
  --brand-accent:       #C8963E;
  --brand-accent-dark:  #A07628;
  --brand-accent-soft:  #FDF6E3;
  --brand-bg:           #f6f5f2;
  --brand-bg-soft:      #ebe8e2;
  --brand-surface:      #ffffff;
  --brand-surface-2:    #f8f6f1;
  --brand-ink:          #171612;
  --brand-muted:        #69645b;
  --brand-line:         #ded9cf;
  --brand-line-strong:  #c9c1b3;
  --brand-code-bg:      #171612;
  --brand-code-ink:     #f3eee5;

  /* ── Semantic colors ── */
  --brand-danger: #DC2626;
  --brand-warn:   #D97706;
  --brand-ok:     #16A34A;

  /* ── Typography ── */
  --brand-font: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;

  /* ── Shape ── */
  --brand-radius-btn:  9px;
  --brand-radius-card: 16px;
  --brand-radius-pill: 999px;
  --brand-radius-panel: 14px;

  /* ── Elevation ── */
  --brand-shadow-card:    0 2px 10px rgba(15, 23, 42, 0.05);
  --brand-shadow-panel:   0 14px 34px rgba(23, 22, 18, 0.07);
  --brand-shadow-popover: 0 12px 32px rgba(15, 23, 42, 0.12);
  --brand-shadow-modal:   0 20px 60px rgba(15, 23, 42, 0.18);

  /* ── Focus ring ── */
  --brand-focus-ring: 0 0 0 3px rgba(200, 150, 62, 0.16);

  /* ── Spacing (4px grid) ── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;

  /* ── Motion ── */
  --motion-fast: 140ms cubic-bezier(.2,.8,.2,1);
  --motion-med: 220ms cubic-bezier(.2,.8,.2,1);
}
`;
