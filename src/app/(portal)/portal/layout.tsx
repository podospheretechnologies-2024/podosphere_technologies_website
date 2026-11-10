import type { ReactNode } from 'react';

export const metadata = { title: 'Client Portal | Podo Social' };

/** Route group layout — auth + shell live on each page via `requirePortalPage`. */
export default function PortalRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
