/** Squelette de l'espace de gestion : titre, chiffres clés, tableau. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="rounded-xl border border-line bg-surface p-4"><div className="skeleton h-3 w-1/2" /><div className="skeleton mt-3 h-7 w-2/3" /></div>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex items-center gap-4 border-b border-line p-4 last:border-b-0"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-4 w-1/5" /><div className="skeleton ml-auto h-4 w-16" /></div>)}
      </div>
    </div>
  );
}
