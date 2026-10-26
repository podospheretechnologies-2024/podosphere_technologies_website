'use client';

import type { HashtagGroupItem } from '../../../types/settings';

interface HashtagSelectProps {
  groups: HashtagGroupItem[];
  disabled?: boolean;
  onInsert: (hashtags: string) => void;
}

// A select that resets after every pick, so the same group can be inserted again.
export function HashtagSelect({ groups, disabled, onInsert }: HashtagSelectProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <select
      value=""
      disabled={disabled}
      aria-label="Insert hashtags"
      onChange={(event) => {
        const group = groups.find((entry) => entry.id === event.target.value);
        if (group) {
          onInsert(group.hashtags);
        }
      }}
      className="border-border bg-surface hover:bg-surface-muted h-8 rounded-lg border px-2 text-sm transition outline-none disabled:opacity-50"
    >
      <option value="" disabled>
        Insert hashtags…
      </option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );
}
