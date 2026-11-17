export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-56 rounded-md bg-sand" />
      <div className="h-4 w-72 max-w-full rounded-md bg-sand" />
      <div className="h-64 rounded-lg bg-sand" />
    </div>
  );
}
