'use client';

import { cn } from '@/shared/lib/cn';
import {
  CAPTION_TONE_PRESETS,
  type CaptionTonePresetId,
} from '../../server/ai/presets';

interface CaptionTonePickerProps {
  value: CaptionTonePresetId | null;
  onChange: (value: CaptionTonePresetId | null) => void;
  disabled?: boolean;
  /** Compact chip row (default) vs denser wrap */
  className?: string;
}

export function CaptionTonePicker({
  value,
  onChange,
  disabled,
  className,
}: CaptionTonePickerProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Caption tone
        </p>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Caption tone preset">
        {CAPTION_TONE_PRESETS.map((preset) => {
          const selected = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={selected}
              title={preset.description}
              disabled={disabled}
              onClick={() => onChange(selected ? null : preset.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
