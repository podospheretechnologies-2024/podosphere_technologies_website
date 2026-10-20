export function AdminsOnlyNotice({
  title = 'Admins only',
  description = 'Only workspace owners and admins can connect channels and change campaigns. Ask an admin if you need access.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="border-border bg-surface-muted/40 flex max-w-lg flex-col gap-2 rounded-xl border p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
