// Rendu des créations du studio sur un canvas 2D. Fonctions pures côté navigateur :
// le même état (Design) produit tous les formats publicitaires (redimensionnement automatique).

export type Layout = "full" | "price" | "band" | "split" | "text" | "frame";
export type Palette = { background: string; accent: string; text: string };

export type Design = {
  layout: Layout; palette: Palette; headline: string; subline: string; cta: string; badge: string;
  imageId: string | null; logoId: string | null; zoom: number; offsetX: number; offsetY: number; templateId?: string | null;
};

export const LAYOUTS: { id: Layout; label: string; needsImage: boolean }[] = [
  { id: "full", label: "Plein cadre", needsImage: true },
  { id: "price", label: "Étiquette prix", needsImage: true },
  { id: "band", label: "Bandeau promo", needsImage: true },
  { id: "split", label: "Moitié-moitié", needsImage: true },
  { id: "frame", label: "Cadre", needsImage: true },
  { id: "text", label: "Texte seul", needsImage: false },
];

export const PALETTES: Palette[] = [
  { background: "#0E2A20", accent: "#F5A524", text: "#FFFFFF" },
  { background: "#F6F4EE", accent: "#C8452B", text: "#15201B" },
  { background: "#C8452B", accent: "#FFFFFF", text: "#FFFFFF" },
  { background: "#FFFFFF", accent: "#17604A", text: "#15201B" },
  { background: "#111111", accent: "#F2E94E", text: "#FFFFFF" },
  { background: "#1E3A5F", accent: "#FFB703", text: "#FFFFFF" },
  { background: "#FFE8D6", accent: "#6B2D5C", text: "#2B1B2E" },
  { background: "#F5A524", accent: "#0E2A20", text: "#0E2A20" },
];

