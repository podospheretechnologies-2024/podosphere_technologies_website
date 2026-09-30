'use client';

import dayjs from 'dayjs';
import {
  Bookmark,
  Camera,
  Ellipsis,
  Heart,
  MessageCircle,
  Music,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/shared/lib/cn';
import { STORY_IMAGE_DURATION_MS } from '../../config/media';
import type { MediaItem } from '../../types/media';

interface FrameProps {
  media: MediaItem;
  accountName: string;
  /** Plays videos (and the story progress bar) while true. */
  active: boolean;
  /** Shows the sound toggle; off in the grid where the whole card is one button. */
  controls?: boolean;
  /** Caption shown under the media; defaults to the file name. */
  caption?: string;
}

const ICON_STROKE = 1.75;

function toHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._]/g, '') || 'podosphere';
}

function toCaption(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

// Instagram's short story timestamps: "now", "12m", "3h", "2d", "5w".
function shortAge(iso: string): string {
  const minutes = dayjs().diff(dayjs(iso), 'minute');
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`;
  return `${Math.floor(minutes / (60 * 24 * 7))}w`;
}

function useActiveVideo(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (active) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  return videoRef;
}

function Avatar({
  name,
  ring = false,
  size = 28,
}: {
  name: string;
  ring?: boolean;
  size?: number;
}) {
  const initial = (
    <span
      className="flex items-center justify-center rounded-full bg-neutral-800 text-[11px] font-semibold text-white"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );

  if (!ring) {
    return initial;
  }
  return (
    <span className="shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
      <span className="block rounded-full bg-white p-[2px]">{initial}</span>
    </span>
  );
}

function FrameMedia({
  media,
  muted,
  videoRef,
  fit = 'cover',
}: {
  media: MediaItem;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  fit?: 'cover' | 'contain';
}) {
  if (media.type === 'video') {
    return (
      <video
        ref={videoRef}
        src={media.url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <Image
      src={media.url}
      alt={media.alt ?? media.name}
      fill
      unoptimized
      sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
      className={fit === 'cover' ? 'object-cover' : 'object-contain'}
    />
  );
}

function SoundToggle({
  muted,
  onToggle,
  className,
}: {
  muted: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      className={cn('rounded-full bg-black/60 p-1.5 text-white', className)}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function InstagramPostFrame({ media, accountName, active, controls, caption }: FrameProps) {
  const videoRef = useActiveVideo(active);
  const [muted, setMuted] = useState(true);
  const handle = toHandle(accountName);
  const body = caption?.trim() || toCaption(media.name);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={handle} ring />
        <span className="truncate text-[13px] font-semibold">{handle}</span>
        <Ellipsis className="ml-auto size-5 shrink-0" strokeWidth={ICON_STROKE} />
      </div>

      <div className="relative aspect-[4/5] bg-neutral-100">
        <FrameMedia media={media} muted={muted} videoRef={videoRef} />
        {media.type === 'video' && controls && (
          <SoundToggle
            muted={muted}
            onToggle={() => setMuted(!muted)}
            className="absolute right-3 bottom-3"
          />
        )}
      </div>

      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="size-6" strokeWidth={ICON_STROKE} />
        <MessageCircle className="size-6 -scale-x-100" strokeWidth={ICON_STROKE} />
        <Send className="size-6" strokeWidth={ICON_STROKE} />
        <Bookmark className="ml-auto size-6" strokeWidth={ICON_STROKE} />
      </div>

      <div className="space-y-1 px-3 pt-2 pb-3 text-[13px]">
        <p className="font-semibold">Be the first to like this</p>
        <p className="line-clamp-2">
          <span className="font-semibold">{handle}</span> {body}
        </p>
        <p className="text-[11px] tracking-wide text-neutral-500 uppercase">
          {dayjs(media.createdAt).format('D MMMM')}
        </p>
      </div>
    </div>
  );
}

export function InstagramReelFrame({ media, accountName, active, controls, caption }: FrameProps) {
  const videoRef = useActiveVideo(active);
  const [muted, setMuted] = useState(true);
  const handle = toHandle(accountName);
  const body = caption?.trim() || toCaption(media.name);

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black text-white">
      <FrameMedia media={media} muted={muted} videoRef={videoRef} />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <span className="text-lg font-bold">Reels</span>
        <Camera className="size-6" strokeWidth={ICON_STROKE} />
      </div>
      {controls && (
        <SoundToggle
          muted={muted}
          onToggle={() => setMuted(!muted)}
          className="absolute top-14 right-3"
        />
      )}

      <div className="absolute right-2 bottom-4 flex flex-col items-center gap-4 text-[11px] font-medium">
        <span className="flex flex-col items-center gap-1">
          <Heart className="size-6" strokeWidth={ICON_STROKE} />
          Like
        </span>
        <span className="flex flex-col items-center gap-1">
          <MessageCircle className="size-6 -scale-x-100" strokeWidth={ICON_STROKE} />0
        </span>
        <Send className="size-6" strokeWidth={ICON_STROKE} />
        <Ellipsis className="size-6" strokeWidth={ICON_STROKE} />
        <span className="rounded-md border-2 border-white">
          <Avatar name={handle} size={22} />
        </span>
      </div>

      <div className="absolute right-14 bottom-4 left-3 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar name={handle} />
          <span className="truncate text-[13px] font-semibold">{handle}</span>
          <span className="shrink-0 rounded-lg border border-white/70 px-2 py-0.5 text-xs font-semibold">
            Follow
          </span>
        </div>
        <p className="truncate text-[13px]">{body}</p>
        <p className="flex items-center gap-1.5 text-xs">
          <Music className="size-3 shrink-0" />
          <span className="truncate">{handle} · Original audio</span>
        </p>
      </div>
    </div>
  );
}

export function InstagramStoryFrame({ media, accountName, active, controls }: FrameProps) {
  const videoRef = useActiveVideo(active);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const handle = toHandle(accountName);

  useEffect(() => {
    if (!active) {
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const video = videoRef.current;
      setProgress(
        video
          ? video.duration
            ? video.currentTime / video.duration
            : 0
          : ((now - startedAt) % STORY_IMAGE_DURATION_MS) / STORY_IMAGE_DURATION_MS
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, videoRef]);

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-neutral-900 text-white">
      {media.type === 'image' && (
        // Instagram fills the space around non-vertical photos with a blurred copy.
        <Image
          src={media.url}
          alt=""
          fill
          unoptimized
          sizes="20vw"
          className="scale-110 object-cover opacity-60 blur-2xl"
        />
      )}
      <FrameMedia media={media} muted={muted} videoRef={videoRef} fit="contain" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

      <div className="absolute inset-x-2 top-2 h-0.5 overflow-hidden rounded-full bg-white/35">
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${(active ? progress : 0) * 100}%` }}
        />
      </div>

      <div className="absolute inset-x-3 top-5 flex items-center gap-2">
        <Avatar name={handle} />
        <span className="truncate text-[13px] font-semibold">{handle}</span>
        <span className="shrink-0 text-[13px] text-white/70">{shortAge(media.createdAt)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {media.type === 'video' && controls && (
            <SoundToggle muted={muted} onToggle={() => setMuted(!muted)} />
          )}
          <Ellipsis className="size-5" strokeWidth={ICON_STROKE} />
          <X className="size-6" strokeWidth={ICON_STROKE} />
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center gap-3">
        <span className="flex-1 truncate rounded-full border border-white/70 px-4 py-2 text-[13px] text-white/90">
          Send message
        </span>
        <Heart className="size-6 shrink-0" strokeWidth={ICON_STROKE} />
        <Send className="size-6 shrink-0" strokeWidth={ICON_STROKE} />
      </div>
    </div>
  );
}

export function InstagramFrame(props: FrameProps) {
  switch (props.media.format) {
    case 'reel':
      return <InstagramReelFrame {...props} />;
    case 'story':
      return <InstagramStoryFrame {...props} />;
    default:
      return <InstagramPostFrame {...props} />;
  }
}
