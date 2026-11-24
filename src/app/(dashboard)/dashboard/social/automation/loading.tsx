export default function Loading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading">
      <div className="bg-surface-muted h-8 w-48 animate-pulse rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-muted h-24 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="bg-surface-muted h-64 animate-pulse rounded-xl" />
    </div>
  );
}
