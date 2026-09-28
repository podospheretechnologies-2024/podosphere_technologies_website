'use client';

import type { SignatureItem } from '../../../types/settings';

interface SignatureSelectProps {
  signatures: SignatureItem[];
  disabled?: boolean;
  onInsert: (content: string) => void;
}

function preview(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim()) ?? content;
  return firstLine.length > 40 ? `${firstLine.slice(0, 39)}…` : firstLine;
}

// A select that resets after every pick, so the same signature can be inserted again.
export function SignatureSelect({ signatures, disabled, onInsert }: SignatureSelectProps) {
  if (signatures.length === 0) {
    return null;
  }

  return (
    <select
      value=""
      disabled={disabled}
      aria-label="Insert signature"
      onChange={(event) => {
        const signature = signatures.find((entry) => entry.id === event.target.value);
        if (signature) {
          onInsert(signature.content);
        }
      }}
      className="border-border bg-surface hover:bg-surface-muted h-8 rounded-lg border px-2 text-sm transition outline-none disabled:opacity-50"
    >
      <option value="" disabled>
        Insert signature…
      </option>
      {signatures.map((signature) => (
        <option key={signature.id} value={signature.id}>
          {preview(signature.content)}
        </option>
      ))}
    </select>
  );
}
