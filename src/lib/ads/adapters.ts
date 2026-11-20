import "server-only";
import { getConfig } from "@/lib/config";
import type { ImportedRow } from "./csv";

export class AdsApiError extends Error {}

export type ApiDailyRow = Omit<ImportedRow, "platform" | "revenue">;

/**
 * Lecture des statistiques auprès des API publicitaires officielles.
 * Les campagnes sont créées par nos gestionnaires dans les comptes publicitaires de l'agence ; leur identifiant
 * externe est ensuite rattaché à la commande. La création automatique de campagnes par API n'est pas encore implémentée.
 */
export interface AdsAdapter {
  readonly family: "META" | "TIKTOK";
  readonly label: string;
  isConfigured(): Promise<boolean>;
  fetchDaily(externalCampaignId: string, since: string, until: string): Promise<ApiDailyRow[]>;
}

const XOF_PER_EUR = 655.957; // parité fixe

function toXof(amount: number, currency: string, rates: Record<string, number>) {
  const c = currency.toUpperCase();
  if (c === "XOF") return Math.round(amount);
  if (c === "EUR") return Math.round(amount * XOF_PER_EUR);
  const rate = rates[c];
  if (!rate) throw new AdsApiError(`Compte publicitaire en ${c} : indiquez le taux de change dans Paramètres → Clés et connexions (ex. {"${c}":600}) pour convertir les dépenses en FCFA.`);
  return Math.round(amount * rate);
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; };

type MetaAction = { action_type: string; value: string };
const sumActions = (actions: MetaAction[] | undefined, types: string[]) => (actions ?? []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + num(a.value), 0);

export const metaAdapter: AdsAdapter = {
  family: "META",
  label: "Meta Marketing API",
  isConfigured: async () => Boolean((await getConfig()).meta.accessToken),
  async fetchDaily(externalCampaignId, since, until) {
    const config = await getConfig();
    if (!/^\d{5,30}$/.test(externalCampaignId)) throw new AdsApiError("Identifiant de campagne Meta invalide (chiffres uniquement).");
    const rows: ApiDailyRow[] = [];
    const params = new URLSearchParams({
      fields: "account_currency,impressions,reach,clicks,spend,actions", time_increment: "1", limit: "200",
      time_range: JSON.stringify({ since, until }), access_token: config.meta.accessToken,
    });
    let url: string | null = `https://graph.facebook.com/${config.meta.apiVersion}/${externalCampaignId}/insights?${params}`;
    for (let page = 0; url && page < 10; page++) {
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>[]; paging?: { next?: string }; error?: { message?: string } };
      if (!res.ok) throw new AdsApiError(`Meta : ${json.error?.message ?? `HTTP ${res.status}`}`);
      for (const d of json.data ?? []) {
        const actions = d.actions as MetaAction[] | undefined;
        rows.push({
          date: String(d.date_start), impressions: num(d.impressions), reach: num(d.reach), clicks: num(d.clicks),
          engagements: sumActions(actions, ["post_engagement"]),
          videoViews: sumActions(actions, ["video_view"]),
          leads: sumActions(actions, ["lead", "onsite_conversion.lead_grouped"]),
          conversions: sumActions(actions, ["purchase", "omni_purchase", "onsite_conversion.messaging_conversation_started_7d"]),
          spend: toXof(Number(d.spend) || 0, String(d.account_currency ?? "XOF"), config.fxRates),
        });
      }
      url = json.paging?.next ?? null;
    }
    return rows;
  },
};

export const tiktokAdapter: AdsAdapter = {
  family: "TIKTOK",
  label: "TikTok Marketing API",
  isConfigured: async () => { const t = (await getConfig()).tiktok; return Boolean(t.accessToken && t.advertiserId); },
  async fetchDaily(externalCampaignId, since, until) {
    const config = await getConfig();
    if (!/^\d{5,30}$/.test(externalCampaignId)) throw new AdsApiError("Identifiant de campagne TikTok invalide (chiffres uniquement).");
    const params = new URLSearchParams({
      advertiser_id: config.tiktok.advertiserId, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
      metrics: JSON.stringify(["spend", "impressions", "reach", "clicks", "video_play_actions", "likes", "comments", "shares", "follows", "conversion"]),
      start_date: since, end_date: until, page_size: "1000",
      filtering: JSON.stringify([{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([externalCampaignId]) }]),
    });
    const res = await fetch(`https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`, {
      headers: { "Access-Token": config.tiktok.accessToken }, signal: AbortSignal.timeout(30_000), cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { code?: number; message?: string; data?: { list?: { dimensions: Record<string, string>; metrics: Record<string, string> }[] } };
    if (!res.ok || json.code !== 0) throw new AdsApiError(`TikTok : ${json.message ?? `HTTP ${res.status}`}`);
    const currency = config.tiktok.accountCurrency;
    return (json.data?.list ?? []).map(({ dimensions, metrics: m }) => ({
      date: String(dimensions.stat_time_day).slice(0, 10), impressions: num(m.impressions), reach: num(m.reach), clicks: num(m.clicks),
      engagements: num(m.likes) + num(m.comments) + num(m.shares) + num(m.follows),
      videoViews: num(m.video_play_actions), leads: 0, conversions: num(m.conversion), spend: toXof(Number(m.spend) || 0, currency, config.fxRates),
    }));
  },
};

export const ADS_ADAPTERS = { META: metaAdapter, TIKTOK: tiktokAdapter } as const;
