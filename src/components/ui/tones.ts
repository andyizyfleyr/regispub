export type Tone = "neutral" | "warn" | "info" | "ok" | "danger" | "accent";

/** Couleurs d'état, partagées par les pastilles et les étiquettes. */
export const TONES: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft",
  warn: "bg-marigold-soft text-[#8a5a00]",
  info: "bg-sky-soft text-sky",
  ok: "bg-green-soft text-green",
  danger: "bg-clay-soft text-clay",
  accent: "bg-forest text-white",
};
