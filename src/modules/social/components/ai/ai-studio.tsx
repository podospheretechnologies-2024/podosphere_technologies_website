'use client';

import {
  Check,
  Copy,
  ImagePlus,
  Plug,
  RefreshCw,
  SendHorizontal,
  Smile,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { useAiStatus } from '../../hooks/use-ai-status';
import { generateImage, generatePosts } from '../../lib/ai.client';
import { revalidateMediaLibrary } from '../../lib/media.client';
import { revalidatePosts } from '../../lib/posts.client';
import type { PostMedia } from '../../types/post';
import { MediaPicker } from '../posts/composer/media-picker';
import { PostComposer, type ComposerInitialItem } from '../posts/composer/post-composer';

type ComposerState = { open: false } | { open: true; items: ComposerInitialItem[] };

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  media?: PostMedia[];
  posts?: string[];
  summary?: {
    platform: string;
    dateHint: string;
    content: string;
    attachment: string;
  };
}

function ToolChip({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MessageActions({ onCopy, onRetry }: { onCopy: () => void; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="text-muted-foreground mt-2 flex items-center gap-1">
      {onRetry && (
        <button
          type="button"
          title="Retry"
          onClick={onRetry}
          className="hover:bg-surface-muted rounded-md p-1.5 transition"
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        title="Copy"
        onClick={() => {
          onCopy();
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="hover:bg-surface-muted rounded-md p-1.5 transition"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
      <button type="button" title="Helpful" className="hover:bg-surface-muted rounded-md p-1.5 transition">
        <ThumbsUp className="size-3.5" />
      </button>
      <button type="button" title="Not helpful" className="hover:bg-surface-muted rounded-md p-1.5 transition">
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  );
}

export function AiStudio() {
  const { data: status, error: statusError } = useAiStatus();
  const configured = status?.configured ?? false;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<PostMedia[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [lastPrompt, setLastPrompt] = useState('');

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  function openComposer(items: ComposerInitialItem[]) {
    setComposer({ open: true, items });
  }

  async function runGenerate(prompt: string, media: PostMedia[]) {
    setLastPrompt(prompt);
    setBusy(true);
    setError(null);
    try {
      const wantsImage =
        /\b(image|picture|photo|illustration|ai image)\b/i.test(prompt) &&
        !/\bschedule|post about|write\b/i.test(prompt);

      if (wantsImage) {
        const image = await generateImage({ prompt, orientation: 'square' });
        void revalidateMediaLibrary();
        const asPostMedia: PostMedia = {
          id: image.id,
          url: image.url,
          type: image.type,
          format: image.format,
          alt: image.alt,
        };
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Here’s an AI image based on your request. You can attach it to a post.',
            media: [asPostMedia],
          },
        ]);
        return;
      }

      const result = await generatePosts({ content: prompt, format: 'post' });
      const posts = result.variations[0] ?? [];
      const primary = posts[0] ?? prompt;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: "Here's a summary of your post request for confirmation:",
          media: media.length ? media : undefined,
          posts,
          summary: {
            platform: 'Selected channels',
            dateHint: 'Schedule when you open Create Post',
            content: primary.slice(0, 280),
            attachment: media.length ? `${media.length} file(s)` : 'None',
          },
        },
      ]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Could not process the request');
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Sorry — I could not complete that request. Try again in a moment.',
        },
      ]);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt && attached.length === 0) {
      return;
    }
    if (!configured) {
      setError('AI is switched off. Add OPENAI_API_KEY to .env and restart the server.');
      return;
    }

    const media = attached;
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: prompt || 'Please use the attached media for a post.',
        media: media.length ? media : undefined,
      },
    ]);
    setInput('');
    setAttached([]);
    scrollToBottom();
    await runGenerate(prompt || 'Write a short social post for this media.', media);
  }

  async function generateAiImage() {
    if (!configured) {
      setError('AI is switched off. Add OPENAI_API_KEY to .env and restart the server.');
      return;
    }
    const prompt = input.trim() || 'A modern social media illustration about community';
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: `AI Image: ${prompt}` },
    ]);
    setBusy(true);
    setError(null);
    try {
      const image = await generateImage({ prompt, orientation: 'square' });
      void revalidateMediaLibrary();
      const asPostMedia: PostMedia = {
        id: image.id,
        url: image.url,
        type: image.type,
        format: image.format,
        alt: image.alt,
      };
      setAttached((current) => [...current, asPostMedia]);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Generated an image and attached it below. Send a message to draft a post with it.',
          media: [asPostMedia],
        },
      ]);
      setInput('');
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Could not create the image');
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[28rem] flex-col">
      {(statusError || error) && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger mb-3 shrink-0 rounded-lg border p-3 text-sm"
        >
          {error ??
            (statusError instanceof Error ? statusError.message : 'Could not load AI settings')}
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="text-muted-foreground mx-auto max-w-xl space-y-3 pt-10 text-center text-sm leading-relaxed">
            <p className="text-foreground text-base font-medium">
              Ask the agent to schedule posts, generate media, or draft copy for your channels.
            </p>
            <p>
              Try: “Schedule a post for tomorrow about the importance of social media” or attach a
              picture and ask for a caption.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex flex-col gap-2',
              message.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'max-w-[min(100%,40rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-surface-muted text-foreground'
                  : 'border-border bg-surface border'
              )}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>

              {message.media && message.media.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.media.map((media) => (
                    <div
                      key={media.id}
                      className="bg-surface-muted relative size-24 overflow-hidden rounded-lg"
                    >
                      {media.type === 'video' ? (
                        <video
                          src={media.url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <Image
                          src={media.url}
                          alt=""
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {message.summary && (
                <ul className="border-border text-muted-foreground mt-3 space-y-1 border-t pt-3 text-xs">
                  <li>
                    <span className="text-foreground font-medium">Platform:</span>{' '}
                    {message.summary.platform}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Date &amp; Time:</span>{' '}
                    {message.summary.dateHint}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Attachment:</span>{' '}
                    {message.summary.attachment}
                  </li>
                </ul>
              )}

              {message.posts && message.posts.length > 0 && (
                <div className="border-border mt-3 space-y-2 border-t pt-3">
                  <p className="text-xs font-medium">Preview of your post content:</p>
                  {message.posts.map((post, index) => (
                    <div
                      key={`${message.id}-${index}`}
                      className="bg-surface-muted/60 rounded-xl p-3 text-sm whitespace-pre-wrap"
                    >
                      {post}
                    </div>
                  ))}
                  <Button
                    size="sm"
                    className="mt-1"
                    onClick={() =>
                      openComposer(
                        message.posts!.map((content, index) => ({
                          content,
                          media: index === 0 ? (message.media ?? []) : [],
                        }))
                      )
                    }
                  >
                    Open in Create Post
                  </Button>
                </div>
              )}
            </div>

            {message.role === 'assistant' && (
              <MessageActions
                onCopy={() => {
                  const text = [message.text, ...(message.posts ?? [])].join('\n\n');
                  void navigator.clipboard.writeText(text);
                }}
                onRetry={
                  lastPrompt
                    ? () => void runGenerate(lastPrompt, message.media ?? [])
                    : undefined
                }
              />
            )}
          </div>
        ))}

        {busy && (
          <p className="text-muted-foreground text-sm">Agent is working…</p>
        )}
      </div>

      <div className="border-border mt-4 shrink-0 space-y-3 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <ToolChip
            label="Insert Media"
            icon={<ImagePlus className="size-3.5" />}
            onClick={() => setPickerOpen(true)}
            disabled={busy}
          />
          <ToolChip label="Design Media" icon={<Wand2 className="size-3.5" />} disabled />
          <ToolChip label="Integrations" icon={<Plug className="size-3.5" />} disabled />
          <ToolChip
            label="AI Image"
            icon={<Sparkles className="size-3.5" />}
            onClick={() => void generateAiImage()}
            disabled={busy || !configured}
          />
          <ToolChip label="AI Video" icon={<Video className="size-3.5" />} disabled />
        </div>

        {attached.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attached.map((media) => (
              <div key={media.id} className="bg-surface-muted relative size-14 overflow-hidden rounded-lg">
                {media.type === 'video' ? (
                  <video src={media.url} className="h-full w-full object-cover" muted />
                ) : (
                  <Image
                    src={media.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-cover"
                  />
                )}
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    setAttached((current) => current.filter((item) => item.id !== media.id))
                  }
                  className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-border bg-surface-muted/40 relative flex items-end gap-2 rounded-xl border px-3 py-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message..."
            rows={2}
            disabled={busy}
            className="placeholder:text-muted-foreground max-h-40 min-h-12 w-full resize-none bg-transparent py-2 text-sm outline-none"
          />
          <button
            type="button"
            title="Emoji"
            disabled
            className="text-muted-foreground mb-1.5 hidden size-8 items-center justify-center rounded-md sm:flex"
          >
            <Smile className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!input.trim() && attached.length === 0)}
            aria-label="Send"
            className="bg-primary text-primary-foreground mb-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-40"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        alreadySelected={attached.length}
        onClose={() => setPickerOpen(false)}
        onInsert={(media) =>
          setAttached((current) => [
            ...current,
            ...media.filter((entry) => !current.some((item) => item.id === entry.id)),
          ])
        }
      />

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
    </div>
  );
}