export const DEFAULT_DESIGN: Design = {
  layout: "full", palette: PALETTES[0]!, headline: "Votre titre ici", subline: "Une phrase qui donne envie", cta: "Commander", badge: "",
  imageId: null, logoId: null, zoom: 1, offsetX: 0, offsetY: 0, templateId: null,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Reconstruit un état valide à partir de données enregistrées (ou d'un modèle), sans faire confiance à leur forme. */
export function sanitizeDesign(raw: unknown): Design {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const p = (r.palette && typeof r.palette === "object" ? r.palette : {}) as Record<string, unknown>;
  const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  const str = (v: unknown, d: string, max: number) => (typeof v === "string" ? v.slice(0, max) : d);
  const num = (v: unknown, d: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  return {
    layout: LAYOUTS.some((l) => l.id === r.layout) ? (r.layout as Layout) : "full",
    palette: { background: color(p.background, DEFAULT_DESIGN.palette.background), accent: color(p.accent, DEFAULT_DESIGN.palette.accent), text: color(p.text, DEFAULT_DESIGN.palette.text) },
    headline: str(r.headline, DEFAULT_DESIGN.headline, 90), subline: str(r.subline, "", 140), cta: str(r.cta, "", 40), badge: str(r.badge, "", 24),
    imageId: typeof r.imageId === "string" ? r.imageId : null, logoId: typeof r.logoId === "string" ? r.logoId : null,
    zoom: num(r.zoom, 1, 1, 3), offsetX: num(r.offsetX, 0, -1, 1), offsetY: num(r.offsetY, 0, -1, 1), templateId: typeof r.templateId === "string" ? r.templateId : null,
  };
}

export type Sources = { image: CanvasImageSource | null; imageW: number; imageH: number; logo: CanvasImageSource | null; logoW: number; logoH: number };

const DISPLAY = '"Bricolage Grotesque Variable", "Instrument Sans Variable", system-ui, sans-serif';
const SANS = '"Instrument Sans Variable", system-ui, sans-serif';

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export const readableOn = (hex: string) => (luminance(hex) > 0.45 ? "#14201A" : "#FFFFFF");

function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Dessine un texte en réduisant la taille jusqu'à tenir dans la largeur et le nombre de lignes voulus. Renvoie la hauteur occupée. */
function textBlock(ctx: CanvasRenderingContext2D, text: string, o: { x: number; y: number; width: number; size: number; minSize: number; maxLines: number; weight: number; family: string; color: string; align?: CanvasTextAlign; lineHeight?: number }) {
  if (!text.trim()) return 0;
  let size = o.size;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${o.weight} ${size}px ${o.family}`;
    lines = wrap(ctx, text, o.width);
    if ((lines.length <= o.maxLines && lines.every((l) => ctx.measureText(l).width <= o.width)) || size <= o.minSize) break;
    size = Math.max(o.minSize, size * 0.92);
  }
  lines = lines.slice(0, o.maxLines);
  const lh = size * (o.lineHeight ?? 1.12);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "top";
  const x = o.align === "center" ? o.x + o.width / 2 : o.align === "right" ? o.x + o.width : o.x;
  lines.forEach((l, i) => ctx.fillText(l, x, o.y + i * lh));
  return lines.length * lh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Image recadrée « cover » dans une zone, avec zoom et décalage choisis par l'utilisateur. */
function cover(ctx: CanvasRenderingContext2D, d: Design, s: Sources, x: number, y: number, w: number, h: number, radius = 0) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (s.image && s.imageW && s.imageH) {
    const scale = Math.max(w / s.imageW, h / s.imageH) * d.zoom;
    const dw = s.imageW * scale;
    const dh = s.imageH * scale;
    const dx = x + (w - dw) / 2 + ((dw - w) / 2) * d.offsetX;
    const dy = y + (h - dh) / 2 + ((dh - h) / 2) * d.offsetY;
    ctx.drawImage(s.image, dx, dy, dw, dh);
  } else {
    // Emplacement vide : motif neutre indiquant où se placera la photo.
    ctx.fillStyle = withAlpha(readableOn(d.palette.background), 0.1);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha(readableOn(d.palette.background), 0.22);
    ctx.lineWidth = Math.max(2, w / 300);
    const step = Math.max(w, h) / 12;
    for (let i = -h; i < w + h; i += step) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i - h, y + h); ctx.stroke(); }
    ctx.font = `600 ${Math.min(w, h) / 14}px ${SANS}`;
    ctx.fillStyle = withAlpha(readableOn(d.palette.background), 0.55);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Votre photo", x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, opts: { align?: "left" | "center" | "right"; maxWidth?: number } = {}) {
  if (!text.trim()) return { w: 0, h: 0 };
  let fs = size;
  ctx.font = `700 ${fs}px ${SANS}`;
  const max = opts.maxWidth ?? Infinity;
  while (ctx.measureText(text).width + fs * 1.8 > max && fs > size * 0.55) { fs *= 0.94; ctx.font = `700 ${fs}px ${SANS}`; }
  const w = ctx.measureText(text).width + fs * 1.8;
  const h = fs * 2.3;
  const left = opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x;
  ctx.fillStyle = bg;
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = readableOn(bg);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, left + w / 2, y + h / 2 + fs * 0.04);
  return { w, h };
}

function drawLogo(ctx: CanvasRenderingContext2D, s: Sources, x: number, y: number, box: number) {
  if (!s.logo || !s.logoW || !s.logoH) return;
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, box, box, box * 0.2);
  ctx.fill();
  const pad = box * 0.12;
  const scale = Math.min((box - pad * 2) / s.logoW, (box - pad * 2) / s.logoH);
  ctx.drawImage(s.logo, x + (box - s.logoW * scale) / 2, y + (box - s.logoH * scale) / 2, s.logoW * scale, s.logoH * scale);
  ctx.restore();
}

export function drawDesign(ctx: CanvasRenderingContext2D, d: Design, w: number, h: number, s: Sources) {
  const u = Math.min(w, h) / 1080; // unité relative : le rendu est identique quelle que soit la résolution
  const m = 64 * u;
  const { background, accent, text } = d.palette;
  const wide = w / h > 1.5;
  const tall = h / w > 1.5;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  const logoBox = (wide ? 150 : 132) * u;
  let logoAt: [number, number] = [w - m - logoBox, m];

  if (d.layout === "full") {
    cover(ctx, d, s, 0, 0, w, h);
    const panelH = wide ? h : h * (tall ? 0.3 : 0.36);
    const panelW = wide ? w * 0.42 : w;
    const px = 0;
    const py = wide ? 0 : h - panelH;
    ctx.fillStyle = withAlpha(background, 0.94);
    ctx.fillRect(px, py, panelW, panelH);
    ctx.fillStyle = accent;
    if (wide) ctx.fillRect(panelW, 0, 10 * u, h); else ctx.fillRect(0, py, w, 10 * u);
    let y = py + m * (wide ? 1 : 0.85);
    if (d.badge) y += pill(ctx, d.badge, px + m, y, 34 * u, accent).h + 22 * u;
    y += textBlock(ctx, d.headline, { x: px + m, y, width: panelW - m * 2, size: 84 * u, minSize: 44 * u, maxLines: wide ? 4 : 2, weight: 700, family: DISPLAY, color: text });
    y += 14 * u;
    y += textBlock(ctx, d.subline, { x: px + m, y, width: panelW - m * 2, size: 36 * u, minSize: 26 * u, maxLines: 2, weight: 500, family: SANS, color: withAlpha(text, 0.86), lineHeight: 1.3 });
    if (d.cta) pill(ctx, d.cta, px + m, Math.min(y + 26 * u, py + panelH - m * 0.8 - 78 * u), 34 * u, accent, { maxWidth: panelW - m * 2 });
    if (wide) logoAt = [w - m - logoBox, m];
  } else if (d.layout === "price") {
    const imgW = wide ? w * 0.5 - m : w - m * 2;
    const imgH = wide ? h - m * 2 : h * (tall ? 0.56 : 0.58);
    cover(ctx, d, s, m, m, imgW, imgH, 28 * u);
    if (d.badge) {
      const r = (wide ? 120 : 138) * u;
      const cx = m + imgW - r * 0.75;
      const cy = m + imgH - r * 0.35;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      textBlock(ctx, d.badge, { x: cx - r * 0.82, y: cy - 30 * u, width: r * 1.64, size: 56 * u, minSize: 26 * u, maxLines: 1, weight: 800, family: DISPLAY, color: readableOn(accent), align: "center" });
    }
    const tx = wide ? w * 0.5 + m * 0.6 : m;
    const tw = wide ? w * 0.5 - m * 1.6 : w - m * 2;
    let y = wide ? m + logoBox + 30 * u : m + imgH + (d.badge ? 120 : 44) * u;
    y += textBlock(ctx, d.headline, { x: tx, y, width: tw, size: 80 * u, minSize: 42 * u, maxLines: wide ? 3 : 2, weight: 700, family: DISPLAY, color: text });
    y += 14 * u;
    y += textBlock(ctx, d.subline, { x: tx, y, width: tw, size: 36 * u, minSize: 26 * u, maxLines: 2, weight: 500, family: SANS, color: withAlpha(text, 0.8), lineHeight: 1.3 });
    if (d.cta) pill(ctx, d.cta, tx, Math.min(y + 28 * u, h - m - 78 * u), 34 * u, accent, { maxWidth: tw });
    logoAt = wide ? [w - m - logoBox, m] : [m + 20 * u, m + 20 * u];
  } else if (d.layout === "band") {
    cover(ctx, d, s, 0, 0, w, h);
    const bandH = (wide ? 0.34 : tall ? 0.2 : 0.26) * h;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, bandH);
    const badgeW = d.badge ? Math.min(w * 0.34, 330 * u) : 0;
    if (d.badge) textBlock(ctx, d.badge, { x: m, y: bandH / 2 - 62 * u, width: badgeW, size: 120 * u, minSize: 48 * u, maxLines: 1, weight: 800, family: DISPLAY, color: accent });
    const hx = m + (d.badge ? badgeW + 28 * u : 0);
    textBlock(ctx, d.headline, { x: hx, y: bandH / 2 - (wide ? 44 : 60) * u, width: w - hx - m - (s.logo ? logoBox + 20 * u : 0), size: 68 * u, minSize: 36 * u, maxLines: 2, weight: 700, family: DISPLAY, color: text });
    const stripH = (wide ? 0.26 : 0.13) * h;
    ctx.fillStyle = withAlpha(background, 0.94);
    ctx.fillRect(0, h - stripH, w, stripH);
    const ctaW = d.cta ? pill(ctx, d.cta, w - m, h - stripH / 2 - 39 * u, 34 * u, accent, { align: "right", maxWidth: w * 0.45 }).w : 0;
    textBlock(ctx, d.subline, { x: m, y: h - stripH / 2 - 24 * u, width: w - m * 2 - ctaW - 24 * u, size: 34 * u, minSize: 24 * u, maxLines: 2, weight: 500, family: SANS, color: text, lineHeight: 1.25 });
    logoAt = [w - m - logoBox, Math.max(m * 0.5, (bandH - logoBox) / 2)];
  } else if (d.layout === "split") {
    const horizontal = w >= h * 1.15;
    const iw = horizontal ? w / 2 : w;
    const ih = horizontal ? h : h * (tall ? 0.52 : 0.5);
    cover(ctx, d, s, 0, 0, iw, ih);
    const tx = horizontal ? iw + m : m;
    const tw = (horizontal ? w / 2 : w) - m * 2;
    let y = horizontal ? m * 1.2 : ih + m * 0.9;
    ctx.fillStyle = accent;
    ctx.fillRect(tx, y, 110 * u, 12 * u);
    y += 44 * u;
    if (d.badge) y += pill(ctx, d.badge, tx, y, 32 * u, accent).h + 22 * u;
    y += textBlock(ctx, d.headline, { x: tx, y, width: tw, size: 82 * u, minSize: 42 * u, maxLines: 3, weight: 700, family: DISPLAY, color: text });
    y += 16 * u;
    y += textBlock(ctx, d.subline, { x: tx, y, width: tw, size: 36 * u, minSize: 26 * u, maxLines: 3, weight: 500, family: SANS, color: withAlpha(text, 0.8), lineHeight: 1.3 });
    if (d.cta) pill(ctx, d.cta, tx, Math.min(y + 30 * u, h - m - 78 * u), 34 * u, accent, { maxWidth: tw });
    logoAt = [m * 0.7, m * 0.7];
  } else if (d.layout === "frame") {
    const b = 44 * u;
    const capH = (wide ? 0.3 : tall ? 0.2 : 0.24) * h;
    cover(ctx, d, s, b, b, w - b * 2, h - b - capH, 18 * u);
    const cy = h - capH;
    const ctaW = d.cta ? pill(ctx, d.cta, w - b - 8 * u, cy + capH / 2 - 39 * u, 34 * u, accent, { align: "right", maxWidth: w * 0.42 }).w : 0;
    const tw = w - b * 2 - ctaW - 30 * u;
    const used = textBlock(ctx, d.headline, { x: b + 8 * u, y: cy + capH * (d.subline ? 0.2 : 0.32), width: tw, size: 62 * u, minSize: 34 * u, maxLines: d.subline ? 1 : 2, weight: 700, family: DISPLAY, color: text });
    textBlock(ctx, d.subline, { x: b + 8 * u, y: cy + capH * 0.2 + used + 8 * u, width: tw, size: 32 * u, minSize: 24 * u, maxLines: 2, weight: 500, family: SANS, color: withAlpha(text, 0.8), lineHeight: 1.25 });
    if (d.badge) pill(ctx, d.badge, b + 26 * u, b + 26 * u, 34 * u, accent);
    logoAt = [w - b - 26 * u - logoBox, b + 26 * u];
  } else {
    // Texte seul
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 22 * u, h);
    const tx = m + 30 * u;
    const tw = w - tx - m;
    const blockTop = wide ? m : h * (tall ? 0.26 : 0.2);
    let y = blockTop;
    if (d.badge) y += pill(ctx, d.badge, tx, y, 36 * u, accent).h + 34 * u;
    y += textBlock(ctx, d.headline, { x: tx, y, width: tw - (wide && s.logo ? logoBox : 0), size: (wide ? 96 : 124) * u, minSize: 52 * u, maxLines: wide ? 2 : 4, weight: 800, family: DISPLAY, color: text, lineHeight: 1.04 });
    y += 30 * u;
    ctx.fillStyle = accent;
    ctx.fillRect(tx, y, 150 * u, 12 * u);
    y += 44 * u;
    y += textBlock(ctx, d.subline, { x: tx, y, width: tw, size: 42 * u, minSize: 28 * u, maxLines: wide ? 1 : 3, weight: 500, family: SANS, color: withAlpha(text, 0.84), lineHeight: 1.3 });
    if (d.cta) pill(ctx, d.cta, wide ? w - m : tx, wide ? h - m - 80 * u : Math.min(y + 40 * u, h - m - 80 * u), 36 * u, accent, { align: wide ? "right" : "left", maxWidth: tw });
  }
  drawLogo(ctx, s, logoAt[0], logoAt[1], logoBox);
}
