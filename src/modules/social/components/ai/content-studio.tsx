'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import {
  AI_CONTENT_FORMAT_OPTIONS,
  AI_PROMPT_MAX_LENGTH,
  AI_REEL_LENGTH_DEFAULT,
  AI_REEL_LENGTHS_SECONDS,
  AI_REEL_PLATFORM_OPTIONS,
  type AiContentFormat,
  type AiReelLengthSeconds,
  type AiReelPlatform,
} from '../../config/ai';
import type { ContentTemplate } from '../../config/content-templates';
import { useAiStatus } from '../../hooks/use-ai-status';
import {
  generateFromCompetitor,
  generatePosts,
  generateReel,
} from '../../lib/ai.client';
import { revalidatePosts } from '../../lib/posts.client';
import type { CaptionTonePresetId } from '../../server/ai/presets';
import type { AiReelScript } from '../../types/ai';
import { PostComposer, type ComposerInitialItem } from '../posts/composer/post-composer';
import { useWorkspaceRole } from '../shell/workspace-role-context';
import { AiReelCard } from './ai-reel-card';
import { AiVariationCard } from './ai-variation-card';
import { CaptionTonePicker } from './caption-tone-picker';
import { ContentTemplatesGallery } from './content-templates-gallery';
import { UpcomingOccasions, type OccasionSeed } from './upcoming-occasions';

type StudioMode = 'idea' | 'competitor';

const MODE_OPTIONS: SegmentedOption<StudioMode>[] = [
  { value: 'idea', label: 'From an idea' },
  { value: 'competitor', label: 'From a competitor' },
];

type ComposerState = { open: false } | { open: true; items: ComposerInitialItem[] };

interface RunParams {
  mode: StudioMode;
  format: AiContentFormat;
  tonePresetId: CaptionTonePresetId | null;
  idea: string;
  examples: string;
  notes: string;
  platform: AiReelPlatform;
  lengthSeconds: AiReelLengthSeconds;
}

const IDEA_PLACEHOLDER: Record<AiContentFormat, string> = {
  post: 'e.g. We just launched a free website audit for small businesses. Mention the 24h turnaround.',
  reel: 'e.g. 3 quick tips to style formal shoes for the office.',
};

