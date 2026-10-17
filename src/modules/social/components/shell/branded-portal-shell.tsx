import type { ReactNode } from 'react';
import type { OrgBranding } from '@/shared/server/org-branding';

/** Minimal white-label chrome for the approver portal (and similar client-facing surfaces). */
export function BrandedPortalShell({
  branding,
  children,
}: {
  branding: OrgBranding;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header
        className="sticky top-0 z-10 border-b border-gray-200"
        style={{ backgroundColor: branding.primaryColor }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- agency-uploaded logo URL
              <img src={branding.logoUrl} alt="" className="h-8 rounded" />
            ) : null}
            <h1 className="text-lg font-bold tracking-tight">{branding.portalTitle}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
