// Import de rapports publicitaires (export du Gestionnaire de publicités Meta / TikTok Ads Manager, ou saisie interne).
import { parseIsoDate } from "@/lib/utils";

export type ImportedRow = {
  date: string; platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK";
  impressions: number; reach: number; clicks: number; engagements: number; videoViews: number; conversions: number; leads: number; spend: number; revenue: number | null;
};

const HEADERS: Record<string, keyof ImportedRow> = {
  date: "date", jour: "date", day: "date",
  plateforme: "platform", platform: "platform", reseau: "platform",
  impressions: "impressions",
  portee: "reach", reach: "reach", couverture: "reach",
  clics: "clicks", clicks: "clicks",
  engagement: "engagements", engagements: "engagements", interactions: "engagements",
  vuesvideo: "videoViews", videoviews: "videoViews", vues: "videoViews",
  conversions: "conversions", resultats: "conversions",
  prospects: "leads", leads: "leads",
  depenses: "spend", depense: "spend", spend: "spend", montantdepense: "spend", cout: "spend",
  revenu: "revenue", revenus: "revenue", revenue: "revenue", chiffredaffaires: "revenue",
};

const PLATFORM_ALIASES: Record<string, ImportedRow["platform"]> = { facebook: "FACEBOOK", fb: "FACEBOOK", instagram: "INSTAGRAM", ig: "INSTAGRAM", tiktok: "TIKTOK" };

const norm = (h: string) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");

function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseDate(v: string): string | null {
  if (parseIsoDate(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return parseIsoDate(iso) ? iso : null;
}

function parseAmount(v: string): number | null {
  if (v === "" || v === "-") return 0;
  const cleaned = v.replace(/[\s\u00a0\u202f]/g, "").replace(/(fcfa|xof|f)$/i, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export type CsvResult = { rows: ImportedRow[]; errors: string[] };

export function parseMetricsCsv(text: string, defaultPlatform: ImportedRow["platform"] | null, maxRows = 400): CsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données."] };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) >= (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const columns = splitLine(lines[0]!, sep).map((h) => HEADERS[norm(h)] ?? null);
  if (!columns.includes("date")) return { rows: [], errors: ["Colonne « date » introuvable."] };
  if (!columns.includes("platform") && !defaultPlatform) return { rows: [], errors: ["Colonne « plateforme » absente : choisissez la plateforme concernée par ce fichier."] };
  if (lines.length - 1 > maxRows) return { rows: [], errors: [`Trop de lignes (${lines.length - 1}). Maximum : ${maxRows}.`] };

  const rows: ImportedRow[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((line, idx) => {
    const n = idx + 2;
    const cells = splitLine(line, sep);
    const row: ImportedRow = { date: "", platform: defaultPlatform ?? "FACEBOOK", impressions: 0, reach: 0, clicks: 0, engagements: 0, videoViews: 0, conversions: 0, leads: 0, spend: 0, revenue: null };
    let bad = false;
    columns.forEach((col, i) => {
      if (!col || bad) return;
      const raw = cells[i] ?? "";
      if (col === "date") {
        const d = parseDate(raw);
        if (!d) { errors.push(`Ligne ${n} : date « ${raw} » invalide (formats acceptés : AAAA-MM-JJ ou JJ/MM/AAAA).`); bad = true; } else row.date = d;
      } else if (col === "platform") {
        const p = PLATFORM_ALIASES[raw.toLowerCase().trim()];
        if (!p) { errors.push(`Ligne ${n} : plateforme « ${raw} » inconnue.`); bad = true; } else row.platform = p;
      } else {
        const v = parseAmount(raw);
        if (v === null) { errors.push(`Ligne ${n} : valeur « ${raw} » invalide dans la colonne ${col}.`); bad = true; }
        else if (col === "revenue") row.revenue = raw === "" ? null : v;
        else row[col] = v;
      }
    });
    if (bad) return;
    if (row.clicks > row.impressions && row.impressions > 0) { errors.push(`Ligne ${n} : plus de clics que d'impressions.`); return; }
    const key = `${row.date}:${row.platform}`;
    if (seen.has(key)) { errors.push(`Ligne ${n} : doublon pour ${row.platform} le ${row.date}.`); return; }
    seen.add(key);
    rows.push(row);
  });
  return { rows, errors: errors.slice(0, 20) };
}

export const CSV_TEMPLATE = "date;plateforme;impressions;portee;clics;engagement;vues_video;conversions;prospects;depenses;revenu\n2026-01-15;facebook;12000;8400;310;520;0;12;8;5000;\n";
