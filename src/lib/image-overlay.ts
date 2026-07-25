import sharp, { type OverlayOptions as SharpOverlayOptions } from "sharp";
import { prisma } from "./db";

export interface OverlayOptions {
  caption?: string;          // text overlaid at bottom
  subheadline?: string;
  cta?: string;
  badge?: string;
  template?: "none" | "minimal" | "promo" | "story" | "badge";
  showLogo?: boolean;        // overlay spa logo top-right
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  logoSizePct?: number;      // logo as % of image width, default 12
  brand?: { logoUrl?: string | null; accentColor?: string | null } | null;
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1];
    return Buffer.from(b64, "base64");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot fetch image (${res.status})`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function escapeSvg(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function textLinesSvg(lines: string[], x: number, y: number, fontSize: number, weight = 700, color = "white") {
  const lineHeight = Math.round(fontSize * 1.18);
  return lines.map((line, idx) => `<text x="${x}" y="${y + idx * lineHeight}"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
      font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeSvg(line)}</text>`).join("\n");
}

function buildCaptionSvg(opts: OverlayOptions, imgWidth: number, imgHeight: number, accentColor: string): Buffer {
  const text = opts.caption?.trim() ?? "";
  const subheadline = opts.subheadline?.trim() ?? "";
  const cta = opts.cta?.trim() ?? "";
  const badge = opts.badge?.trim() ?? "";
  const template = opts.template ?? "minimal";
  const fontSize = Math.max(24, Math.round(imgWidth * (template === "story" ? 0.052 : 0.044)));
  const smallSize = Math.max(16, Math.round(fontSize * 0.48));
  const padding = Math.round(imgWidth * 0.04);
  const boxHeight = Math.round(fontSize * (template === "promo" ? 3.4 : 2.9));
  const boxTop = imgHeight - boxHeight;
  const maxChars = imgWidth > imgHeight ? 32 : 22;
  const lines = wrapText(text, maxChars, 2);
  const subLines = subheadline ? wrapText(subheadline, maxChars + 8, 1) : [];
  const badgeSvg = badge
    ? `<rect x="${padding}" y="${boxTop - Math.round(fontSize * 0.72)}" rx="${Math.round(fontSize * 0.35)}" width="${Math.max(fontSize * 3.1, badge.length * smallSize * 0.7)}" height="${Math.round(fontSize * 0.92)}" fill="${accentColor}"/>
       <text x="${padding + Math.round(fontSize * 0.45)}" y="${boxTop - Math.round(fontSize * 0.13)}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-size="${smallSize}" font-weight="800" fill="white">${escapeSvg(badge)}</text>`
    : "";
  const ctaWidth = cta ? Math.max(fontSize * 3.3, cta.length * smallSize * 0.75) : 0;
  const ctaSvg = cta
    ? `<rect x="${imgWidth - padding - ctaWidth}" y="${imgHeight - padding - Math.round(fontSize * 0.9)}" rx="${Math.round(fontSize * 0.4)}" width="${ctaWidth}" height="${Math.round(fontSize * 1.05)}" fill="white" opacity="0.94"/>
       <text x="${imgWidth - padding - ctaWidth + Math.round(fontSize * 0.45)}" y="${imgHeight - padding - Math.round(fontSize * 0.22)}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-size="${smallSize}" font-weight="800" fill="${accentColor}">${escapeSvg(cta)}</text>`
    : "";

  const svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,${template === "minimal" ? "0.64" : "0.78"})"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${boxTop - boxHeight}" width="${imgWidth}" height="${boxHeight * 2}" fill="url(#bg)"/>
    ${badgeSvg}
    ${subLines.length ? textLinesSvg(subLines, padding, imgHeight - padding - Math.round(fontSize * 1.55), smallSize, 600, "rgba(255,255,255,0.88)") : ""}
    ${textLinesSvg(lines, padding, imgHeight - padding - Math.round(fontSize * (lines.length > 1 ? 0.82 : 0.25)), fontSize, 800)}
    ${ctaSvg}
    <rect x="0" y="${imgHeight - 4}" width="${imgWidth}" height="4" fill="${accentColor}"/>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Composite branding overlay onto an AI-generated image.
 * - Adds caption text with gradient backdrop at bottom
 * - Adds spa logo top-right (if BrandKit has logoUrl)
 *
 * Returns base64 data URL of the composited image.
 * If anything fails, returns original URL.
 */
export async function applyOverlay(imageUrl: string, opts: OverlayOptions = {}): Promise<string> {
  try {
    const brand = opts.brand === undefined ? await prisma.brandKit.findFirst() : opts.brand;
    const accent = brand?.accentColor ?? "#40c074";
    const showLogo = opts.showLogo !== false;       // default true if logo exists
    const position = opts.position ?? "top-right";
    const logoSizePct = opts.logoSizePct ?? 12;

    const baseBuffer = await fetchAsBuffer(imageUrl);
    const metadata = await sharp(baseBuffer).metadata();
    const W = metadata.width ?? 1024;
    const H = metadata.height ?? 1024;

    const composites: SharpOverlayOptions[] = [];

    // Caption overlay (bottom)
    if (opts.caption?.trim() && opts.template !== "none") {
      const svgBuffer = buildCaptionSvg(opts, W, H, accent);
      composites.push({ input: svgBuffer, top: 0, left: 0 });
    }

    // Logo overlay
    if (showLogo && brand?.logoUrl) {
      try {
        const logoBuffer = await fetchAsBuffer(brand.logoUrl);
        const targetWidth = Math.round((W * logoSizePct) / 100);
        const logoResized = await sharp(logoBuffer)
          .resize({ width: targetWidth, withoutEnlargement: true })
          .png()
          .toBuffer();

        const logoMeta = await sharp(logoResized).metadata();
        const lw = logoMeta.width ?? targetWidth;
        const lh = logoMeta.height ?? targetWidth;
        const margin = Math.round(W * 0.03);

        let top = margin, left = margin;
        if (position === "top-right") left = W - lw - margin;
        else if (position === "bottom-right") { left = W - lw - margin; top = H - lh - margin; }
        else if (position === "bottom-left") { top = H - lh - margin; }

        composites.push({ input: logoResized, top, left });
      } catch { /* skip logo if fetch fails */ }
    }

    if (composites.length === 0) return imageUrl;

    const output = await sharp(baseBuffer).composite(composites).png().toBuffer();
    const b64 = output.toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return imageUrl;       // graceful fallback
  }
}