export function ContentStudio() {
  const { canManageCampaigns } = useWorkspaceRole();
  const { data: status } = useAiStatus();
  const configured = status?.configured ?? false;

  const [mode, setMode] = useState<StudioMode>('idea');
  const [format, setFormat] = useState<AiContentFormat>('post');
  const [tonePresetId, setTonePresetId] = useState<CaptionTonePresetId | null>(null);
  const [idea, setIdea] = useState('');
  const [examples, setExamples] = useState('');
  const [notes, setNotes] = useState('');
  const [platform, setPlatform] = useState<AiReelPlatform>('instagram');
  const [lengthSeconds, setLengthSeconds] = useState<AiReelLengthSeconds>(AI_REEL_LENGTH_DEFAULT);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variations, setVariations] = useState<string[][] | null>(null);
  const [reel, setReel] = useState<AiReelScript | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState>({ open: false });

  const inputReady = mode === 'idea' ? idea.trim().length > 0 : examples.trim().length > 0;

  async function run(params: RunParams) {
    if (!configured) {
      setError('AI is switched off. Add ANTHROPIC_API_KEY to the server .env and restart.');
      return;
    }
    const tone = params.tonePresetId ?? undefined;
    setBusy(true);
    setError(null);
    setVariations(null);
    setReel(null);
    setAnalysis(null);
    try {
      if (params.mode === 'competitor') {
        const result = await generateFromCompetitor({
          examples: params.examples,
          format: params.format,
          notes: params.notes.trim() || undefined,
          platform: params.platform,
          lengthSeconds: params.lengthSeconds,
          tonePresetId: tone,
        });
        setAnalysis(result.analysis);
        if (result.format === 'reel') {
          setReel(result.reel);
        } else {
          setVariations(result.variations);
        }
        return;
      }

      if (params.format === 'reel') {
        setReel(
          await generateReel({
            content: params.idea,
            platform: params.platform,
            lengthSeconds: params.lengthSeconds,
            tonePresetId: tone,
          })
        );
      } else {
        const result = await generatePosts({
          content: params.idea,
          format: 'post',
          tonePresetId: tone,
        });
        setVariations(result.variations);
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Could not generate the content');
    } finally {
      setBusy(false);
    }
  }

  function onGenerate() {
    void run({ mode, format, tonePresetId, idea, examples, notes, platform, lengthSeconds });
  }

  function pickTemplate(template: ContentTemplate) {
    setMode('idea');
    setFormat(template.format);
    setIdea(template.prompt);
    if (template.tonePresetId) {
      setTonePresetId(template.tonePresetId);
    }
    setError(null);
  }

  // One click on a festival → seed the idea and generate straight away.
  function pickOccasion(seed: OccasionSeed) {
    const tone = seed.tonePresetId ?? tonePresetId;
    setMode('idea');
    setIdea(seed.topic);
    setTonePresetId(tone);
    void run({ mode: 'idea', format, tonePresetId: tone, idea: seed.topic, examples, notes, platform, lengthSeconds });
  }

  function openComposer(items: ComposerInitialItem[]) {
    if (!canManageCampaigns) {
      return;
    }
    setComposer({ open: true, items });
  }

  function insertReelCaption(script: AiReelScript) {
    const content = [script.caption, script.hashtags.join(' ')].filter(Boolean).join('\n\n');
    openComposer([{ content, media: [] }]);
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-2">
        <Sparkles className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-base font-semibold">Content Studio</h2>
          <p className="text-muted-foreground text-sm">
            Generate posts and reels from a template, your own idea, or a competitor&apos;s style —
            in your brand voice.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="border-border bg-surface-muted/50 text-muted-foreground rounded-lg border p-3 text-sm">
          AI text is switched off. Set <code className="text-foreground">ANTHROPIC_API_KEY</code> in
          the server <code className="text-foreground">.env</code> and restart to turn it on.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Source"
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              disabled={busy}
            />
            <SegmentedControl
              label="Format"
              options={AI_CONTENT_FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              disabled={busy}
            />
          </div>

          {mode === 'idea' && (
            <ContentTemplatesGallery format={format} onPick={pickTemplate} disabled={busy} />
          )}

          <CaptionTonePicker value={tonePresetId} onChange={setTonePresetId} disabled={busy} />

          {format === 'reel' && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Platform</p>
                <SegmentedControl
                  label="Reel platform"
                  options={AI_REEL_PLATFORM_OPTIONS}
                  value={platform}
                  onChange={setPlatform}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Length</p>
                <div role="radiogroup" aria-label="Reel length" className="flex flex-wrap gap-1">
                  {AI_REEL_LENGTHS_SECONDS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      role="radio"
                      aria-checked={lengthSeconds === seconds}
                      disabled={busy}
                      onClick={() => setLengthSeconds(seconds)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                        lengthSeconds === seconds
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      )}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'idea' ? (
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              maxLength={AI_PROMPT_MAX_LENGTH}
              rows={5}
              placeholder={IDEA_PLACEHOLDER[format]}
              aria-label="Content idea"
              className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
            />
          ) : (
            <div className="space-y-2">
              <textarea
                value={examples}
                onChange={(event) => setExamples(event.target.value)}
                maxLength={AI_PROMPT_MAX_LENGTH}
                rows={6}
                placeholder="Paste 1–5 of a competitor's captions (one per line is fine), or describe how they post."
                aria-label="Competitor examples"
                className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
              />
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                placeholder="Optional: what should we say differently? (our offer, angle, product)"
                aria-label="Extra direction"
              />
              <p className="text-muted-foreground text-xs">
                We study their style only — the result is original content in your brand voice, never
                a copy.
              </p>
            </div>
          )}

          <Button variant="ai" onClick={onGenerate} disabled={busy || !configured || !inputReady}>
            {busy ? 'Generating…' : `Generate ${format}`}
          </Button>

          {error && (
            <div
              role="alert"
              className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
            >
              {error}
            </div>
          )}

          {analysis && (
            <div className="border-border bg-surface-muted/50 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium">What works in their content</p>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">{analysis}</p>
            </div>
          )}

          {reel && (
            <AiReelCard
              reel={reel}
              onUseCaption={canManageCampaigns ? () => insertReelCaption(reel) : undefined}
            />
          )}

          {variations && variations.length > 0 && (
            <div className="space-y-3">
              {variations.map((posts, index) => (
                <AiVariationCard
                  key={index}
                  index={index}
                  posts={posts}
                  onUse={() =>
                    openComposer(posts.map((content) => ({ content, media: [] })))
                  }
                />
              ))}
            </div>
          )}

          {!canManageCampaigns && (reel || (variations && variations.length > 0)) && (
            <p className="text-muted-foreground text-xs">
              Only workspace admins can open this in Create Post. You can still copy it.
            </p>
          )}
        </div>

        <UpcomingOccasions className="h-fit" compact onSelect={pickOccasion} />
      </div>

      {canManageCampaigns && (
        <PostComposer
          open={composer.open}
          group={null}
          initialItems={composer.open ? composer.items : undefined}
          onClose={() => setComposer({ open: false })}
          onSaved={() => {
            setComposer({ open: false });
            void revalidatePosts();
          }}
        />
      )}
    </Card>
  );
}
