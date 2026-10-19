'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { NOTIFICATION_TYPE_LABELS, type SocialNotificationType } from '../../config/notifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  type NotificationItem,
} from '../../hooks/use-notifications';

function typeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type as SocialNotificationType] ?? type;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationsBell() {
  const { data, mutate, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onItemClick(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        await mutate();
      } catch {
        // Soft-fail: still navigate if linked.
      }
    }
    setOpen(false);
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead();
      await mutate();
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'text-muted-foreground hover:bg-surface-muted hover:text-foreground relative rounded-lg p-2 transition',
          open && 'bg-surface-muted text-foreground'
        )}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-full right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border shadow-xl"
        >
          <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAll()}
                className="text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {isLoading && items.length === 0 && (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">Loading…</li>
            )}
            {!isLoading && items.length === 0 && (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                You&apos;re all caught up.
              </li>
            )}
            {items.map((item) => {
              const body = (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                      {typeLabel(item.type)}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-sm leading-snug',
                      item.readAt ? 'text-muted-foreground' : 'text-foreground font-medium'
                    )}
                  >
                    {item.content}
                  </p>
                </div>
              );

              return (
                <li key={item.id} className="border-border border-b last:border-b-0">
                  {item.link ? (
                    <Link
                      href={item.link}
                      role="menuitem"
                      onClick={() => void onItemClick(item)}
                      className={cn(
                        'hover:bg-surface-muted block px-3 py-2.5 transition',
                        !item.readAt && 'bg-surface-muted/40'
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void onItemClick(item)}
                      className={cn(
                        'hover:bg-surface-muted w-full px-3 py-2.5 text-left transition',
                        !item.readAt && 'bg-surface-muted/40'
                      )}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
