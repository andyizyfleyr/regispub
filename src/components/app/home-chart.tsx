import { cn, formatDay, formatNumber } from "@/lib/utils";

/** Un jour du graphique. `value` vaut `null` quand aucun chiffre validé n'existe pour ce jour. */
export type DayPoint = { date: string; value: number | null };

/** Hauteurs (en %) des barres d'attente, quand il n'y a encore aucun chiffre : un décor, pas une mesure. */
const GHOST = [28, 40, 34, 52, 46, 62, 55, 70, 60, 78, 68, 84, 74, 90];

/**
 * Graphique du bandeau vert de l'accueil : une barre par jour sur les derniers jours.
 * Seuls les chiffres validés sont montrés ; un jour sans chiffres reste vide, rien n'est estimé.
 */
export function HomeChart({ points, label, className }: { points: DayPoint[]; label: string; className?: string }) {
  const measured = points.filter((p) => p.value !== null);
  const total = measured.reduce((s, p) => s + (p.value ?? 0), 0);
  const max = Math.max(1, ...measured.map((p) => p.value ?? 0));
  const empty = measured.length === 0;
  const period = `${points.length} derniers jours`;
  return (
    <figure className={cn("rounded-2xl bg-white/[0.08] p-3 ring-1 ring-inset ring-white/10 sm:p-4", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        {empty ? (
          <span className="text-[0.875rem] font-medium text-white">Pas encore de résultats</span>
        ) : (
          <span className="min-w-0">
            <span className="tnum font-display text-[1.5rem] font-semibold leading-none text-white sm:text-[1.75rem]">{formatNumber(total)}</span>
            <span className="ml-1.5 text-[0.8125rem] text-white/75">{label.toLowerCase()}</span>
          </span>
        )}
        <span className="shrink-0 text-[0.75rem] text-white/60">{period}</span>
      </figcaption>
      <div aria-hidden className="mt-3 flex h-14 items-end gap-[3px] sm:h-20 sm:gap-1">
        {points.map((p, i) => empty ? (
          <span key={p.date} className="flex-1 rounded-t-[3px] bg-white/10" style={{ height: `${GHOST[i % GHOST.length]}%` }} />
        ) : p.value === null ? (
          <span key={p.date} className="h-[3px] flex-1 rounded-full bg-white/15" title={`${formatDay(p.date)} : pas de chiffres`} />
        ) : (
          <span key={p.date} className="flex-1 rounded-t-[3px] bg-mint" style={{ height: `${Math.max(6, Math.round((p.value / max) * 100))}%` }} title={`${formatDay(p.date)} : ${formatNumber(p.value)}`} />
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-[0.6875rem] text-white/55">
        <span>{points[0] ? formatDay(points[0].date) : ""}</span>
        <span>Aujourd&apos;hui</span>
      </div>
      {empty && <p className="mt-1.5 text-[0.75rem] leading-snug text-white/70">Vos chiffres s&apos;affichent ici dès les premiers résultats.</p>}
    </figure>
  );
}
