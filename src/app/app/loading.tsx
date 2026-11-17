/** Squelette : reprend la forme des pages (bandeau, tuiles, lignes) pendant le chargement. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-36 !rounded-[24px]" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4">
            <div className="skeleton size-11 !rounded-xl" />
            <div className="skeleton mt-4 h-4 w-3/4" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0">
            <div className="skeleton size-10 shrink-0 !rounded-full" />
            <div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
