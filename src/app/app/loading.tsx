export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-56 rounded-md bg-sand" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-sand" />)}</div>
      <div className="h-64 rounded-lg bg-sand" />
    </div>
  );
}
