import { redirect } from 'next/navigation';

/** Legacy URL — portal lives at `/portal` (Phase 2). */
export default async function ApproverPortalRedirectPage(props: {
  searchParams: Promise<{ tab?: string; connected?: string }>;
}) {
  const params = await props.searchParams;
  const qs = new URLSearchParams();
  if (params.connected) qs.set('connected', params.connected);

  const tab = params.tab;
  const path =
    tab === 'posts'
      ? '/portal/content'
      : tab === 'channels'
        ? '/portal/channels'
        : tab === 'overview'
          ? '/portal/overview'
          : '/portal';

  const query = qs.toString();
  redirect(query ? `${path}?${query}` : path);
}
