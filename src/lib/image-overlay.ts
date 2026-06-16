import sharp from "sharp";
import { prisma } from "./db";

export interface OverlayOptions {
  caption?: string;          // text overlaid at bottom
  showLogo?: boolean;        // overlay spa logo top-right
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  logoSizePct?: number;      // logo as % of image width, default 12
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

function buildCaptionSvg(text: string, imgWidth: number, imgHeight: number, accentColor: string): Buffer {
  const escaped = escapeSvg(text);
  const fontSize = Math.round(imgWidth * 0.04);     // ~4% of width
  const padding = Math.round(imgWidth * 0.04);
  const boxHeight = Math.round(fontSize * 2.5);
  const boxTop = imgHeight - boxHeight;

  const svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.7)"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${boxTop - boxHeight}" width="${imgWidth}" height="${boxHeight * 2}" fill="url(#bg)"/>
    <text x="${padding}" y="${imgHeight - padding}"
      font-family="-apple-system, system-ui, sans-serif"
      font-size="${fontSize}" font-weight="700" fill="white">${escaped}</text>
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
    const brand = await prisma.brandKit.findFirst();
    const accent = brand?.accentColor ?? "#40c074";
    const showLogo = opts.showLogo !== false;       // default true if logo exists
    const position = opts.position ?? "top-right";
    const logoSizePct = opts.logoSizePct ?? 12;

    const baseBuffer = await fetchAsBuffer(imageUrl);
    const metadata = await sharp(baseBuffer).metadata();
    const W = metadata.width ?? 1024;
    const H = metadata.height ?? 1024;

    const composites: sharp.OverlayOptions[] = [];

    // Caption overlay (bottom)
    if (opts.caption?.trim()) {
      const svgBuffer = buildCaptionSvg(opts.caption.trim(), W, H, accent);
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
