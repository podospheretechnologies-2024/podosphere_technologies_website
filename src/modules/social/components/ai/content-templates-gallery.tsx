'use client';

import {
  CalendarHeart,
  GraduationCap,
  Megaphone,
  MessageCircle,
  Sparkles,
  Star,
  Video,
  type LucideIcon,
} from 'lucide-react';
import {
  contentTemplatesForFormat,
  type ContentTemplate,
  type ContentTemplateCategory,
} from '../../config/content-templates';
import type { AiContentFormat } from '../../config/ai';
import { cn } from '@/shared/lib/cn';

const CATEGORY_ICONS: Record<ContentTemplateCategory, LucideIcon> = {
  Promotion: Megaphone,
  Engagement: MessageCircle,
  Education: GraduationCap,
  'Social proof': Star,
  Festival: CalendarHeart,
  'Behind the scenes': Video,
  Announcement: Sparkles,
};

interface ContentTemplatesGalleryProps {
  format: AiContentFormat;
  onPick: (template: ContentTemplate) => void;
  disabled?: boolean;
}

export function ContentTemplatesGallery({
  format,
  onPick,
  disabled = false,
}: ContentTemplatesGalleryProps) {
  const templates = contentTemplatesForFormat(format);

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">
        Start from a template — one click fills the prompt, then edit and generate.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = CATEGORY_ICONS[template.category];
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template)}
              disabled={disabled}
              className={cn(
                'border-border flex flex-col gap-1 rounded-lg border p-3 text-left transition',
                'hover:border-primary/40 hover:bg-surface-muted/60',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="text-primary size-4 shrink-0" />
                <span className="text-sm font-medium">{template.label}</span>
              </span>
              <span className="text-muted-foreground text-xs">{template.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
