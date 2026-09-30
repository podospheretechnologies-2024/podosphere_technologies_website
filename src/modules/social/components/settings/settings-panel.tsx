'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { SOCIAL_BASE_PATH } from '../../config/navigation';
import { SignaturesCard } from './signatures-card';
import { TagsCard } from './tags-card';
import { TemplatesCard } from './templates-card';

type SettingsTab = 'sets' | 'signatures' | 'tags';

const tabs: { id: SettingsTab; label: string; description: string }[] = [
  {
    id: 'sets',
    label: 'Sets',
    description: 'Manage your content sets for easy reuse across posts.',
  },
  {
    id: 'signatures',
    label: 'Signatures',
    description: 'Reusable text blocks appended to your posts.',
  },
  { id: 'tags', label: 'Tags', description: 'Organize posts with colored tags.' },
];

const externalLinks = [
  { href: `${SOCIAL_BASE_PATH}/automation`, label: 'Webhooks' },
  { href: `${SOCIAL_BASE_PATH}/automation`, label: 'Auto Post' },
];

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>('sets');
  const active = tabs.find((entry) => entry.id === tab)!;

  return (
    <div className="flex min-h-[70vh] gap-px overflow-hidden rounded-xl">
      <aside className="bg-surface-muted/40 border-border w-56 shrink-0 border-r p-4">
        <nav className="space-y-1">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition',
                tab === entry.id
                  ? 'bg-surface text-foreground border-primary border-l-2'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
              )}
            >
              {entry.label}
            </button>
          ))}
          <div className="border-border my-3 border-t" />
          {externalLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-muted-foreground hover:bg-surface hover:text-foreground flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">
            {active.label}
            {tab === 'sets' && ' (templates)'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{active.description}</p>
        </div>
        {tab === 'sets' && <TemplatesCard />}
        {tab === 'signatures' && <SignaturesCard />}
        {tab === 'tags' && <TagsCard />}
      </div>
    </div>
  );
}
