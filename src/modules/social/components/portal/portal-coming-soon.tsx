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
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-gray-500">{description}</p>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <h3 className="mb-1 text-lg font-medium text-gray-900">Coming soon</h3>
        <p className="text-gray-500">
          Your agency is setting this up. Check back after the next portal update.
        </p>
      </div>
    </div>
  );
}
