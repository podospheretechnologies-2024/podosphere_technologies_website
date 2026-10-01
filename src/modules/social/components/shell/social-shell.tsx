'use client';

import { LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import { getSocialAppNavItem, socialAppHome } from '../../config/app-nav';
import { revalidatePosts } from '../../lib/posts.client';
import { PostComposer } from '../posts/composer/post-composer';
import { ChannelsPanel } from './channels-panel';
import { IconRail } from './icon-rail';
import { SectionBackendPanel } from './section-backend-panel';
import { SuccessToast } from './success-toast';

const THEME_STORAGE_KEY = 'podosphere-social-theme';

type SocialTheme = 'dark' | 'light';

interface SocialShellProps {
  children: ReactNode;
  userName: string;
  organizationName: string;
}

function SocialShellBody({ children, userName, organizationName }: SocialShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItem = getSocialAppNavItem(pathname);
  const [composerOpen, setComposerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<SocialTheme>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function changeTheme(next: SocialTheme) {
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  async function logout() {
    setLoggingOut(true);
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div
      className={cn(
        'theme-social bg-background text-foreground relative flex min-h-screen flex-col p-3',
        theme === 'light' && 'theme-social-light'
      )}
    >
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
              <div
                role="group"
                aria-label="Color mode"
                className="border-border bg-surface-muted/60 flex h-7 items-center rounded-md border p-px"
              >
                <button
                  type="button"
                  onClick={() => changeTheme('light')}
                  aria-pressed={theme === 'light'}
                  title="Light mode"
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium leading-none transition',
                    theme === 'light'
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sun className="size-3" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => changeTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  title="Dark mode"
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium leading-none transition',
                    theme === 'dark'
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Moon className="size-3" />
                  Dark
                </button>
              </div>
              <SectionBackendPanel
                sectionKey={navItem?.key}
                sectionLabel={navItem?.label ?? 'Social'}
              />
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
