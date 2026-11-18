export function PortalComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <h3 className="mb-1 text-lg font-medium text-foreground">Coming soon</h3>
        <p className="text-muted-foreground">
          Your agency is setting this up. Check back after the next portal update.
        </p>
      </div>
    </div>
  );
}
