'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';
import { getSocialAppNavItem, socialAppHome } from '../../config/app-nav';
import { revalidatePosts } from '../../lib/posts.client';
import { PostComposer } from '../posts/composer/post-composer';
import { ChannelsPanel } from './channels-panel';
import { IconRail } from './icon-rail';
import { SuccessToast } from './success-toast';

interface SocialShellProps {
  children: ReactNode;
  userName: string;
  organizationName: string;
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function SocialShellBody({ children, userName, organizationName }: SocialShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItem = getSocialAppNavItem(pathname);
  const [composerOpen, setComposerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function logout() {
    setLoggingOut(true);
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="theme-social bg-background text-foreground relative flex min-h-screen flex-col p-3">
      <div className="flex min-h-0 flex-1 gap-2">
        <IconRail />
        <div className="bg-border flex min-w-0 flex-1 flex-col gap-px overflow-hidden rounded-xl">
          <header className="bg-surface flex h-16 shrink-0 items-center gap-4 px-5">
            <Link
              href={socialAppHome}
              className="flex shrink-0 items-center gap-2.5 font-semibold"
              title="Podosphere"
            >
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold">
                P
              </span>
              <span className="text-base font-bold">Podosphere</span>
            </Link>
            <h1 className="flex-1 text-xl font-semibold">{navItem?.label ?? 'Social'}</h1>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-muted-foreground text-xs">{organizationName}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                title="Log out"
                className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-lg p-2 transition"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 gap-px">
            {navItem?.showChannelsPanel && (
              <ChannelsPanel onCreatePost={() => setComposerOpen(true)} />
            )}
            <main className="bg-surface min-w-0 flex-1 overflow-y-auto p-5">{children}</main>
          </div>
        </div>
      </div>

      <a
        href="https://discord.com"
        target="_blank"
        rel="noreferrer"
        className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#5865F2] shadow-lg transition hover:opacity-90"
      >
        <DiscordIcon className="size-5" />
        Discord Support
      </a>

      {toast && <SuccessToast message={toast} />}

      <PostComposer
        open={composerOpen}
        group={null}
        onClose={() => setComposerOpen(false)}
        onSaved={() => {
          setComposerOpen(false);
          setToast('Added successfully');
          void revalidatePosts();
        }}
      />
    </div>
  );
}

export function SocialShell(props: SocialShellProps) {
  return (
    <Suspense fallback={<div className="theme-social bg-background min-h-screen" />}>
      <SocialShellBody {...props} />
    </Suspense>
  );
}
